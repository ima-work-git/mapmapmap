/* ═══════════════════════════════════════════════════════════════
   119番 住所特定AI支援 地図システム — app.js (GitHub Pages)
   会話文字起こし連動 + Google Street View popup
   ═══════════════════════════════════════════════════════════════ */
(function(){
"use strict";

/* ─── 0. Helpers ─── */
const OSM="https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const GSI="https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg";
const esc=s=>s?String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"):"";
const hav=(a,b,c,d)=>{const R=6371e3,p=Math.PI/180,x=Math.sin((c-a)*p/2)**2+Math.cos(a*p)*Math.cos(c*p)*Math.sin((d-b)*p/2)**2;return R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x))};
const typeL=t=>({detached:"戸建て",apartment:"アパート",mansion:"マンション",store:"店舗",office:"ビル"})[t]||"";
const catI=c=>({intersection:"🚦",convenience_store:"🏪",gas_station:"⛽",park:"🌳",school:"🏫",temple_shrine:"⛩",parking:"🅿",tenant:"🏢",store:"🏬"})[c]||"📍";

/* ═══════════════════ 1. DEMO DATA ═══════════════════ */
const DEMO={
area_a:{id:"area_a",name:"同一番地密集地区（松戸駅付近）",center:[139.9011,35.7838],common_address:"千葉県松戸市松戸1234番地",
  buildings:[
    {id:"A1",np:"鈴木",type:"detached",fl:2,lat:35.78385,lng:139.90105,eb:180,addr:"千葉県松戸市松戸1234番地",feat:{pos:"角地（T字路の角）",r:"田中",l:"(道路)",ac:"セブンイレブン",bk:"山本"}},
    {id:"A2",np:"山田",type:"detached",fl:2,lat:35.78375,lng:139.90115,eb:180,addr:"千葉県松戸市松戸1234番地",feat:{pos:"並びの2軒目",r:"佐藤",l:"鈴木",ac:"月極駐車場",bk:"山本"}},
    {id:"A3",np:"佐藤",type:"detached",fl:2,lat:35.78365,lng:139.90125,eb:180,addr:"千葉県松戸市松戸1234番地",feat:{pos:"公園の隣",r:"高橋",l:"山田",ac:"松戸中央公園入口",bk:"中村"}},
    {id:"A4",np:"高橋",type:"apartment",fl:3,lat:35.78355,lng:139.90135,eb:180,addr:"千葉県松戸市松戸1234番地",feat:{pos:"3階建てアパート",r:"渡辺",l:"佐藤",ac:"松戸中央公園",bk:"小林"}},
    {id:"A5",np:"渡辺",type:"detached",fl:2,lat:35.78345,lng:139.90145,eb:180,addr:"千葉県松戸市松戸1234番地",feat:{pos:"突き当たり（行き止まり）",r:"(壁)",l:"高橋",ac:"(空き地)",bk:"加藤"}}
  ],
  pois:[{name:"セブンイレブン松戸駅前店",cat:"convenience_store",lat:35.78390,lng:139.90090},{name:"松戸中央公園",cat:"park",lat:35.78360,lng:139.90090}],
  dtree:{q:"角の家ですか？",yes:{result:"A1",label:"❶ 鈴木宅"},no:{q:"突き当たりの家ですか？",yes:{result:"A5",label:"❺ 渡辺宅"},no:{q:"向かいに公園は見えますか？",yes:{q:"3階建てですか？",yes:{result:"A4",label:"❹ 高橋宅"},no:{result:"A3",label:"❸ 佐藤宅"}},no:{result:"A2",label:"❷ 山田宅"}}}}
},
area_b:{id:"area_b",name:"路上通報想定地区（柏駅付近）",center:[139.9757,35.8681],
  gps:{lat:35.8680,lng:139.9755,acc:150},
  landmarks:[
    {name:"柏駅前交差点",cat:"intersection",lat:35.8685,lng:139.9762,heading:45},
    {name:"柏駅南口交差点",cat:"intersection",lat:35.8672,lng:139.9748,heading:180},
    {name:"ファミリーマート柏駅東口店",cat:"convenience_store",lat:35.8678,lng:139.9758,heading:270},
    {name:"セブンイレブン柏中央店",cat:"convenience_store",lat:35.8683,lng:139.9745,heading:90},
    {name:"ローソン柏駅南口店",cat:"convenience_store",lat:35.8670,lng:139.9760,heading:0},
    {name:"ENEOS 柏中央SS",cat:"gas_station",lat:35.8675,lng:139.9750,heading:180},
    {name:"柏市立柏第一小学校",cat:"school",lat:35.8690,lng:139.9745,heading:0},
    {name:"柏神社",cat:"temple_shrine",lat:35.8688,lng:139.9768,heading:270},
    {name:"マツモトキヨシ柏駅前店",cat:"store",lat:35.8680,lng:139.9770,heading:90},
    {name:"タイムズ柏駅前駐車場",cat:"parking",lat:35.8676,lng:139.9742,heading:0}
  ]
},
area_c:{id:"area_c",name:"テナント変更地区（流山おおたかの森）",center:[139.9290,35.8717],
  building:{name:"大成ビル",addr:"千葉県流山市おおたかの森北1-2-3",reg:"2019年",lat:35.8717,lng:139.9290},
  ext:{name:"ABCコンサルティング",addr:"千葉県流山市おおたかの森北1-2-3 大成ビル3F",lat:35.8717,lng:139.9290},
  tenants:[{fl:1,name:"スターバックス おおたかの森店"},{fl:2,name:"ABC英会話スクール"},{fl:3,name:"ABCコンサルティング"},{fl:4,name:"流山税理士事務所"}]
},
area_d:{id:"area_d",name:"類似マンション地区（鎌ケ谷）",center:[140.0010,35.7700],
  mansions:[
    {id:"D1",name:"ライオンズマンション鎌ケ谷第一",addr:"千葉県鎌ケ谷市新鎌ケ谷1-10-1",lat:35.7703,lng:140.0008,fl:14,units:120,feats:["道路沿い","14階建て","1階にローソンあり"],dist:"道路沿い・14階建て・1階にローソン"},
    {id:"D2",name:"ライオンズマンション鎌ケ谷第二",addr:"千葉県鎌ケ谷市新鎌ケ谷1-10-5",lat:35.7698,lng:140.0015,fl:8,units:64,feats:["奥の棟（道路から入る）","8階建て","向かいに公園"],dist:"奥の棟・8階建て・向かいに公園"},
    {id:"D3",name:"ライオンズマンション鎌ケ谷第三",addr:"千葉県鎌ケ谷市新鎌ケ谷2-3-1",lat:35.7710,lng:140.0020,fl:10,units:80,feats:["線路沿い","10階建て","左にコンビニ"],dist:"線路沿い・10階建て・左にコンビニ"}
  ],
  dtree:{q:"何階建てのマンションですか？",options:{"14階":{result:"D1",label:"ライオンズマンション鎌ケ谷第一"},"8階":{result:"D2",label:"ライオンズマンション鎌ケ谷第二"},"10階":{result:"D3",label:"ライオンズマンション鎌ケ谷第三"},"不明":{q:"1階にコンビニは入っていますか？",options:{"はい":{q:"ローソンですか？",options:{"はい":{result:"D1",label:"第一（1階ローソン）"},"いいえ":{result:"D3",label:"第三（左にコンビニ）"}}},"いいえ":{result:"D2",label:"第二（向かいに公園）"}}}}}
}};

/* ═══════════════════ 2. SCENARIO TRANSCRIPTS ═══════════════════ */
/* speaker: C=通報者, D=指令員, S=システム
   action: fly, gps, markers_t1, trigger_t1, sv, q_answer, trigger_t3, trigger_t4, trigger_t6, highlight, confirm */

const SCRIPTS={
area_a:[
  {s:"C",t:"もしもし、119番です！救急をお願いします！"},
  {s:"D",t:"はい、119番消防です。救急ですね。ご住所をお願いします。"},
  {s:"C",t:"千葉県松戸市松戸の1234番地です。"},
  {s:"D",t:"松戸市松戸1234番地ですね。確認します。",a:{type:"fly",lat:35.7838,lng:139.9011,z:17}},
  {s:"S",t:"住所検索: 「松戸1234番地」→ 5軒ヒット（同一番地）",a:{type:"markers_t1"}},
  {s:"S",t:"⚡ T1発火: 同番地に5軒あります — AI支援パネル表示",a:{type:"trigger_t1"}},
  {s:"D",t:"1234番地にお宅が何軒かあるようです。山田さんのお宅でよろしいですか？"},
  {s:"C",t:"はい、山田です。"},
  {s:"D",t:"角の家ですか？"},
  {s:"C",t:"いいえ、角ではないです。",a:{type:"q_answer",ans:"いいえ"}},
  {s:"D",t:"突き当たりのお宅ですか？"},
  {s:"C",t:"いいえ、違います。",a:{type:"q_answer",ans:"いいえ"}},
  {s:"D",t:"お向かいに公園は見えますか？"},
  {s:"C",t:"いいえ、公園は見えません。向かいは駐車場です。",a:{type:"q_answer",ans:"いいえ"}},
  {s:"S",t:"✓ 特定完了: ❷ 山田宅（並びの2軒目・向かいに月極駐車場）",a:{type:"highlight",id:"A2"}},
  {s:"D",t:"山田さん宅、向かいが駐車場のお宅ですね。すぐに救急車を向かわせます。"},
  {s:"C",t:"お願いします！"},
  {s:"S",t:"📍 住所確定: 千葉県松戸市松戸1234番地 山田宅",a:{type:"confirm",id:"A2"}},
],
area_b:[
  {s:"C",t:"あの、事故です！車と自転車がぶつかって…！"},
  {s:"D",t:"119番消防です。おケガされた方はいますか？"},
  {s:"C",t:"はい、自転車の人が倒れてます！場所は柏駅の近くですが、住所がわかりません…"},
  {s:"D",t:"大丈夫です。GPS情報を確認しますね。",a:{type:"fly",lat:35.8681,lng:139.9757,z:15}},
  {s:"S",t:"📡 GPS受信: 35.8680, 139.9755（精度 ±150m）",a:{type:"gps"}},
  {s:"S",t:"⚡ T3発火: 路上通報 — GPS誤差円+周辺ランドマーク表示",a:{type:"trigger_t3"}},
  {s:"D",t:"GPS情報が入りました。大きい道路沿いですか？交差点の近くですか？"},
  {s:"C",t:"はい！大きい道路で、信号のある交差点のすぐそばです！",a:{type:"sv_gallery",cat:"intersection"}},
  {s:"S",t:"🚦 交差点候補: 2件 — 右パネルにストリートビュー表示"},
  {s:"D",t:"近くにコンビニやお店は見えますか？"},
  {s:"C",t:"コンビニが見えます！",a:{type:"sv_gallery",cat:"convenience_store"}},
  {s:"S",t:"🏪 コンビニ候補: 3件 — 距離順にストリートビュー表示中"},
  {s:"D",t:"何のコンビニですか？ファミリーマート？セブンイレブン？ローソン？"},
  {s:"C",t:"ファミリーマートです！ファミマのすぐ前です！",a:{type:"sv_gallery_narrow",name:"ファミリーマート柏駅東口店"}},
  {s:"S",t:"✓ 場所特定: ファミリーマート柏駅東口店 付近",a:{type:"highlight_lm",name:"ファミリーマート柏駅東口店"}},
  {s:"D",t:"ファミリーマート柏駅東口店の前ですね。すぐに救急車を向かわせます。"},
  {s:"C",t:"お願いします！急いでください！"},
  {s:"S",t:"📍 場所確定: ファミリーマート柏駅東口店前（柏市柏）",a:{type:"confirm_lm"}},
],
area_c:[
  {s:"C",t:"あの、会社の人が急に倒れて…救急車をお願いします！"},
  {s:"D",t:"119番消防です。場所はどちらですか？"},
  {s:"C",t:"ABCコンサルティングです。オフィスの中です。"},
  {s:"D",t:"ABCコンサルティング…確認します。",a:{type:"fly",lat:35.8717,lng:139.9290,z:17}},
  {s:"S",t:"住所検索: 「ABCコンサルティング」→ 消防DBヒットなし",a:{type:"no_hit"}},
  {s:"S",t:"⚡ T4発火: DB該当なし — 外部検索実行",a:{type:"trigger_t4"}},
  {s:"D",t:"大成ビルの3階にあるABCコンサルティングさんでしょうか？"},
  {s:"C",t:"はい、そうです！大成ビルです。"},
  {s:"D",t:"1階にスターバックスが入っているビルですか？",a:{type:"sv",lat:35.8717,lng:139.9290,h:0}},
  {s:"C",t:"はい！1階がスタバのビルです！"},
  {s:"S",t:"✓ 確認一致: 大成ビル3F ABCコンサルティング",a:{type:"highlight_c"}},
  {s:"D",t:"流山市おおたかの森北1-2-3、大成ビル3階ですね。何階で待っていればいいですか？"},
  {s:"C",t:"3階のオフィスにいます。エレベーターがあります。"},
  {s:"S",t:"📍 住所確定: 千葉県流山市おおたかの森北1-2-3 大成ビル3F",a:{type:"confirm_c"}},
],
area_d:[
  {s:"C",t:"マンションの廊下で人が倒れています！救急車を！"},
  {s:"D",t:"119番消防です。マンション名と住所をお願いします。"},
  {s:"C",t:"ライオンズマンション鎌ケ谷です。"},
  {s:"D",t:"ライオンズマンション鎌ケ谷ですね。確認します。",a:{type:"fly",lat:35.7700,lng:140.0010,z:15}},
  {s:"S",t:"住所検索: 「ライオンズマンション鎌ケ谷」→ 3件の類似名称がヒット",a:{type:"markers_t6"}},
  {s:"S",t:"⚡ T6発火: 類似名称3件 — 第一・第二・第三",a:{type:"trigger_t6"}},
  {s:"D",t:"ライオンズマンションが3つあるのですが、何階建てのマンションですか？"},
  {s:"C",t:"うーん…よくわかりません。結構高いです。",a:{type:"q_answer_d",ans:"不明"}},
  {s:"D",t:"1階にコンビニは入っていますか？"},
  {s:"C",t:"はい、入ってます！",a:{type:"q_answer_d",ans:"はい"}},
  {s:"D",t:"ローソンですか？"},
  {s:"C",t:"はい、ローソンです！",a:{type:"q_answer_d",ans:"はい"}},
  {s:"S",t:"✓ 特定完了: ライオンズマンション鎌ケ谷第一（14階建て・1階ローソン）",a:{type:"highlight_d",id:"D1"}},
  {s:"D",t:"ライオンズマンション鎌ケ谷第一ですね。何階の廊下ですか？",a:{type:"sv",lat:35.7703,lng:140.0008,h:0}},
  {s:"C",t:"5階です。エレベーターの前です。"},
  {s:"S",t:"📍 住所確定: 千葉県鎌ケ谷市新鎌ケ谷1-10-1 ライオンズマンション鎌ケ谷第一 5階廊下",a:{type:"confirm_d",id:"D1"}},
]};

/* ═══════════════════ 3. MAP ═══════════════════ */
let map,markers=[],gpsReady=false,ctxLL=null;

function initMap(){
  map=new maplibregl.Map({container:"map",style:{version:8,sources:{osm:{type:"raster",tiles:[OSM],tileSize:256,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'},aerial:{type:"raster",tiles:[GSI],tileSize:256,attribution:'&copy; 国土地理院'}},layers:[{id:"osm-l",type:"raster",source:"osm",layout:{visibility:"visible"}},{id:"aerial-l",type:"raster",source:"aerial",layout:{visibility:"none"}}]},center:[139.9034,35.7847],zoom:14,maxZoom:19,minZoom:10,dragRotate:false});
  map.touchZoomRotate.disableRotation();
  map.addControl(new maplibregl.ScaleControl({maxWidth:200}),"bottom-right");
  map.addControl(new maplibregl.NavigationControl({showCompass:false}),"bottom-right");
  map.on("contextmenu",e=>{e.preventDefault();ctxLL=e.lngLat;const m=document.getElementById("ctx-menu");m.classList.remove("hidden");m.style.left=e.originalEvent.clientX+"px";m.style.top=e.originalEvent.clientY+"px"});
  map.on("click",()=>document.getElementById("ctx-menu").classList.add("hidden"));
  document.addEventListener("click",e=>{if(!e.target.closest("#ctx-menu"))document.getElementById("ctx-menu").classList.add("hidden")});
  map.on("load",()=>{
    map.addSource("gps-c",{type:"geojson",data:{type:"FeatureCollection",features:[]}});
    map.addLayer({id:"gps-f",type:"fill",source:"gps-c",paint:{"fill-color":"rgba(52,152,219,0.12)"}});
    map.addLayer({id:"gps-l",type:"line",source:"gps-c",paint:{"line-color":"#3498db","line-width":2,"line-dasharray":[4,4]}});
    gpsReady=true;
  });
  document.querySelectorAll(".layer-btn").forEach(b=>b.addEventListener("click",function(){
    document.querySelectorAll(".layer-btn").forEach(x=>x.classList.remove("active"));this.classList.add("active");
    const l=this.dataset.layer;
    map.setLayoutProperty("osm-l","visibility",l==="aerial"?"none":"visible");
    map.setLayoutProperty("aerial-l","visibility",l==="osm"?"none":"visible");
  }));
  document.querySelectorAll(".ctx-item").forEach(it=>it.addEventListener("click",function(){
    if(!ctxLL)return;const a=this.dataset.action;
    if(a==="sv")openSV(ctxLL.lat,ctxLL.lng);
    else if(a==="nearby")searchNearby(ctxLL.lat,ctxLL.lng);
    else if(a==="reverse")reverseGeo(ctxLL.lat,ctxLL.lng);
    else if(a==="aerial")showAerial(ctxLL.lat,ctxLL.lng);
    document.getElementById("ctx-menu").classList.add("hidden");
  }));
}

function flyTo(lat,lng,z){map.flyTo({center:[lng,lat],zoom:z||18,duration:1500,essential:true})}
function fitB(pts,p){if(!pts.length)return;const b=new maplibregl.LngLatBounds();pts.forEach(v=>b.extend([v.lng,v.lat]));map.fitBounds(b,{padding:p||80,duration:1e3})}
function addM(lat,lng,o){
  const el=document.createElement("div");el.className="marker "+(o.cls||"");el.innerHTML=o.label||"";if(o.title)el.title=o.title;
  const mk=new maplibregl.Marker({element:el}).setLngLat([lng,lat]).addTo(map);
  if(o.popup)mk.setPopup(new maplibregl.Popup({maxWidth:"320px"}).setHTML(o.popup));
  if(o.click)el.addEventListener("click",e=>{e.stopPropagation();o.click()});
  markers.push(mk);return mk;
}
function clearM(){markers.forEach(m=>m.remove());markers=[]}
function showGPS(lat,lng,r){
  if(!gpsReady)return;const pts=64,cs=[],dx=r/(111320*Math.cos(lat*Math.PI/180)),dy=r/110574;
  for(let i=0;i<pts;i++){const a=i/pts*2*Math.PI;cs.push([lng+dx*Math.cos(a),lat+dy*Math.sin(a)])}cs.push(cs[0]);
  map.getSource("gps-c").setData({type:"FeatureCollection",features:[{type:"Feature",geometry:{type:"Polygon",coordinates:[cs]}}]});
}
function clearGPS(){if(gpsReady)map.getSource("gps-c").setData({type:"FeatureCollection",features:[]})}

function reverseGeo(lat,lng){
  fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=ja&zoom=18`)
    .then(r=>r.json()).then(d=>{new maplibregl.Popup({maxWidth:"320px"}).setLngLat([lng,lat]).setHTML(`<div style="padding:8px"><b>${esc(d.display_name||"不明")}</b></div>`).addTo(map)}).catch(()=>{});
}
function searchNearby(lat,lng){
  const a=DEMO[curScenario];if(!a)return;
  let items=[];
  if(a.pois)items=items.concat(a.pois.map(p=>({...p,d:Math.round(hav(lat,lng,p.lat,p.lng))})));
  if(a.landmarks)items=items.concat(a.landmarks.map(l=>({...l,d:Math.round(hav(lat,lng,l.lat,l.lng))})));
  items.sort((a,b)=>a.d-b.d);
  items.slice(0,8).forEach(it=>{addM(it.lat,it.lng,{cls:"poi-m",label:catI(it.cat),title:it.name+" ("+it.d+"m)"})});
}

/* ═══════════════════ 4. STREET VIEW POPUP ═══════════════════ */
let svWin=null;
function openSV(lat,lng,heading){
  const h=heading||0;
  const url=`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}&heading=${h}&pitch=0&fov=90`;
  if(svWin&&!svWin.closed){svWin.location.href=url}
  else{svWin=window.open(url,"sv119","width=640,height=480,toolbar=no,menubar=no,location=no,status=no,scrollbars=no,resizable=yes")}
  // Show indicator
  const ind=document.getElementById("sv-indicator");
  ind.classList.remove("hidden");
  document.getElementById("svi-addr").textContent=lat.toFixed(4)+", "+lng.toFixed(4);
  document.getElementById("svi-open").onclick=()=>openSV(lat,lng,heading);
}
window.closeSV=function(){document.getElementById("sv-indicator").classList.add("hidden");if(svWin&&!svWin.closed)svWin.close();svWin=null};
window.openSV=openSV;

/* ═══════════════════ 4b. SV GALLERY (multiple candidates) ═══════════════════ */
const catNames={intersection:"交差点",convenience_store:"コンビニ",gas_station:"ガソリンスタンド",store:"店舗",school:"学校",temple_shrine:"神社・寺",parking:"駐車場"};

function svEmbedUrl(lat,lng,heading){
  return`https://maps.google.com/maps?layer=c&cbll=${lat},${lng}&cbp=12,${heading||0},0,0,0&output=svembed`;
}

function showSVGallery(cat){
  const a=DEMO.area_b,g=a.gps;
  const lms=a.landmarks.filter(l=>l.cat===cat).map(l=>({...l,d:Math.round(hav(g.lat,g.lng,l.lat,l.lng))})).sort((x,y)=>x.d-y.d);
  if(!lms.length)return;
  const show=lms.slice(0,5);

  aiHide();

  const panel=document.getElementById("sv-gallery");
  const body=document.getElementById("svg-body");
  panel.querySelector(".svg-title").textContent="📷 "+(catNames[cat]||cat)+" のストリートビュー";
  panel.querySelector(".svg-count").textContent=show.length+"件";

  body.innerHTML=show.map((l,i)=>`<div class="svg-entry" data-name="${esc(l.name)}" data-lat="${l.lat}" data-lng="${l.lng}" data-h="${l.heading||0}">
    <div class="svg-entry-hd">
      <span class="svg-rank">${i+1}</span>
      <span class="svg-icon">${catI(l.cat)}</span>
      <span class="svg-name">${esc(l.name)}</span>
      <span class="svg-dist">${l.d}m</span>
      <button class="svg-popup-btn" title="別ウィンドウで拡大表示">⛶</button>
    </div>
    <div class="svg-frame-wrap">
      <iframe class="svg-frame" src="${svEmbedUrl(l.lat,l.lng,l.heading)}" allowfullscreen loading="lazy" referrerpolicy="no-referrer"></iframe>
    </div>
  </div>`).join("");

  // Header click → select + fly to
  body.querySelectorAll(".svg-entry-hd").forEach(hd=>{
    hd.addEventListener("click",function(e){
      if(e.target.closest(".svg-popup-btn"))return;
      const entry=this.closest(".svg-entry");
      body.querySelectorAll(".svg-entry").forEach(x=>x.classList.remove("active"));
      entry.classList.add("active");
      flyTo(+entry.dataset.lat,+entry.dataset.lng,18);
    });
  });

  // Popup button → open SV in separate window
  body.querySelectorAll(".svg-popup-btn").forEach(btn=>{
    btn.addEventListener("click",function(e){
      e.stopPropagation();
      const entry=this.closest(".svg-entry");
      openSV(+entry.dataset.lat,+entry.dataset.lng,+entry.dataset.h);
    });
  });

  // Highlight matching markers on map
  markers.forEach(mk=>{
    const el=mk.getElement();
    if(el&&el.title){
      const isMatch=show.some(l=>el.title.includes(l.name));
      if(isMatch){el.style.transform="scale(1.3)";el.style.zIndex="10"}
      else{el.style.transform="";el.style.zIndex=""}
    }
  });

  panel.classList.remove("hidden");
  requestAnimationFrame(()=>panel.classList.add("visible"));
}

function narrowSVGallery(name){
  const body=document.getElementById("svg-body");
  body.querySelectorAll(".svg-entry").forEach(el=>{
    if(el.dataset.name===name){
      el.classList.add("active");
      el.classList.remove("eliminated");
      if(!el.querySelector(".svg-match-label")){
        const lbl=document.createElement("div");
        lbl.className="svg-match-label";
        lbl.textContent="✓ 通報者の発言と一致";
        el.appendChild(lbl);
      }
      flyTo(+el.dataset.lat,+el.dataset.lng,18);
    }else{
      el.classList.add("eliminated");
    }
  });
}

function hideSVGallery(){
  const panel=document.getElementById("sv-gallery");
  panel.classList.remove("visible");
  setTimeout(()=>panel.classList.add("hidden"),300);
  // Reset marker highlights
  markers.forEach(mk=>{const el=mk.getElement();if(el){el.style.transform="";el.style.zIndex=""}});
}
window.hideSVGallery=hideSVGallery;

/* ═══════════════════ 5. AERIAL PANEL ═══════════════════ */
let aerialMap=null;
function showAerial(lat,lng,z){
  document.getElementById("aerial-panel").classList.remove("hidden");
  if(!aerialMap){aerialMap=new maplibregl.Map({container:"aerial-map",style:{version:8,sources:{a:{type:"raster",tiles:[GSI],tileSize:256}},layers:[{id:"a",type:"raster",source:"a"}]},center:[lng,lat],zoom:z||18,dragRotate:false,interactive:true,attributionControl:false})}
  else aerialMap.flyTo({center:[lng,lat],zoom:z||18,duration:800});
}
window.hideAerial=function(){document.getElementById("aerial-panel").classList.add("hidden")};

/* ═══════════════════ 6. SEARCH BAR ═══════════════════ */
const ALL=[];
function buildIndex(){
  DEMO.area_a.buildings.forEach(b=>{
    ALL.push({type:"addr",text:b.addr,np:b.np,bt:b.type,fl:b.fl,lat:b.lat,lng:b.lng,area:"area_a"});
    ALL.push({type:"np",text:b.np,np:b.np,addr:b.addr,lat:b.lat,lng:b.lng,area:"area_a"});
  });
  DEMO.area_a.pois.forEach(p=>ALL.push({type:"poi",text:p.name,name:p.name,cat:p.cat,lat:p.lat,lng:p.lng,area:"area_a"}));
  DEMO.area_b.landmarks.forEach(l=>ALL.push({type:"poi",text:l.name,name:l.name,cat:l.cat,lat:l.lat,lng:l.lng,area:"area_b"}));
  ALL.push({type:"addr",text:DEMO.area_c.building.addr,bname:DEMO.area_c.building.name,lat:DEMO.area_c.building.lat,lng:DEMO.area_c.building.lng,area:"area_c"});
  DEMO.area_c.tenants.forEach(t=>ALL.push({type:"poi",text:t.name,name:t.name,cat:"tenant",lat:DEMO.area_c.building.lat,lng:DEMO.area_c.building.lng,area:"area_c"}));
  DEMO.area_d.mansions.forEach(m=>ALL.push({type:"addr",text:m.addr+" "+m.name,bname:m.name,bt:"mansion",fl:m.fl,lat:m.lat,lng:m.lng,area:"area_d"}));
}

function initSearch(){
  const inp=document.getElementById("search-input"),clr=document.getElementById("search-clear"),res=document.getElementById("search-results");
  let tm;
  inp.addEventListener("input",function(){
    const q=this.value.trim();if(!q){res.classList.add("hidden");clr.classList.add("hidden");return}
    clr.classList.remove("hidden");clearTimeout(tm);tm=setTimeout(()=>doSearch(q),200);
  });
  inp.addEventListener("keydown",e=>{if(e.key==="Escape"){res.classList.add("hidden");inp.blur()}});
  clr.addEventListener("click",()=>{inp.value="";res.classList.add("hidden");clr.classList.add("hidden")});
  document.addEventListener("click",e=>{if(!e.target.closest("#search-wrap"))res.classList.add("hidden")});
}
function doSearch(q){
  const hits=ALL.filter(r=>r.text&&r.text.includes(q)).slice(0,12);
  const res=document.getElementById("search-results");
  if(!hits.length){res.innerHTML=`<div class="sr-item" style="justify-content:center;color:#95a5a6;cursor:default">「${esc(q)}」該当なし</div>`;res.classList.remove("hidden");return}
  res.innerHTML=hits.map((r,i)=>`<div class="sr-item" data-i="${i}"><div class="sr-icon ${r.type==="np"?"name":r.type==="poi"?"poi":"addr"}">${r.type==="np"?"📝":r.type==="poi"?"📍":"🏠"}</div><div class="sr-text"><div class="sr-main">${esc(r.type==="np"?r.np+"宅":r.name||r.bname||r.text)}</div><div class="sr-sub">${esc(r.addr||r.text||"")}</div></div></div>`).join("");
  res.classList.remove("hidden");
  res.querySelectorAll(".sr-item").forEach(el=>el.addEventListener("click",function(){const r=hits[+this.dataset.i];if(r)flyTo(r.lat,r.lng,18);res.classList.add("hidden")}));
}

/* ═══════════════════ 7. QUESTION ENGINE ═══════════════════ */
let qNode=null;
function qSet(tree){qNode=tree}
function qGet(){
  if(!qNode||!qNode.q)return null;
  const opts=[];
  if("yes"in qNode&&"no"in qNode){opts.push({l:"はい",r:qNode.yes.result,rl:qNode.yes.label,nx:qNode.yes.q?qNode.yes:null});opts.push({l:"いいえ",r:qNode.no.result,rl:qNode.no.label,nx:qNode.no.q?qNode.no:null})}
  else if(qNode.options)for(const[k,v]of Object.entries(qNode.options))opts.push({l:k,r:v.result,rl:v.label,nx:v.q?v:null});
  return{question:qNode.q,options:opts};
}
function qAns(label){
  if(!qNode)return null;let nx;
  if("yes"in qNode&&"no"in qNode)nx=label==="はい"?qNode.yes:qNode.no;
  else if(qNode.options)nx=qNode.options[label];
  if(!nx)return null;
  if(nx.result){qNode=null;return{type:"result",result:nx.result,label:nx.label}}
  if(nx.q){qNode=nx;return{type:"question",q:qGet()}}
  return null;
}

/* ═══════════════════ 8. AI DIALOG ═══════════════════ */
function aiShow(color,icon,title,sub,html){
  const d=document.getElementById("ai-dialog");
  d.style.borderLeftColor=color;d.querySelector(".ai-icon").style.background=color;d.querySelector(".ai-icon").textContent=icon;
  document.getElementById("ai-title").textContent=title;
  document.getElementById("ai-subtitle").textContent=sub;
  document.getElementById("ai-body").innerHTML=html;
  d.classList.remove("hidden");requestAnimationFrame(()=>d.classList.add("visible"));
  setAI("ai-suggest","AI: 提案あり");
}
function aiHide(){const d=document.getElementById("ai-dialog");d.classList.remove("visible");setTimeout(()=>d.classList.add("hidden"),250);setAI("ai-idle","AI: 待機中")}

function renderQ(q){
  if(!q)return"";
  return`<div class="qbox"><div class="qlabel">💬 確認してみてください</div><div class="qtext">「${esc(q.question)}」</div><div class="qopts">${q.options.map(o=>`<button class="qbtn" data-a="${esc(o.l)}"><span class="qbtn-arrow">→</span>${esc(o.l)}${o.rl?`<span class="qbtn-hint">${esc(o.rl)}</span>`:""}${o.nx?'<span class="qbtn-hint">→ 次の質問</span>':""}</button>`).join("")}</div></div>`;
}
function attachQ(){
  document.querySelectorAll("#ai-body .qbtn").forEach(b=>b.addEventListener("click",function(){
    const r=qAns(this.dataset.a),c=document.getElementById("q-ctr");if(!c||!r)return;
    if(r.type==="result")c.innerHTML=`<div class="qbox ok"><div class="qlabel" style="color:#27ae60">✓ 特定完了</div><div class="qtext" style="color:#27ae60">${esc(r.label||r.result)}</div></div>`;
    else if(r.type==="question"){c.innerHTML=renderQ(r.q);attachQ()}
  }));
}

/* ─── T1 ─── */
function showT1(){
  const a=DEMO.area_a,bs=a.buildings;
  let html=`<div class="ai-sec"><div class="ai-sec-title">候補一覧（クリックで地図移動+SV表示）</div>`;
  bs.forEach((b,i)=>{html+=`<div class="cand" data-lat="${b.lat}" data-lng="${b.lng}" data-eb="${b.eb}"><div><span class="cand-num">${i+1}</span><span class="cand-name">${esc(b.np)}宅</span></div><div class="cand-feat">${esc(b.feat.pos)}</div><div class="cand-type">${typeL(b.type)}${b.fl?" "+b.fl+"階建て":""}</div></div>`});
  html+=`</div>`;
  if(a.dtree){qSet(a.dtree);const q=qGet();if(q)html+=`<div class="ai-sec"><div class="ai-sec-title">確認質問</div><div id="q-ctr">${renderQ(q)}</div></div>`}
  aiShow("#c0392b",String(bs.length),`同番地に${bs.length}軒あります`,a.common_address,html);
  document.querySelectorAll("#ai-body .cand").forEach(el=>el.addEventListener("click",function(){
    document.querySelectorAll(".cand").forEach(c=>c.classList.remove("sel"));this.classList.add("sel");
    const lat=+this.dataset.lat,lng=+this.dataset.lng,eb=+this.dataset.eb;
    flyTo(lat,lng,19);openSV(lat,lng,(eb+180)%360);
  }));
  attachQ();
}

/* ─── T3 ─── */
function showT3(){
  const a=DEMO.area_b,g=a.gps;
  const lms=a.landmarks.map(l=>({...l,d:Math.round(hav(g.lat,g.lng,l.lat,l.lng))})).sort((a,b)=>a.d-b.d);
  lms.forEach(l=>addM(l.lat,l.lng,{cls:"lm-m",label:catI(l.cat),title:l.name+" ("+l.d+"m)",click:()=>{flyTo(l.lat,l.lng,18);openSV(l.lat,l.lng)}}));
  let html=`<div class="ai-sec"><div class="ai-sec-title">周辺の目印（距離順・クリックでSV表示）</div>`;
  lms.slice(0,8).forEach(l=>{html+=`<div class="lm-item" data-lat="${l.lat}" data-lng="${l.lng}"><span class="lm-icon">${catI(l.cat)}</span><span class="lm-name">${esc(l.name)}</span><span class="lm-dist">${l.d}m</span></div>`});
  html+=`</div>`;
  const steps=[{q:"大きい道路沿いですか？細い道ですか？",o:["大きい道","細い道"],p:"道路種別の判定"},{q:"交差点の近くですか？",o:["はい","いいえ"],p:"交差点絞り込み"},{q:lms[0].name+"は見えますか？",o:["はい","いいえ"],p:"ランドマーク確認"},{q:"一番近い家の表札を読んでいただけますか？",o:[],p:"表札から逆引き"},{q:"近くの電柱に住所が書いてあります",o:["はい","いいえ"],p:"電柱住所"}];
  html+=`<div class="ai-sec"><div class="ai-sec-title">絞り込みフロー</div>`;
  steps.forEach((s,i)=>{html+=`<div class="nstep${i===0?" act":""}" data-step="${i}"><span class="step-n">${i+1}</span><span style="font-size:11px;color:#7f8c8d">${esc(s.p)}</span><div class="step-q">「${esc(s.q)}」</div>${s.o.length?`<div class="step-opts">${s.o.map(o=>`<button class="step-btn" data-s="${i}">${esc(o)}</button>`).join("")}</div>`:""}</div>`});
  html+=`</div>`;
  aiShow("#3498db","GPS","路上通報 — 場所の絞り込み","GPS精度: ±"+g.acc+"m",html);
  document.querySelectorAll(".lm-item").forEach(el=>el.addEventListener("click",function(){flyTo(+this.dataset.lat,+this.dataset.lng,18);openSV(+this.dataset.lat,+this.dataset.lng)}));
  document.querySelectorAll(".step-btn").forEach(b=>b.addEventListener("click",function(){
    const s=+this.dataset.s,cur=document.querySelector(`.nstep[data-step="${s}"]`);
    if(cur){cur.classList.remove("act");cur.classList.add("done");this.style.background="#27ae60";this.style.color="#fff"}
    const nx=document.querySelector(`.nstep[data-step="${s+1}"]`);if(nx)nx.classList.add("act");
  }));
}

/* ─── T4 ─── */
function showT4(){
  const a=DEMO.area_c,ext=a.ext;
  let html=`<div class="ai-sec"><div class="ai-sec-title">検索結果</div><div class="poi-r"><div class="poi-r-name">${esc(ext.name)}<span class="ext-badge">外部検索</span></div><div class="poi-r-addr">📍 ${esc(ext.addr)}</div><div style="font-size:11px;color:#7f8c8d;margin-top:4px">消防DB: ${esc(a.building.name)} (${a.building.reg})</div><div class="poi-r-acts"><button class="poi-btn" onclick="openSV(${ext.lat},${ext.lng})">📷 ストリートビュー確認</button></div></div></div>`;
  html+=`<div class="ai-sec"><div class="ai-sec-title">同じビルの情報</div><div class="tenant-list">${a.tenants.map(t=>`<div class="tenant-row${t.name.includes("ABCコンサル")?" hl":""}"><span class="tenant-fl">${t.fl}F:</span><span class="tenant-nm">${esc(t.name)}</span></div>`).join("")}</div></div>`;
  aiShow("#8e44ad","🔍","DB該当なし — 外部検索",`「ABCコンサルティング」`,html);
}

/* ─── T6 ─── */
function showT6(){
  const a=DEMO.area_d,ms=a.mansions;
  let html=`<div class="ai-sec"><div class="ai-sec-title">候補一覧（クリックで地図移動+SV表示）</div>`;
  ms.forEach((m,i)=>{html+=`<div class="cand" data-lat="${m.lat}" data-lng="${m.lng}"><div><span class="cand-num">${i+1}</span><span class="cand-name">${esc(m.name)}</span></div><div class="cand-type" style="padding-left:32px">${esc(m.addr)}</div><div class="cand-type" style="padding-left:32px">${m.fl}階建て / ${m.units}戸</div><div class="feat-tags">${m.feats.map(f=>`<span class="feat-tag">${esc(f)}</span>`).join("")}</div></div>`});
  html+=`</div>`;
  if(a.dtree){qSet(a.dtree);const q=qGet();if(q)html+=`<div class="ai-sec"><div class="ai-sec-title">確認質問</div><div id="q-ctr">${renderQ(q)}</div></div>`}
  aiShow("#2c3e50","🏢",`類似名称 ${ms.length}件`,`「ライオンズマンション鎌ケ谷…」`,html);
  document.querySelectorAll("#ai-body .cand").forEach(el=>el.addEventListener("click",function(){
    document.querySelectorAll(".cand").forEach(c=>c.classList.remove("sel"));this.classList.add("sel");
    flyTo(+this.dataset.lat,+this.dataset.lng,18);openSV(+this.dataset.lat,+this.dataset.lng);
  }));
  attachQ();
}

/* ═══════════════════ 9. UI STATE ═══════════════════ */
let timerIv=null,callStart=0;
function setBadge(id,cls,txt){const e=document.getElementById(id);e.className="badge "+cls;e.textContent=txt}
function setAI(cls,txt){setBadge("ai-badge",cls,txt)}
function setGPSBadge(acc){
  if(acc==null){setBadge("gps-badge","gps-none","GPS: --");return}
  if(acc<=50)setBadge("gps-badge","gps-hi","GPS: ±"+acc+"m");
  else if(acc<=200)setBadge("gps-badge","gps-mid","GPS: ±"+acc+"m");
  else setBadge("gps-badge","gps-low","GPS: ±"+acc+"m (低)");
}
function startTimer(){callStart=Date.now();const el=document.getElementById("call-timer");if(timerIv)clearInterval(timerIv);timerIv=setInterval(()=>{const s=Math.floor((Date.now()-callStart)/1e3);el.textContent=String(Math.floor(s/60)).padStart(2,"0")+":"+String(s%60).padStart(2,"0")},1e3)}
function stopTimer(){if(timerIv)clearInterval(timerIv);document.getElementById("call-timer").textContent="00:00"}

/* ═══════════════════ 10. TRANSCRIPT PLAYER ═══════════════════ */
let curScenario=null,curStep=-1,curScript=null;

function initPlayer(){
  const btnStart=document.getElementById("btn-start"),btnReset=document.getElementById("btn-reset"),btnNext=document.getElementById("btn-next"),sel=document.getElementById("demo-scenario");

  sel.addEventListener("change",function(){if(!curScript){const a=DEMO[this.value];if(a)flyTo(a.center[1],a.center[0],15)}});

  btnStart.addEventListener("click",()=>{
    curScenario=sel.value;curScript=SCRIPTS[curScenario];curStep=-1;
    resetUI();
    setBadge("call-status","active","受付中");startTimer();
    const a=DEMO[curScenario];if(a)flyTo(a.center[1],a.center[0],15);
    btnStart.classList.add("hidden");btnReset.classList.remove("hidden");sel.disabled=true;
    btnNext.disabled=false;
    document.getElementById("transcript-lines").innerHTML="";
    document.getElementById("step-counter").textContent=`0 / ${curScript.length}`;
  });

  btnReset.addEventListener("click",()=>{
    curScript=null;curStep=-1;curScenario=null;
    resetUI();stopTimer();
    btnStart.classList.remove("hidden");btnReset.classList.add("hidden");sel.disabled=false;
    btnNext.disabled=true;
    document.getElementById("transcript-lines").innerHTML=`<div class="tl-placeholder">← シナリオを選択して「開始」をクリック</div>`;
    document.getElementById("step-counter").textContent="";
  });

  btnNext.addEventListener("click",advance);
}

function advance(){
  if(!curScript)return;
  curStep++;
  if(curStep>=curScript.length){
    document.getElementById("btn-next").disabled=true;
    return;
  }
  const line=curScript[curStep];
  appendLine(line);
  if(line.a)execAction(line.a);
  document.getElementById("step-counter").textContent=`${curStep+1} / ${curScript.length}`;
  if(curStep>=curScript.length-1)document.getElementById("btn-next").disabled=true;
}

function appendLine(line){
  const container=document.getElementById("transcript-lines");
  const speakerMap={C:"通報者",D:"指令員",S:"System"};
  const clsMap={C:"caller",D:"dispatcher",S:"system"};
  const div=document.createElement("div");
  div.className="tl"+(line.s==="S"?" system-line":"");
  div.innerHTML=`<span class="tl-speaker ${clsMap[line.s]}">${speakerMap[line.s]}</span><span class="tl-text">${esc(line.t)}</span>`;
  container.appendChild(div);
  // Auto-scroll
  const area=document.getElementById("transcript-area");
  area.scrollTop=area.scrollHeight;
}

function execAction(a){
  const t=a.type;
  if(t==="fly") flyTo(a.lat,a.lng,a.z||17);
  else if(t==="gps"){
    const g=DEMO.area_b.gps;
    clearM();flyTo(g.lat,g.lng,17);showGPS(g.lat,g.lng,g.acc);
    addM(g.lat,g.lng,{cls:"gps-m",label:"📡",title:"GPS ±"+g.acc+"m"});
    setGPSBadge(g.acc);
  }
  else if(t==="markers_t1"){
    clearM();
    DEMO.area_a.buildings.forEach((b,i)=>{
      addM(b.lat,b.lng,{cls:"cand-m",label:String(i+1),title:b.np+"宅",click:()=>{flyTo(b.lat,b.lng,19);openSV(b.lat,b.lng,(b.eb+180)%360)}});
    });
    fitB(DEMO.area_a.buildings.map(b=>({lat:b.lat,lng:b.lng})),100);
    showAerial(35.78365,139.90125,19);
  }
  else if(t==="trigger_t1"){setAI("ai-busy","AI: 解析中");setTimeout(()=>showT1(),400)}
  else if(t==="trigger_t3"){setAI("ai-busy","AI: 解析中");setTimeout(()=>showT3(),400)}
  else if(t==="no_hit"){}/* visual only, text in transcript */
  else if(t==="trigger_t4"){setAI("ai-busy","AI: 解析中");clearM();addM(DEMO.area_c.ext.lat,DEMO.area_c.ext.lng,{cls:"search-m",label:"🔍",title:DEMO.area_c.ext.name});flyTo(DEMO.area_c.ext.lat,DEMO.area_c.ext.lng,18);setTimeout(()=>showT4(),400)}
  else if(t==="markers_t6"){
    clearM();
    DEMO.area_d.mansions.forEach((m,i)=>{addM(m.lat,m.lng,{cls:"cand-m",label:String(i+1),title:m.name})});
    fitB(DEMO.area_d.mansions.map(m=>({lat:m.lat,lng:m.lng})),80);
    showAerial(35.7700,140.0010,16);
  }
  else if(t==="trigger_t6"){setAI("ai-busy","AI: 解析中");setTimeout(()=>showT6(),400)}
  else if(t==="sv") openSV(a.lat,a.lng,a.h||0);
  else if(t==="q_answer"){
    // Navigate area_a decision tree via AI dialog
    const r=qAns(a.ans),c=document.getElementById("q-ctr");
    if(c&&r){
      if(r.type==="result")c.innerHTML=`<div class="qbox ok"><div class="qlabel" style="color:#27ae60">✓ 特定完了</div><div class="qtext" style="color:#27ae60">${esc(r.label)}</div></div>`;
      else if(r.type==="question"){c.innerHTML=renderQ(r.q);attachQ()}
    }
  }
  else if(t==="q_answer_d"){
    const r=qAns(a.ans),c=document.getElementById("q-ctr");
    if(c&&r){
      if(r.type==="result")c.innerHTML=`<div class="qbox ok"><div class="qlabel" style="color:#27ae60">✓ 特定完了</div><div class="qtext" style="color:#27ae60">${esc(r.label)}</div></div>`;
      else if(r.type==="question"){c.innerHTML=renderQ(r.q);attachQ()}
    }
  }
  else if(t==="highlight"){
    const b=DEMO.area_a.buildings.find(x=>x.id===a.id);
    if(b){addM(b.lat,b.lng,{cls:"ok-m",label:"✓",title:"特定: "+b.np+"宅"});flyTo(b.lat,b.lng,19);openSV(b.lat,b.lng,(b.eb+180)%360)}
  }
  else if(t==="highlight_lm"){
    const lm=DEMO.area_b.landmarks.find(l=>l.name===a.name);
    if(lm){addM(lm.lat,lm.lng,{cls:"ok-m",label:"✓",title:"特定: "+lm.name});flyTo(lm.lat,lm.lng,19);openSV(lm.lat,lm.lng,lm.heading||0)}
  }
  else if(t==="highlight_c"){
    addM(DEMO.area_c.ext.lat,DEMO.area_c.ext.lng,{cls:"ok-m",label:"✓",title:"確認一致"});flyTo(DEMO.area_c.ext.lat,DEMO.area_c.ext.lng,19);
  }
  else if(t==="highlight_d"){
    const m=DEMO.area_d.mansions.find(x=>x.id===a.id);
    if(m){addM(m.lat,m.lng,{cls:"ok-m",label:"✓",title:"特定: "+m.name});flyTo(m.lat,m.lng,19);openSV(m.lat,m.lng)}
  }
  else if(t==="sv_gallery") showSVGallery(a.cat);
  else if(t==="sv_gallery_narrow") narrowSVGallery(a.name);
  else if(t==="confirm"||t==="confirm_lm"||t==="confirm_c"||t==="confirm_d"){
    setBadge("call-status","confirmed","確定済み");setAI("ai-idle","AI: 待機中");hideSVGallery();
  }
}

function resetUI(){
  clearM();clearGPS();aiHide();hideAerial();closeSV();hideSVGallery();
  setBadge("call-status","idle","待機中");setAI("ai-idle","AI: 待機中");setGPSBadge(null);
}

/* ═══════════════════ INIT ═══════════════════ */
document.addEventListener("DOMContentLoaded",()=>{
  buildIndex();initMap();initSearch();initPlayer();
  document.getElementById("ai-close").addEventListener("click",aiHide);
});

})();
