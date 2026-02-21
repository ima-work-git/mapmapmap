/* ═══════════════════════════════════════════════════════════════
   119番 住所特定AI支援 地図システム — app.js (GitHub Pages版)
   全データ・全ロジックをクライアントサイドで完結
   ═══════════════════════════════════════════════════════════════ */

(function(){
"use strict";

/* ───────────────────────── 0. 定数 ───────────────────────── */
const OSM_TILE = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const GSI_AERIAL = "https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg";
const DEFAULT_CENTER = [139.9034, 35.7847]; // 松戸
const DEFAULT_ZOOM = 14;
const esc = s => s ? String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;") : "";
const haversine = (a,b,c,d)=>{const R=6371e3,p=Math.PI/180,dp=(c-a)*p,dl=(d-b)*p,x=Math.sin(dp/2)**2+Math.cos(a*p)*Math.cos(c*p)*Math.sin(dl/2)**2;return R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x))};
const typeLabel = t=>({detached:"戸建て",apartment:"アパート",mansion:"マンション",store:"店舗",office:"オフィスビル"})[t]||t||"";
const catIcon = c=>({intersection:"🚦",convenience_store:"🏪",gas_station:"⛽",bridge:"🌉",park:"🌳",school:"🏫",large_building:"🏢",temple_shrine:"⛩",parking:"🅿",tenant:"🏢"})[c]||"📍";

/* ───────────────────────── 1. デモデータ ───────────────────────── */
const DEMO = {
area_a: {
  id:"area_a", name:"同一番地密集地区（松戸駅付近）",
  center:[139.9011,35.7838], common_address:"千葉県松戸市松戸1234番地",
  buildings:[
    {id:"A1",nameplate:"鈴木",type:"detached",floors:2,lat:35.78385,lng:139.90105,entrance_bearing:180,
     address:"千葉県松戸市松戸1234番地",
     features:{position:"角地（T字路の角）",right:"田中",left:"(道路)",across:"セブンイレブン",back:"山本"}},
    {id:"A2",nameplate:"山田",type:"detached",floors:2,lat:35.78375,lng:139.90115,entrance_bearing:180,
     address:"千葉県松戸市松戸1234番地",
     features:{position:"並びの2軒目",right:"佐藤",left:"鈴木",across:"月極駐車場",back:"山本"}},
    {id:"A3",nameplate:"佐藤",type:"detached",floors:2,lat:35.78365,lng:139.90125,entrance_bearing:180,
     address:"千葉県松戸市松戸1234番地",
     features:{position:"公園の隣",right:"高橋",left:"山田",across:"松戸中央公園入口",back:"中村"}},
    {id:"A4",nameplate:"高橋",type:"apartment",floors:3,lat:35.78355,lng:139.90135,entrance_bearing:180,
     address:"千葉県松戸市松戸1234番地",
     features:{position:"3階建てアパート",right:"渡辺",left:"佐藤",across:"松戸中央公園",back:"小林"}},
    {id:"A5",nameplate:"渡辺",type:"detached",floors:2,lat:35.78345,lng:139.90145,entrance_bearing:180,
     address:"千葉県松戸市松戸1234番地",
     features:{position:"突き当たり（行き止まり）",right:"(壁/行き止まり)",left:"高橋",across:"(空き地)",back:"加藤"}}
  ],
  pois:[
    {name:"セブンイレブン松戸駅前店",category:"convenience_store",lat:35.78390,lng:139.90090},
    {name:"松戸中央公園",category:"park",lat:35.78360,lng:139.90090},
    {name:"月極駐車場",category:"parking",lat:35.78378,lng:139.90090}
  ],
  decision_tree:{q:"角の家ですか？",yes:{result:"A1",label:"❶ 鈴木宅"},no:{q:"突き当たりの家ですか？",yes:{result:"A5",label:"❺ 渡辺宅"},no:{q:"向かいに公園は見えますか？",yes:{q:"3階建てですか？",yes:{result:"A4",label:"❹ 高橋宅"},no:{result:"A3",label:"❸ 佐藤宅"}},no:{result:"A2",label:"❷ 山田宅"}}}}
},
area_b: {
  id:"area_b", name:"路上通報想定地区（柏駅付近）",
  center:[139.9757,35.8681],
  gps_simulation:{true_location:{lat:35.8683,lng:139.9760},reported_gps:{lat:35.8680,lng:139.9755,accuracy_m:150}},
  landmarks:[
    {name:"柏駅前交差点",category:"intersection",lat:35.8685,lng:139.9762},
    {name:"ファミリーマート柏駅東口店",category:"convenience_store",lat:35.8678,lng:139.9758},
    {name:"ENEOS 柏中央SS",category:"gas_station",lat:35.8675,lng:139.9750},
    {name:"柏市立柏第一小学校",category:"school",lat:35.8690,lng:139.9745},
    {name:"柏神社",category:"temple_shrine",lat:35.8688,lng:139.9768}
  ],
  nearest_house:{address:"千葉県柏市柏3-5-12",nameplate:"松本",lat:35.8681,lng:139.9763},
  narrowing_steps:[
    {step:1,question:"大きい道路沿いですか？細い道ですか？",options:["大きい道","細い道"],purpose:"幹線道路/生活道路の判定"},
    {step:2,question:"交差点の近くですか？",options:["はい","いいえ"],purpose:"交差点への絞り込み"},
    {step:3,question:null,dynamic:true,template:"{lm}は見えますか？",options:["はい","いいえ"],purpose:"ランドマーク確認"},
    {step:4,question:"一番近い家の表札を読んでいただけますか？",options:[],purpose:"表札から住所を逆引き"},
    {step:5,question:"近くの電柱に住所が書いてあります。見えますか？",options:["はい","いいえ"],purpose:"電柱記載の住所"}
  ]
},
area_c: {
  id:"area_c", name:"テナント変更地区（流山おおたかの森）",
  center:[139.9290,35.8717],
  scenario:{
    caller_says:"ABCコンサルティングの前です",search_query:"ABCコンサルティング",
    local_db:{name:"大成ビル",address:"千葉県流山市おおたかの森北1-2-3",registered:"2019年",lat:35.8717,lng:139.9290},
    external_result:{name:"ABCコンサルティング",address:"千葉県流山市おおたかの森北1-2-3 大成ビル3F",lat:35.8717,lng:139.9290},
    tenants:[{floor:1,name:"スターバックス おおたかの森店"},{floor:2,name:"ABC英会話スクール"},{floor:3,name:"ABCコンサルティング"},{floor:4,name:"流山税理士事務所"}]
  }
},
area_d: {
  id:"area_d", name:"類似マンション地区（鎌ケ谷）",
  center:[140.0010,35.7700],
  mansions:[
    {id:"D1",name:"ライオンズマンション鎌ケ谷第一",address:"千葉県鎌ケ谷市新鎌ケ谷1-10-1",lat:35.7703,lng:140.0008,floors:14,units:120,features:["道路沿い","14階建て","1階にローソンあり"],distinguishing:"道路沿いの棟・14階建て・1階にローソン"},
    {id:"D2",name:"ライオンズマンション鎌ケ谷第二",address:"千葉県鎌ケ谷市新鎌ケ谷1-10-5",lat:35.7698,lng:140.0015,floors:8,units:64,features:["奥の棟（道路から入る）","8階建て","向かいに公園"],distinguishing:"奥の棟・8階建て・向かいに公園"},
    {id:"D3",name:"ライオンズマンション鎌ケ谷第三",address:"千葉県鎌ケ谷市新鎌ケ谷2-3-1",lat:35.7710,lng:140.0020,floors:10,units:80,features:["線路沿い","10階建て","左にコンビニ"],distinguishing:"線路沿い・10階建て・左にコンビニ"}
  ],
  decision_tree:{q:"何階建てのマンションですか？",options:{"14階":{result:"D1",label:"ライオンズマンション鎌ケ谷第一"},"8階":{result:"D2",label:"ライオンズマンション鎌ケ谷第二"},"10階":{result:"D3",label:"ライオンズマンション鎌ケ谷第三"},"不明":{q:"1階にコンビニは入っていますか？",options:{"はい":{q:"ローソンですか？",options:{"はい":{result:"D1",label:"ライオンズマンション鎌ケ谷第一"},"いいえ":{result:"D3",label:"ライオンズマンション鎌ケ谷第三（左にコンビニ）"}}},"いいえ":{result:"D2",label:"ライオンズマンション鎌ケ谷第二"}}}}}
}
};

/* 検索用フラットレコード */
const ALL_RECORDS = [];
function buildIndex(){
  const a = DEMO.area_a;
  a.buildings.forEach(b=>{
    ALL_RECORDS.push({id:b.id,type:"address",text:b.address,nameplate:b.nameplate,building_name:null,building_type:b.type,floors:b.floors,lat:b.lat,lng:b.lng,area:"area_a",features:b.features});
    ALL_RECORDS.push({id:b.id,type:"nameplate",text:b.nameplate,nameplate:b.nameplate,building_name:null,building_type:b.type,floors:b.floors,lat:b.lat,lng:b.lng,area:"area_a",address:b.address,features:b.features});
  });
  a.pois.forEach(p=> ALL_RECORDS.push({id:"pa_"+p.name,type:"poi",text:p.name,name:p.name,category:p.category,lat:p.lat,lng:p.lng,area:"area_a",address:"千葉県松戸市松戸"}));
  const b2 = DEMO.area_b;
  b2.landmarks.forEach(l=> ALL_RECORDS.push({id:"pb_"+l.name,type:"poi",text:l.name,name:l.name,category:l.category,lat:l.lat,lng:l.lng,area:"area_b",address:"千葉県柏市柏"}));
  if(b2.nearest_house) ALL_RECORDS.push({id:"B1",type:"address",text:b2.nearest_house.address,nameplate:b2.nearest_house.nameplate,lat:b2.nearest_house.lat,lng:b2.nearest_house.lng,area:"area_b",address:b2.nearest_house.address});
  const c = DEMO.area_c;
  ALL_RECORDS.push({id:"C1",type:"address",text:c.scenario.local_db.address,building_name:c.scenario.local_db.name,lat:c.scenario.local_db.lat,lng:c.scenario.local_db.lng,area:"area_c",address:c.scenario.local_db.address});
  c.scenario.tenants.forEach(t=> ALL_RECORDS.push({id:"pc_"+t.name,type:"poi",text:t.name,name:t.name,category:"tenant",lat:c.center[1],lng:c.center[0],area:"area_c",address:c.scenario.local_db.address+" "+t.floor+"F"}));
  DEMO.area_d.mansions.forEach(m=>{
    ALL_RECORDS.push({id:m.id,type:"address",text:m.address+" "+m.name,building_name:m.name,building_type:"mansion",floors:m.floors,lat:m.lat,lng:m.lng,area:"area_d",address:m.address,features_arr:m.features,distinguishing:m.distinguishing,units:m.units});
  });
}
buildIndex();

/* ───────────────────────── 2. EventBus ───────────────────────── */
const Bus = {_l:{}, on(e,f){(this._l[e]||(this._l[e]=[])).push(f)}, emit(e,d){(this._l[e]||[]).forEach(f=>{try{f(d)}catch(x){console.error(x)}})}};

/* ───────────────────────── 3. Map ───────────────────────── */
let map, markers=[], gpsLayerReady=false, ctxLL=null;

function initMap(){
  map = new maplibregl.Map({
    container:"map",
    style:{
      version:8,
      sources:{
        osm:{type:"raster",tiles:[OSM_TILE],tileSize:256,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'},
        aerial:{type:"raster",tiles:[GSI_AERIAL],tileSize:256,attribution:'&copy; <a href="https://maps.gsi.go.jp/development/ichiran.html">国土地理院</a>'}
      },
      layers:[
        {id:"osm-layer",type:"raster",source:"osm",layout:{visibility:"visible"}},
        {id:"aerial-layer",type:"raster",source:"aerial",layout:{visibility:"none"}}
      ]
    },
    center:DEFAULT_CENTER,zoom:DEFAULT_ZOOM,maxZoom:19,minZoom:10,dragRotate:false
  });
  map.touchZoomRotate.disableRotation();
  map.addControl(new maplibregl.ScaleControl({maxWidth:200}),"bottom-right");
  map.addControl(new maplibregl.NavigationControl({showCompass:false}),"bottom-right");

  map.on("contextmenu",e=>{e.preventDefault();ctxLL=e.lngLat;showCtx(e.originalEvent.clientX,e.originalEvent.clientY)});
  map.on("click",hideCtx);
  document.addEventListener("click",e=>{if(!e.target.closest("#ctx-menu"))hideCtx()});

  map.on("load",()=>{
    map.addSource("gps-circle",{type:"geojson",data:{type:"FeatureCollection",features:[]}});
    map.addLayer({id:"gps-fill",type:"fill",source:"gps-circle",paint:{"fill-color":"rgba(52,152,219,0.12)"}});
    map.addLayer({id:"gps-line",type:"line",source:"gps-circle",paint:{"line-color":"#3498db","line-width":2,"line-dasharray":[4,4]}});
    gpsLayerReady=true;
  });

  // Layer toggle
  document.querySelectorAll(".layer-btn").forEach(b=>b.addEventListener("click",function(){
    document.querySelectorAll(".layer-btn").forEach(x=>x.classList.remove("active"));
    this.classList.add("active");
    const l=this.dataset.layer;
    map.setLayoutProperty("osm-layer","visibility",l==="aerial"?"none":"visible");
    map.setLayoutProperty("aerial-layer","visibility",l==="osm"?"none":"visible");
  }));

  // Context menu actions
  document.querySelectorAll(".ctx-item").forEach(it=>it.addEventListener("click",function(){
    if(!ctxLL)return;
    const a=this.dataset.action;
    if(a==="sv") showSV(ctxLL.lat,ctxLL.lng);
    else if(a==="nearby") searchNearby(ctxLL.lat,ctxLL.lng);
    else if(a==="reverse") reverseGeo(ctxLL.lat,ctxLL.lng);
    else if(a==="aerial") showAerial(ctxLL.lat,ctxLL.lng);
    hideCtx();
  }));
}

function showCtx(x,y){const m=document.getElementById("ctx-menu");m.classList.remove("hidden");m.style.left=x+"px";m.style.top=y+"px";const r=m.getBoundingClientRect();if(r.right>innerWidth)m.style.left=(x-r.width)+"px";if(r.bottom>innerHeight)m.style.top=(y-r.height)+"px"}
function hideCtx(){document.getElementById("ctx-menu").classList.add("hidden")}

function flyTo(lat,lng,z){map.flyTo({center:[lng,lat],zoom:z||18,duration:1500,essential:true})}
function fitBounds(pts,pad){if(!pts.length)return;const b=new maplibregl.LngLatBounds();pts.forEach(p=>b.extend([p.lng,p.lat]));map.fitBounds(b,{padding:pad||80,duration:1e3})}
function addMarker(lat,lng,opt){
  const el=document.createElement("div");el.className="marker "+(opt.cls||"");el.innerHTML=opt.label||"";if(opt.title)el.title=opt.title;
  const mk=new maplibregl.Marker({element:el}).setLngLat([lng,lat]).addTo(map);
  if(opt.popup)mk.setPopup(new maplibregl.Popup({maxWidth:"320px"}).setHTML(opt.popup));
  if(opt.click)el.addEventListener("click",e=>{e.stopPropagation();opt.click(lat,lng,mk)});
  markers.push(mk);return mk;
}
function clearMarkers(){markers.forEach(m=>m.remove());markers=[]}
function showGPSCircle(lat,lng,r){
  if(!gpsLayerReady)return;
  const pts=64,coords=[],dx=r/(111320*Math.cos(lat*Math.PI/180)),dy=r/110574;
  for(let i=0;i<pts;i++){const a=i/pts*2*Math.PI;coords.push([lng+dx*Math.cos(a),lat+dy*Math.sin(a)])}
  coords.push(coords[0]);
  map.getSource("gps-circle").setData({type:"FeatureCollection",features:[{type:"Feature",geometry:{type:"Polygon",coordinates:[coords]}}]});
}
function clearGPS(){if(gpsLayerReady)map.getSource("gps-circle").setData({type:"FeatureCollection",features:[]})}

function reverseGeo(lat,lng){
  // local DB first
  const near=ALL_RECORDS.filter(r=>r.type==="address"&&r.lat&&r.lng).map(r=>({...r,d:haversine(lat,lng,r.lat,r.lng)})).filter(r=>r.d<200).sort((a,b)=>a.d-b.d);
  if(near.length){
    const r=near[0];
    new maplibregl.Popup({maxWidth:"320px"}).setLngLat([lng,lat]).setHTML(`<div style="padding:8px"><b>${esc(r.address||r.text)}</b>${r.nameplate?`<br>表札: ${esc(r.nameplate)}`:""}<br><button onclick="confirmAddr('${esc(r.address||r.text)}')" style="margin-top:6px;padding:4px 12px;background:#27ae60;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:12px">この住所で確定</button></div>`).addTo(map);
  } else {
    // Nominatim fallback
    fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=ja&zoom=18`)
      .then(r=>r.json()).then(d=>{
        new maplibregl.Popup({maxWidth:"320px"}).setLngLat([lng,lat]).setHTML(`<div style="padding:8px"><b>${esc(d.display_name||"住所不明")}</b><br><span style="font-size:11px;color:#7f8c8d">出典: OpenStreetMap</span></div>`).addTo(map);
      }).catch(()=>{
        new maplibregl.Popup({maxWidth:"320px"}).setLngLat([lng,lat]).setHTML(`<div style="padding:8px">住所を取得できませんでした</div>`).addTo(map);
      });
  }
}

function searchNearby(lat,lng){
  const near=ALL_RECORDS.filter(r=>r.lat&&r.lng).map(r=>({...r,d:haversine(lat,lng,r.lat,r.lng)})).filter(r=>r.d<300).sort((a,b)=>a.d-b.d).slice(0,10);
  clearMarkers();
  addMarker(lat,lng,{cls:"gps-m",label:"✦",title:"検索中心"});
  near.forEach(r=>{
    addMarker(r.lat,r.lng,{cls:"poi-m",label:catIcon(r.category),title:r.name||r.nameplate||r.text,
      click:()=>{flyTo(r.lat,r.lng,18);showSV(r.lat,r.lng)}
    });
  });
  if(near.length)fitBounds([{lat,lng},...near.map(r=>({lat:r.lat,lng:r.lng}))],60);
}

/* ───────────────────────── 4. Aerial Panel ───────────────────────── */
let aerialMap=null;
function showAerial(lat,lng,z){
  const p=document.getElementById("aerial-panel");p.classList.remove("hidden");
  if(!aerialMap){
    aerialMap=new maplibregl.Map({container:"aerial-map",style:{version:8,sources:{a:{type:"raster",tiles:[GSI_AERIAL],tileSize:256}},layers:[{id:"a",type:"raster",source:"a"}]},center:[lng,lat],zoom:z||18,dragRotate:false,interactive:true,attributionControl:false});
  } else aerialMap.flyTo({center:[lng,lat],zoom:z||18,duration:800});
}
function hideAerial(){document.getElementById("aerial-panel").classList.add("hidden")}

/* ───────────────────────── 5. StreetView (GSI高ズーム代替) ───────────────────────── */
let svMap=null,svMks=[];
function showSV(lat,lng){
  const p=document.getElementById("sv-panel");p.classList.remove("hidden");
  const body=document.getElementById("sv-body");
  if(!svMap){
    body.innerHTML="";
    svMap=new maplibregl.Map({container:"sv-body",style:{version:8,sources:{a:{type:"raster",tiles:[GSI_AERIAL],tileSize:256},o:{type:"raster",tiles:[OSM_TILE],tileSize:256}},layers:[{id:"a",type:"raster",source:"a"},{id:"o",type:"raster",source:"o",paint:{"raster-opacity":0.4}}]},center:[lng,lat],zoom:19,dragRotate:false,interactive:true,attributionControl:false});
  } else svMap.flyTo({center:[lng,lat],zoom:19,duration:800});
  svMks.forEach(m=>m.remove());svMks=[];
  const el=document.createElement("div");el.style.cssText="width:14px;height:14px;background:#e74c3c;border:2px solid #fff;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,.3)";
  svMks.push(new maplibregl.Marker({element:el}).setLngLat([lng,lat]).addTo(svMap));
}
function hideSV(){document.getElementById("sv-panel").classList.add("hidden")}

// panel close buttons
document.addEventListener("DOMContentLoaded",()=>{
  document.querySelectorAll(".panel .panel-x").forEach(b=>{
    b.addEventListener("click",function(){this.closest(".panel").classList.add("hidden")});
  });
});

/* ───────────────────────── 6. Search Bar ───────────────────────── */
let searchTimer=null;
function initSearch(){
  const inp=document.getElementById("search-input"),clr=document.getElementById("search-clear"),res=document.getElementById("search-results");
  inp.addEventListener("input",function(){
    const q=this.value.trim();
    if(!q){res.classList.add("hidden");clr.classList.add("hidden");return}
    clr.classList.remove("hidden");
    if(searchTimer)clearTimeout(searchTimer);
    searchTimer=setTimeout(()=>doSearch(q),200);
  });
  inp.addEventListener("keydown",e=>{if(e.key==="Escape"){res.classList.add("hidden");inp.blur()}});
  clr.addEventListener("click",()=>{inp.value="";res.classList.add("hidden");clr.classList.add("hidden");inp.focus()});
  document.addEventListener("click",e=>{if(!e.target.closest("#search-wrap"))res.classList.add("hidden")});
}

function doSearch(q){
  const hits=ALL_RECORDS.filter(r=>r.text&&r.text.includes(q)).slice(0,15);
  const res=document.getElementById("search-results");
  if(!hits.length){
    res.innerHTML=`<div class="sr-item" style="justify-content:center;color:#95a5a6;cursor:default">「${esc(q)}」に一致する結果がありません</div>`;
    res.classList.remove("hidden");
    Bus.emit("search_no_hit",{query:q});
    return;
  }
  res.innerHTML=hits.map((r,i)=>{
    const ic=r.type==="nameplate"?"name":r.type==="poi"?"poi":"addr";
    const icText=r.type==="nameplate"?"📝":r.type==="poi"?"📍":"🏠";
    const main=r.type==="nameplate"?esc(r.nameplate)+"宅":r.type==="poi"?esc(r.name):esc(r.building_name?r.building_name+" ("+r.text+")":r.text);
    const sub=r.type==="nameplate"?esc(r.address||""):r.type==="poi"?esc(r.address||""):[r.nameplate?"表札:"+r.nameplate:"",typeLabel(r.building_type),r.floors?r.floors+"階建て":""].filter(Boolean).join(" / ");
    return `<div class="sr-item" data-i="${i}"><div class="sr-icon ${ic}">${icText}</div><div class="sr-text"><div class="sr-main">${main}</div><div class="sr-sub">${sub}</div></div></div>`;
  }).join("");
  res.classList.remove("hidden");

  res.querySelectorAll(".sr-item").forEach(el=>{
    el.addEventListener("click",function(){
      const r=hits[+this.dataset.i];if(!r)return;
      flyTo(r.lat,r.lng,18);
      res.classList.add("hidden");
      Bus.emit("search_selected",r);
    });
  });

  // Check multi-hit same address (T1)
  const addrHits=hits.filter(r=>r.type==="address");
  const byAddr={};addrHits.forEach(r=>{const k=r.address||r.text;(byAddr[k]||(byAddr[k]=[])).push(r)});
  for(const [addr,grp] of Object.entries(byAddr)){
    if(grp.length>=2) Bus.emit("multi_hit",{address:addr,candidates:grp,count:grp.length});
  }
  // Similar names (T6)
  const named=addrHits.filter(r=>r.building_name);
  if(named.length>=2){
    let pfx=named[0].building_name;
    for(let i=1;i<named.length;i++){while(named[i].building_name.indexOf(pfx)!==0&&pfx.length>0)pfx=pfx.slice(0,-1)}
    if(pfx.length>=3) Bus.emit("similar_names",{candidates:named,count:named.length,common_prefix:pfx});
  }
}

/* ───────────────────────── 7. Question Engine ───────────────────────── */
let qTree=null,qNode=null;
function qSet(tree){qTree=tree;qNode=tree}
function qGet(){
  if(!qNode||!qNode.q)return null;
  const opts=[];
  if("yes" in qNode&&"no" in qNode){
    opts.push({label:"はい",result:qNode.yes.result,rl:qNode.yes.label,next:qNode.yes.q?qNode.yes:null});
    opts.push({label:"いいえ",result:qNode.no.result,rl:qNode.no.label,next:qNode.no.q?qNode.no:null});
  } else if(qNode.options){
    for(const [k,v] of Object.entries(qNode.options))opts.push({label:k,result:v.result,rl:v.label,next:v.q?v:null});
  }
  return {question:qNode.q,options:opts};
}
function qAnswer(label){
  if(!qNode)return null;
  let next=null;
  if("yes" in qNode&&"no" in qNode) next=label==="はい"?qNode.yes:qNode.no;
  else if(qNode.options) next=qNode.options[label];
  if(!next)return null;
  if(next.result){qNode=null;return{type:"result",result:next.result,label:next.label}}
  if(next.q){qNode=next;return{type:"question",question:qGet()}}
  return null;
}

/* ───────────────────────── 8. AI Dialog ───────────────────────── */
let aiTimer=null;
function aiShow(color,icon,title,subtitle,bodyHtml){
  const d=document.getElementById("ai-dialog"),t=document.getElementById("ai-title"),s=document.getElementById("ai-subtitle"),b=document.getElementById("ai-body");
  d.style.borderLeftColor=color;d.querySelector(".ai-icon").style.background=color;d.querySelector(".ai-icon").textContent=icon;
  t.textContent=title;s.textContent=subtitle;b.innerHTML=bodyHtml;
  d.classList.remove("hidden");requestAnimationFrame(()=>d.classList.add("visible"));
  setAI("ai-suggest","AI: 提案あり");
  if(aiTimer)clearTimeout(aiTimer);
}
function aiHide(){const d=document.getElementById("ai-dialog");d.classList.remove("visible");setTimeout(()=>d.classList.add("hidden"),250);setAI("ai-idle","AI: 待機中")}
document.addEventListener("DOMContentLoaded",()=>{document.getElementById("ai-close").addEventListener("click",aiHide)});

function renderQ(q){
  if(!q)return"";
  return `<div class="qbox"><div class="qlabel">💬 確認してみてください</div><div class="qtext">「${esc(q.question)}」</div><div class="qopts">${q.options.map(o=>`<button class="qbtn" data-a="${esc(o.label)}"><span class="qbtn-arrow">→</span>${esc(o.label)}${o.rl?`<span class="qbtn-hint">${esc(o.rl)}</span>`:""}${o.next?'<span class="qbtn-hint">→ 次の質問</span>':""}</button>`).join("")}</div></div>`;
}
function attachQ(){
  document.querySelectorAll(".qbtn").forEach(b=>b.addEventListener("click",function(){
    const ans=this.dataset.a,r=qAnswer(ans),c=document.getElementById("q-container");if(!c)return;
    if(!r)return;
    if(r.type==="result"){
      c.innerHTML=`<div class="qbox ok"><div class="qlabel" style="color:#27ae60">✓ 特定完了</div><div class="qtext" style="color:#27ae60">${esc(r.label||r.result)}</div><button class="confirm-btn" onclick="Bus.emit('confirmed',{id:'${r.result}'})">この住所で確定</button></div>`;
      Bus.emit("identified",{id:r.result,label:r.label});
    } else if(r.type==="question"){
      c.innerHTML=renderQ(r.question);attachQ();
    }
  }));
}

/* ─── T1: 同一番地複数ヒット ─── */
function showT1(area,candidates){
  clearMarkers();
  candidates.forEach((c,i)=>{
    addMarker(c.lat,c.lng,{cls:"cand-m",label:String(i+1),title:(c.nameplate||"")+"宅",
      click:()=>{flyTo(c.lat,c.lng,19);showSV(c.lat,c.lng)}});
  });
  fitBounds(candidates.map(c=>({lat:c.lat,lng:c.lng})),100);
  const cl=candidates.reduce((s,c)=>s+c.lat,0)/candidates.length;
  const cn=candidates.reduce((s,c)=>s+c.lng,0)/candidates.length;
  showAerial(cl,cn,19);

  let candHtml=candidates.map((c,i)=>{
    const f=c.features||{};
    return `<div class="cand" data-lat="${c.lat}" data-lng="${c.lng}"><div><span class="cand-num">${i+1}</span><span class="cand-name">${esc(c.nameplate||c.building_name||"")}宅</span></div><div class="cand-feat">${esc(f.position||"")}</div><div class="cand-type">${typeLabel(c.type||c.building_type)}${c.floors?" "+c.floors+"階建て":""}</div></div>`;
  }).join("");

  let qHtml="";
  if(area.decision_tree){qSet(area.decision_tree);const q=qGet();if(q)qHtml=`<div class="ai-sec"><div class="ai-sec-title">確認質問</div><div id="q-container">${renderQ(q)}</div></div>`}

  let svHtml="";
  if(candidates.length<=3){
    svHtml=`<div class="ai-sec"><div class="ai-sec-title">航空写真比較</div><div class="sv-thumbs">${candidates.map((c,i)=>`<div class="sv-thumb" data-lat="${c.lat}" data-lng="${c.lng}"><span class="sv-thumb-label">${i+1}</span><div id="svt-${i}" style="width:100%;height:100%"></div></div>`).join("")}</div></div>`;
  }

  aiShow("#c0392b",String(candidates.length),`同番地に${candidates.length}軒あります`,area.common_address||candidates[0].address||"",
    `<div class="ai-sec"><div class="ai-sec-title">候補一覧</div>${candHtml}</div>${qHtml}${svHtml}`);

  // Candidate click
  document.querySelectorAll("#ai-body .cand").forEach(el=>el.addEventListener("click",function(){
    document.querySelectorAll(".cand").forEach(c=>c.classList.remove("sel"));this.classList.add("sel");
    flyTo(+this.dataset.lat,+this.dataset.lng,19);showSV(+this.dataset.lat,+this.dataset.lng);
  }));
  attachQ();

  // Init thumbnails
  if(candidates.length<=3)setTimeout(()=>candidates.forEach((c,i)=>{
    const el=document.getElementById("svt-"+i);if(!el||el.children.length)return;
    try{new maplibregl.Map({container:el,style:{version:8,sources:{a:{type:"raster",tiles:[GSI_AERIAL],tileSize:256}},layers:[{id:"a",type:"raster",source:"a"}]},center:[c.lng,c.lat],zoom:19,interactive:false,attributionControl:false})}catch(e){}
    el.parentElement.addEventListener("click",()=>showSV(c.lat,c.lng));
  }),400);
}

/* ─── T2: 住所確定遅延 ─── */
function showT2(result,area){
  const f=result.features||{};
  let neighbors=[];
  if(f.right&&!f.right.startsWith("(")) neighbors.push({dir:"玄関の右隣",icon:"→",name:f.right+"さん宅",dist:"隣接"});
  if(f.left&&!f.left.startsWith("(")) neighbors.push({dir:"玄関の左隣",icon:"←",name:f.left+"さん宅",dist:"隣接"});
  if(f.across&&!f.across.startsWith("(")) neighbors.push({dir:"道路渡って向かい",icon:"↑",name:f.across,dist:"20m"});
  if(f.back&&!f.back.startsWith("(")) neighbors.push({dir:"裏手",icon:"↓",name:f.back+"さん宅",dist:"15m"});
  (area.pois||[]).forEach(p=>{const d=Math.round(haversine(result.lat,result.lng,p.lat,p.lng));if(d<200)neighbors.push({dir:"道沿い",icon:"↗",name:p.name,dist:d+"m"})});

  let ctxHtml=neighbors.map(n=>`<div class="ctx-row"><span class="ctx-dir">${n.icon}</span><span class="ctx-pos">${esc(n.dir)}</span><span class="ctx-name">${esc(n.name)}</span><span class="ctx-dist">${n.dist}</span></div>`).join("");

  const across=neighbors.find(n=>n.dir.includes("向かい"));
  const question=across?`道路を渡った向かいに${across.name}は見えますか？`:"角のお家ですか？並びの途中ですか？";
  const addr=result.address||result.text||"";

  aiShow("#e67e22","?","周辺情報",addr,
    `${ctxHtml?`<div class="ai-sec"><div class="ai-sec-title">周辺の目印</div>${ctxHtml}</div>`:""}
    <div class="ai-sec"><div class="ai-sec-title">確認質問</div><div class="qbox"><div class="qlabel">💬 確認してみてください</div><div class="qtext">「${esc(question)}」</div></div></div>
    <div class="ai-sec"><div class="conf-meter"><div class="conf-fill" style="width:55%;background:#e67e22"></div></div><div class="conf-label" style="color:#e67e22">確度: 中</div></div>
    <button class="confirm-btn" onclick="confirmAddr('${esc(addr)}')">この住所で確定</button>`);
  showSV(result.lat,result.lng);
}

/* ─── T3: GPS路上通報 ─── */
function showT3(area){
  const gps=area.gps_simulation.reported_gps;
  clearMarkers();
  flyTo(gps.lat,gps.lng,17);
  showGPSCircle(gps.lat,gps.lng,gps.accuracy_m);
  addMarker(gps.lat,gps.lng,{cls:"gps-m",label:"📡",title:"GPS (±"+gps.accuracy_m+"m)"});
  setGPS(gps.accuracy_m);

  const lms=(area.landmarks||[]).map(l=>({...l,d:Math.round(haversine(gps.lat,gps.lng,l.lat,l.lng))})).sort((a,b)=>a.d-b.d);
  lms.forEach(l=>{
    addMarker(l.lat,l.lng,{cls:"lm-m",label:catIcon(l.category),title:l.name+" ("+l.d+"m)",
      click:()=>{flyTo(l.lat,l.lng,18);showSV(l.lat,l.lng)}});
  });

  const steps=(area.narrowing_steps||[]).map((s,i)=>{
    let q=s.question;
    if(s.dynamic&&lms.length)q=(s.template||"").replace("{lm}",lms[0].name);
    return {...s,question:q};
  });

  let lmHtml=lms.slice(0,8).map(l=>`<div class="lm-item" data-lat="${l.lat}" data-lng="${l.lng}"><span class="lm-icon">${catIcon(l.category)}</span><span class="lm-name">${esc(l.name)}</span><span class="lm-dist">${l.d}m</span></div>`).join("");
  let stHtml=steps.map((s,i)=>`<div class="nstep${i===0?" act":""}" data-step="${i}"><span class="step-n">${i+1}</span><span style="font-size:11px;color:#7f8c8d">${esc(s.purpose||"")}</span><div class="step-q">「${esc(s.question||"")}」</div>${s.options&&s.options.length?`<div class="step-opts">${s.options.map(o=>`<button class="step-btn" data-step="${i}" data-ans="${esc(o)}">${esc(o)}</button>`).join("")}</div>`:""}</div>`).join("");

  aiShow("#3498db","GPS","路上通報 — 場所の絞り込み","GPS精度: "+gps.accuracy_m+"m",
    `<div class="ai-sec"><div class="ai-sec-title">周辺の目印（距離順）</div>${lmHtml}</div><div class="ai-sec"><div class="ai-sec-title">絞り込みフロー</div>${stHtml}</div>`);

  showSV(gps.lat,gps.lng);

  // Landmark click
  document.querySelectorAll(".lm-item").forEach(el=>el.addEventListener("click",function(){flyTo(+this.dataset.lat,+this.dataset.lng,18);showSV(+this.dataset.lat,+this.dataset.lng)}));
  // Step buttons
  document.querySelectorAll(".step-btn").forEach(b=>b.addEventListener("click",function(){
    const s=+this.dataset.step;
    const cur=document.querySelector(`.nstep[data-step="${s}"]`);if(cur){cur.classList.remove("act");cur.classList.add("done");this.style.background="#27ae60";this.style.color="#fff"}
    const nxt=document.querySelector(`.nstep[data-step="${s+1}"]`);if(nxt)nxt.classList.add("act");
  }));
}

/* ─── T4: DB該当なし ─── */
function showT4(area){
  const sc=area.scenario;
  const ext=sc.external_result;
  clearMarkers();
  if(ext){addMarker(ext.lat,ext.lng,{cls:"search-m",label:"🔍",title:ext.name});flyTo(ext.lat,ext.lng,18);showSV(ext.lat,ext.lng)}

  let resHtml=ext?`<div class="poi-r" data-lat="${ext.lat}" data-lng="${ext.lng}"><div class="poi-r-name">${esc(ext.name)} <span class="ext-badge">外部検索</span></div><div class="poi-r-addr">📍 ${esc(ext.address)}</div><div style="font-size:11px;color:#7f8c8d;margin-top:4px">消防DB: ${esc(sc.local_db.name)} (${sc.local_db.registered})</div><div class="poi-r-acts"><button class="poi-btn" onclick="showSV(${ext.lat},${ext.lng})">ストリートビュー確認</button><button class="poi-btn cfm" onclick="confirmAddr('${esc(ext.address)}')">この住所で確定</button></div></div>`:`<div style="color:#95a5a6;font-size:13px;padding:8px">外部検索結果なし</div>`;

  let tenHtml="";
  if(sc.tenants&&sc.tenants.length){
    tenHtml=`<div class="ai-sec"><div class="ai-sec-title">同じビルの情報</div><div class="tenant-list">${sc.tenants.map(t=>`<div class="tenant-row${t.name.includes(sc.search_query)?" hl":""}"><span class="tenant-fl">${t.floor}F:</span><span class="tenant-nm">${esc(t.name)}</span></div>`).join("")}</div></div>`;
  }

  aiShow("#8e44ad","🔍","DB該当なし — 外部検索",`「${sc.caller_says}」`,
    `<div class="ai-sec"><div class="ai-sec-title">検索結果</div>${resHtml}</div>${tenHtml}`);
}

/* ─── T6: 類似名称 ─── */
function showT6(area){
  const ms=area.mansions;
  clearMarkers();
  ms.forEach((m,i)=>{
    addMarker(m.lat,m.lng,{cls:"cand-m",label:String(i+1),title:m.name,
      click:()=>{flyTo(m.lat,m.lng,18);showSV(m.lat,m.lng)}});
  });
  fitBounds(ms.map(m=>({lat:m.lat,lng:m.lng})),80);
  const cl=ms.reduce((s,m)=>s+m.lat,0)/ms.length, cn=ms.reduce((s,m)=>s+m.lng,0)/ms.length;
  showAerial(cl,cn,16);

  let candHtml=ms.map((m,i)=>`<div class="cand" data-lat="${m.lat}" data-lng="${m.lng}"><div><span class="cand-num">${i+1}</span><span class="cand-name">${esc(m.name)}</span></div><div class="cand-type" style="padding-left:32px">${esc(m.address)}</div><div class="cand-type" style="padding-left:32px">${m.floors}階建て / ${m.units}戸</div><div class="feat-tags">${(m.features||[]).map(f=>`<span class="feat-tag">${esc(f)}</span>`).join("")}</div>${m.distinguishing?`<div class="cand-feat">${esc(m.distinguishing)}</div>`:""}</div>`).join("");

  let qHtml="";
  if(area.decision_tree){qSet(area.decision_tree);const q=qGet();if(q)qHtml=`<div class="ai-sec"><div class="ai-sec-title">確認質問</div><div id="q-container">${renderQ(q)}</div></div>`}

  aiShow("#2c3e50","🏢",`類似名称 ${ms.length}件`,`「ライオンズマンション鎌ケ谷...」`,
    `<div class="ai-sec"><div class="ai-sec-title">候補一覧</div>${candHtml}</div>${qHtml}`);

  document.querySelectorAll("#ai-body .cand").forEach(el=>el.addEventListener("click",function(){
    document.querySelectorAll(".cand").forEach(c=>c.classList.remove("sel"));this.classList.add("sel");
    flyTo(+this.dataset.lat,+this.dataset.lng,18);showSV(+this.dataset.lat,+this.dataset.lng);
  }));
  attachQ();
}

/* ───────────────────────── 9. State / Timer / UI ───────────────────────── */
let callActive=false, callStart=0, timerIv=null, gpsData=null, scenario=null, t2Timer=null, t3Timer=null;

function setCallBadge(cls,txt){const el=document.getElementById("call-status");el.className="badge "+cls;el.textContent=txt}
function setGPS(acc){
  const el=document.getElementById("gps-badge");
  if(acc==null){el.className="badge gps-none";el.textContent="GPS: --";return}
  if(acc<=50){el.className="badge gps-hi";el.textContent="GPS: ±"+acc+"m (高精度)"}
  else if(acc<=200){el.className="badge gps-mid";el.textContent="GPS: ±"+acc+"m"}
  else{el.className="badge gps-low";el.textContent="GPS: ±"+acc+"m (低精度)"}
}
function setAI(cls,txt){const el=document.getElementById("ai-badge");el.className="badge "+cls;el.textContent=txt}

function startTimer(){
  callStart=Date.now();
  const el=document.getElementById("call-timer");
  if(timerIv)clearInterval(timerIv);
  timerIv=setInterval(()=>{
    const s=Math.floor((Date.now()-callStart)/1e3);
    el.textContent=String(Math.floor(s/60)).padStart(2,"0")+":"+String(s%60).padStart(2,"0");
  },1e3);
}
function stopTimer(){if(timerIv)clearInterval(timerIv);document.getElementById("call-timer").textContent="00:00"}

/* global confirm helper */
window.confirmAddr = function(addr){
  callActive=false;setCallBadge("confirmed","確定済み");setAI("ai-idle","AI: 待機中");
  if(aiTimer)clearTimeout(aiTimer);
  aiTimer=setTimeout(aiHide,10000);
  setDemoStatus("確定: "+addr);
};
window.Bus = Bus;

/* ───────────────────────── 10. Demo Simulator ───────────────────────── */
function initDemo(){
  const selSc=document.getElementById("demo-scenario");
  const btnS=document.getElementById("btn-start"),btnE=document.getElementById("btn-end"),btnG=document.getElementById("btn-gps"),btnSr=document.getElementById("btn-search"),btn15=document.getElementById("btn-skip15"),btn20=document.getElementById("btn-skip20");

  function setButtons(active){
    btnS.disabled=active;btnE.disabled=!active;btnG.disabled=!active;btnSr.disabled=!active;btn15.disabled=!active;btn20.disabled=!active;selSc.disabled=active;
  }

  selSc.addEventListener("change",function(){
    if(callActive)return;
    const a=DEMO[this.value];if(a&&a.center)flyTo(a.center[1],a.center[0],15);
  });

  btnS.addEventListener("click",()=>{
    scenario=selSc.value;callActive=true;gpsData=null;
    clearMarkers();clearGPS();aiHide();hideAerial();hideSV();
    if(t2Timer)clearTimeout(t2Timer);if(t3Timer)clearTimeout(t3Timer);
    setButtons(true);setCallBadge("active","受付中");setGPS(null);setAI("ai-idle","AI: 待機中");startTimer();
    const a=DEMO[scenario];if(a&&a.center)flyTo(a.center[1],a.center[0],15);
    setDemoStatus("シナリオ: "+a.name+" - 通報受付中");
  });

  btnE.addEventListener("click",()=>{
    callActive=false;gpsData=null;scenario=null;
    if(t2Timer)clearTimeout(t2Timer);if(t3Timer)clearTimeout(t3Timer);
    setButtons(false);setCallBadge("idle","待機中");setGPS(null);stopTimer();aiHide();hideAerial();hideSV();clearMarkers();clearGPS();
    setDemoStatus("デモモード: 待機中");
  });

  btnG.addEventListener("click",()=>{
    const a=DEMO[scenario];if(!a)return;
    let gps;
    if(scenario==="area_b"&&a.gps_simulation) gps=a.gps_simulation.reported_gps;
    else if(a.center) gps={lat:a.center[1]+(Math.random()-.5)*.001,lng:a.center[0]+(Math.random()-.5)*.001,accuracy_m:100+Math.floor(Math.random()*100)};
    if(!gps)return;
    gpsData=gps;
    flyTo(gps.lat,gps.lng,17);showGPSCircle(gps.lat,gps.lng,gps.accuracy_m);
    addMarker(gps.lat,gps.lng,{cls:"gps-m",label:"📡",title:"GPS (±"+gps.accuracy_m+"m)"});
    setGPS(gps.accuracy_m);
    setDemoStatus("GPS送信: ±"+gps.accuracy_m+"m");
    // T3 delay
    if(t3Timer)clearTimeout(t3Timer);
    t3Timer=setTimeout(()=>{if(callActive&&gpsData&&scenario==="area_b")triggerT3()},20000);
  });

  btnSr.addEventListener("click",()=>{
    if(!scenario)return;
    if(scenario==="area_a") triggerT1();
    else if(scenario==="area_b") triggerT3();
    else if(scenario==="area_c") triggerT4();
    else if(scenario==="area_d") triggerT6();
    setDemoStatus("検索シミュレート: "+{area_a:"T1 同一番地",area_b:"T3 路上通報",area_c:"T4 DB該当なし",area_d:"T6 類似名称"}[scenario]);
  });

  btn15.addEventListener("click",()=>{
    callStart-=15e3;setDemoStatus("+15秒スキップ");
    // T2 check
    if(t2Timer){clearTimeout(t2Timer);checkT2Force()}
  });
  btn20.addEventListener("click",()=>{
    callStart-=20e3;setDemoStatus("+20秒スキップ");
    // T3 check
    if(t3Timer&&gpsData&&scenario==="area_b"){clearTimeout(t3Timer);triggerT3()}
  });

  Bus.on("identified",data=>{
    const a=DEMO[scenario];if(!a)return;
    let tgt=null;
    if(a.buildings)tgt=a.buildings.find(b=>b.id===data.id);
    if(!tgt&&a.mansions)tgt=a.mansions.find(m=>m.id===data.id);
    if(tgt){addMarker(tgt.lat,tgt.lng,{cls:"ok-m",label:"✓",title:data.label||"特定完了"});flyTo(tgt.lat,tgt.lng,19);showSV(tgt.lat,tgt.lng)}
  });
  Bus.on("confirmed",data=>{
    const a=DEMO[scenario];if(!a)return;
    let addr="";
    if(a.buildings){const b=a.buildings.find(x=>x.id===data.id);if(b)addr=b.address}
    if(!addr&&a.mansions){const m=a.mansions.find(x=>x.id===data.id);if(m)addr=m.address}
    if(addr)confirmAddr(addr);
  });
}

function triggerT1(){
  const a=DEMO.area_a;if(!a)return;
  setAI("ai-busy","AI: 解析中");
  setTimeout(()=>showT1(a,a.buildings),300);
}
function triggerT3(){
  const a=DEMO.area_b;if(!a)return;
  setAI("ai-busy","AI: 解析中");
  setTimeout(()=>showT3(a),300);
}
function triggerT4(){
  const a=DEMO.area_c;if(!a)return;
  setAI("ai-busy","AI: 解析中");
  setTimeout(()=>showT4(a),300);
}
function triggerT6(){
  const a=DEMO.area_d;if(!a)return;
  setAI("ai-busy","AI: 解析中");
  setTimeout(()=>showT6(a),300);
}

let lastSearchResult=null;
Bus.on("search_selected",r=>{lastSearchResult=r;if(t2Timer)clearTimeout(t2Timer);t2Timer=setTimeout(()=>{if(callActive&&lastSearchResult&&!document.getElementById("ai-dialog").classList.contains("visible"))checkT2Force()},15000)});
function checkT2Force(){
  if(!lastSearchResult||!callActive)return;
  const a=DEMO[scenario];if(!a)return;
  let bld=null;
  if(a.buildings)bld=a.buildings.find(b=>b.id===lastSearchResult.id);
  if(bld){setAI("ai-busy","AI: 解析中");setTimeout(()=>showT2(bld,a),300)}
}

function setDemoStatus(t){document.getElementById("demo-status").textContent=t}

/* ───────────────────────── INIT ───────────────────────── */
document.addEventListener("DOMContentLoaded",()=>{
  initMap();
  initSearch();
  initDemo();
});

})();
