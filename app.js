/* ═══════════════════════════════════════════════════════════════
   119番 住所特定AI支援 地図システム — app.js (GitHub Pages)
   会話文字起こし連動 + Google Street View embed
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
  dtree:{q:"お宅の向かいには何がありますか？",options:{"コンビニ":{result:"A1",label:"❶ 鈴木宅（角地・向かいにセブンイレブン）"},"駐車場":{result:"A2",label:"❷ 山田宅（向かいに月極駐車場）"},"公園":{q:"お宅は3階建てですか？",options:{"はい":{result:"A4",label:"❹ 高橋宅（3階建てアパート）"},"いいえ":{result:"A3",label:"❸ 佐藤宅（公園の隣の戸建て）"}}},"空き地":{result:"A5",label:"❺ 渡辺宅（突き当たり・向かいに空き地）"}}}
},
area_b:{id:"area_b",name:"路上通報想定地区（柏駅付近）",center:[139.9740,35.8650],
  gps:{lat:35.8668,lng:139.9765,acc:150},
  landmarks:[
    {name:"旧水戸街道入口",cat:"intersection",lat:35.8673,lng:139.9781,heading:220},
    {name:"柏駅西口",cat:"intersection",lat:35.8636,lng:139.9680,heading:45},
    {name:"ローソン柏駅南口店",cat:"convenience_store",lat:35.8617,lng:139.9697,heading:0},
    {name:"ローソン柏駅東口店",cat:"convenience_store",lat:35.8623,lng:139.9716,heading:270},
    {name:"柏神社",cat:"temple_shrine",lat:35.8688,lng:139.9768,heading:270},
    {name:"マツモトキヨシ柏駅前店",cat:"store",lat:35.8630,lng:139.9720,heading:90}
  ]
},
area_c:{id:"area_c",name:"テナント変更地区（松戸駅西口）",center:[139.90017,35.78494],
  building:{name:"新角ビル",addr:"千葉県松戸市本町20-1",reg:"1973年",lat:35.78494,lng:139.90017},
  ext:{name:"Girls Bar Chelsea",addr:"千葉県松戸市本町20-1 新角ビル5F-B",lat:35.78494,lng:139.90017},
  tenants:[{fl:"B1",name:"Girls Bar Betty"},{fl:1,name:"テナント"},{fl:2,name:"えちご（居酒屋）"},{fl:5,name:"Girls Bar Chelsea"},{fl:7,name:"Malae（リラクゼーション）"},{fl:8,name:"テミス"},{fl:9,name:"UP STAIRS"}]
},
area_d:{id:"area_d",name:"類似マンション地区（鎌ケ谷）",center:[140.0010,35.7700],
  mansions:[
    {id:"D1",name:"ライオンズマンション鎌ケ谷第一",addr:"千葉県鎌ケ谷市新鎌ケ谷1-10-1",lat:35.7703,lng:140.0008,fl:14,units:120,feats:["道路沿い","14階建て","1階にローソンあり"],dist:"道路沿い・14階建て・1階にローソン"},
    {id:"D2",name:"ライオンズマンション鎌ケ谷第二",addr:"千葉県鎌ケ谷市新鎌ケ谷1-10-5",lat:35.7698,lng:140.0015,fl:8,units:64,feats:["奥の棟（道路から入る）","8階建て","向かいに公園"],dist:"奥の棟・8階建て・向かいに公園"},
    {id:"D3",name:"ライオンズマンション鎌ケ谷第三",addr:"千葉県鎌ケ谷市新鎌ケ谷2-3-1",lat:35.7710,lng:140.0020,fl:10,units:80,feats:["線路沿い","10階建て","左にコンビニ"],dist:"線路沿い・10階建て・左にコンビニ"}
  ],
  dtree:{q:"何階建てのマンションですか？",options:{"14階":{result:"D1",label:"ライオンズマンション鎌ケ谷第一"},"8階":{result:"D2",label:"ライオンズマンション鎌ケ谷第二"},"10階":{result:"D3",label:"ライオンズマンション鎌ケ谷第三"},"不明":{q:"1階にコンビニは入っていますか？",options:{"はい":{q:"ローソンですか？",options:{"はい":{result:"D1",label:"第一（1階ローソン）"},"いいえ":{result:"D3",label:"第三（左にコンビニ）"}}},"いいえ":{result:"D2",label:"第二（向かいに公園）"}}}}}
},
area_e:{id:"area_e",name:"路上通報・複数コンビニ（松戸駅周辺）",center:[139.9008,35.7840],
  gps:{lat:35.7835,lng:139.9010,acc:250},
  landmarks:[
    {name:"松戸駅前交差点",cat:"intersection",lat:35.7847,lng:139.9004,heading:0},
    {name:"岩瀬交差点",cat:"intersection",lat:35.7826,lng:139.9025,heading:90},
    {name:"ファミリーマート松戸駅前店",cat:"convenience_store",lat:35.78439163,lng:139.9012194,heading:0},
    {name:"ローソン松戸駅東口店",cat:"convenience_store",lat:35.78546098,lng:139.903454,heading:270},
    {name:"ミニストップ松戸駅前店",cat:"convenience_store",lat:35.7857,lng:139.9024,heading:200},
    {name:"松戸東口郵便局",cat:"store",lat:35.7856,lng:139.9026,heading:270},
    {name:"ENEOS松戸駅前SS",cat:"gas_station",lat:35.7836,lng:139.9000,heading:0},
    {name:"松戸中央公園",cat:"park",lat:35.78255,lng:139.90312,heading:135}
  ]
},
area_f:{id:"area_f",name:"類似団地棟地区（松戸・野菊野）",center:[139.9140,35.7795],
  mansions:[
    {id:"F1",name:"野菊野団地1号棟",addr:"千葉県松戸市野菊野 野菊野団地1",lat:35.7800,lng:139.9153,fl:14,units:150,feats:["管理事務所が近い","団地の東端","総合市場前バス停側"],dist:"管理事務所近く・東端"},
    {id:"F2",name:"野菊野団地2号棟",addr:"千葉県松戸市野菊野 野菊野団地2",lat:35.77972,lng:139.91481,fl:14,units:150,feats:["総合市場前バス停が最寄り(173m)","松戸南部市場の近く"],dist:"市場側・総合市場前バス停が近い"},
    {id:"F3",name:"野菊野団地3号棟",addr:"千葉県松戸市野菊野 野菊野団地3",lat:35.7795,lng:139.9144,fl:8,units:80,feats:["8階建て（団地内で最も低い）","団地中央部","集会所の近く"],dist:"8階建て・団地中央・集会所近く"},
    {id:"F4",name:"野菊野団地4号棟",addr:"千葉県松戸市野菊野 野菊野団地4",lat:35.77934,lng:139.91395,fl:14,units:150,feats:["野菊野団地バス停ロータリーが目の前(137m)","14階建て"],dist:"バス停ロータリーが目の前"},
    {id:"F5",name:"野菊野団地5号棟",addr:"千葉県松戸市野菊野 野菊野団地5",lat:35.7791,lng:139.9136,fl:14,units:150,feats:["1階に野菊野敬老ホーム","6号棟（郵便局・こども館）の隣","団地の西端"],dist:"敬老ホーム・6号棟の隣・西端"}
  ],
  pois:[
    {name:"松戸野菊野郵便局",cat:"store",lat:35.7789,lng:139.9133},
    {name:"野菊野団地バス停",cat:"intersection",lat:35.7791,lng:139.9130},
    {name:"総合市場前バス停",cat:"intersection",lat:35.7802,lng:139.9162},
    {name:"松戸南部市場",cat:"store",lat:35.7805,lng:139.9158},
    {name:"野菊野こども館",cat:"school",lat:35.7789,lng:139.9132},
    {name:"野菊野敬老ホーム",cat:"store",lat:35.7791,lng:139.9135},
    {name:"セブンイレブン松戸胡録台店",cat:"convenience_store",lat:35.7810,lng:139.9115}
  ],
  dtree:{q:"何号棟ですか？",options:{"1号棟":{result:"F1",label:"野菊野団地1号棟（14階建て・東端）"},"2号棟":{result:"F2",label:"野菊野団地2号棟（市場側）"},"3号棟":{result:"F3",label:"野菊野団地3号棟（8階建て・団地中央）"},"4号棟":{result:"F4",label:"野菊野団地4号棟（バス停ロータリー前）"},"5号棟":{result:"F5",label:"野菊野団地5号棟（敬老ホーム・西端）"},"わからない":{q:"建物は何階建てですか？",options:{"8階":{result:"F3",label:"3号棟（唯一の8階建て）"},"14階":{q:"近くに何が見えますか？",options:{"バス停・ロータリー":{result:"F4",label:"4号棟（バス停ロータリーが目の前）"},"市場・卸売場":{result:"F2",label:"2号棟（松戸南部市場が近い）"},"敬老ホーム・こども館":{result:"F5",label:"5号棟（1階に敬老ホーム）"},"どれも見えない":{result:"F1",label:"1号棟（東端・管理事務所近く）"}}}}}}}
},
area_g:{id:"area_g",name:"複合対応シナリオ（松戸・北松戸）",center:[139.9035,35.7945],
  gps:{lat:35.7940,lng:139.9042,acc:300},
  mansions:[
    {id:"G1",name:"北松戸ビル",addr:"千葉県松戸市上本郷901-1",lat:35.7948,lng:139.9032,fl:7,units:14,feats:["駅ロータリー正面","7階建て","1階にドラッグストア"],dist:"駅正面・1階ドラッグストア"},
    {id:"G2",name:"北松戸第2ビル",addr:"千葉県松戸市上本郷901-3",lat:35.7944,lng:139.9038,fl:5,units:10,feats:["駅から2棟目","5階建て","1階に不動産屋"],dist:"5階建て・1階不動産屋"},
    {id:"G3",name:"北松戸第3ビル",addr:"千葉県松戸市上本郷902-1",lat:35.7940,lng:139.9046,fl:9,units:18,feats:["9階建て（最も高い）","交差点の角","1階にセブンイレブン"],dist:"9階建て・交差点角・1階セブンイレブン"}
  ],
  landmarks:[
    {name:"北松戸駅前ロータリー",cat:"intersection",lat:35.7952,lng:139.9028,heading:180},
    {name:"セブンイレブン北松戸駅東口店",cat:"convenience_store",lat:35.7940,lng:139.9047,heading:270},
    {name:"北松戸交差点",cat:"intersection",lat:35.7937,lng:139.9050,heading:0},
    {name:"上本郷公園",cat:"park",lat:35.7932,lng:139.9035,heading:90}
  ],
  pois:[
    {name:"北松戸駅",cat:"intersection",lat:35.7952,lng:139.9028},
    {name:"セブンイレブン北松戸駅東口店",cat:"convenience_store",lat:35.7940,lng:139.9047},
    {name:"上本郷公園",cat:"park",lat:35.7932,lng:139.9035}
  ],
  tenants_g3:[
    {fl:"B1",name:"ダーツバー North"},{fl:1,name:"セブンイレブン北松戸駅東口店"},{fl:2,name:"松戸北口整骨院"},
    {fl:3,name:"個別指導WAM北松戸校"},{fl:4,name:"スナック都"},{fl:5,name:"北松戸内科クリニック"},
    {fl:6,name:"弁護士法人みらい"},{fl:7,name:"（空室）"},{fl:8,name:"ITサポート松戸"},{fl:9,name:"屋上（機械室）"}
  ],
  dtree:{q:"ビルの名前はわかりますか？",options:{"北松戸ビル":{result:"G1",label:"北松戸ビル（駅正面・7階建て）"},"北松戸第2ビル":{result:"G2",label:"北松戸第2ビル（5階建て）"},"北松戸第3ビル":{result:"G3",label:"北松戸第3ビル（9階建て・交差点角）"},"わからない":{q:"建物は何階建てですか？",options:{"5階くらい":{result:"G2",label:"北松戸第2ビル（5階建て）"},"7階くらい":{result:"G1",label:"北松戸ビル（7階建て・駅正面）"},"9階以上":{result:"G3",label:"北松戸第3ビル（9階建て）"},"わからない":{q:"1階に何のお店がありますか？",options:{"ドラッグストア":{result:"G1",label:"北松戸ビル（1階ドラッグストア）"},"不動産屋":{result:"G2",label:"北松戸第2ビル（1階不動産屋）"},"コンビニ":{result:"G3",label:"北松戸第3ビル（1階セブンイレブン）"}}}}}}}
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
  {s:"D",t:"山田さんのお宅ですね。お向かいには何がありますか？"},
  {s:"C",t:"向かいは…月極駐車場です。",a:{type:"q_answer",ans:"駐車場"}},
  {s:"S",t:"✓ 特定完了: ❷ 山田宅（向かいに月極駐車場 — 他4軒にない特徴で確定）",a:{type:"highlight",id:"A2"}},
  {s:"D",t:"向かいが月極駐車場の山田さん宅ですね。すぐに救急車を向かわせます。"},
  {s:"C",t:"お願いします！"},
  {s:"S",t:"📍 住所確定: 千葉県松戸市松戸1234番地 山田宅",a:{type:"confirm",id:"A2"}},
],
area_b:[
  {s:"S",t:"📡 入電GPS: 35.8668, 139.9765（精度 ±300m — 測位中…）",a:{type:"gps",lat:35.8668,lng:139.9765,acc:300}},
  {s:"C",t:"あの、事故です！車と自転車がぶつかって…！"},
  {s:"D",t:"119番消防です。おケガされた方はいますか？"},
  {s:"C",t:"はい、自転車の人が倒れてます！場所がわかりません…交差点の近くです"},
  {s:"S",t:"📡 GPS更新: 精度向上 ±150m",a:{type:"gps_update",acc:150}},
  {s:"S",t:"⚡ T3発火: 路上通報 — 周辺ランドマーク表示",a:{type:"trigger_t3"}},
  {s:"D",t:"交差点の近くですね。信号はありますか？"},
  {s:"C",t:"はい！信号のある交差点です！",a:{type:"sv_gallery",cat:"intersection"}},
  {s:"S",t:"🚦 交差点候補: 2件 — 誤差円内の信号にストリートビュー表示"},
  {s:"D",t:"信号機の柱に、交差点の名前が青い看板で出ていませんか？読めますか？"},
  {s:"C",t:"えっと…「旧水戸街道入口」って書いてあります！",a:{type:"sv_gallery_narrow",name:"旧水戸街道入口"}},
  {s:"S",t:"✓ 場所特定: 旧水戸街道入口 交差点",a:{type:"highlight_lm",name:"旧水戸街道入口"}},
  {s:"D",t:"旧水戸街道入口の交差点ですね。柏市柏ですね。すぐに救急車を向かわせます。"},
  {s:"C",t:"お願いします！急いでください！"},
  {s:"S",t:"📍 場所確定: 旧水戸街道入口交差点（柏市柏）",a:{type:"confirm_lm"}},
],
area_c:[
  {s:"C",t:"あの、お客さんが急に倒れて…救急車をお願いします！"},
  {s:"D",t:"119番消防です。場所はどちらですか？"},
  {s:"C",t:"チェルシーです。松戸駅の近くのお店なんですけど…"},
  {s:"D",t:"チェルシー…確認します。",a:{type:"fly",lat:35.78494,lng:139.90017,z:17}},
  {s:"S",t:"住所検索: 「チェルシー」「Girls Bar Chelsea」→ 消防DBヒットなし",a:{type:"no_hit"}},
  {s:"S",t:"⚡ T4発火: DB該当なし — 外部検索実行",a:{type:"trigger_t4"}},
  {s:"D",t:"松戸駅西口の新角ビル5階にあるお店でしょうか？"},
  {s:"C",t:"はい、そうです！新角ビルです。"},
  {s:"D",t:"松戸駅の目の前の9階建てのビルですか？",a:{type:"sv",lat:35.78494,lng:139.90017,h:0}},
  {s:"C",t:"はい！駅出てすぐのビルです！"},
  {s:"S",t:"✓ 確認一致: 新角ビル5F-B Girls Bar Chelsea",a:{type:"highlight_c"}},
  {s:"D",t:"松戸市本町20-1、新角ビル5階ですね。何階で待っていればいいですか？"},
  {s:"C",t:"5階です。エレベーターで上がってきてください。"},
  {s:"S",t:"📍 住所確定: 千葉県松戸市本町20-1 新角ビル5F-B",a:{type:"confirm_c"}},
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
],
area_e:[
  {s:"S",t:"📡 入電GPS: 35.7835, 139.9010（精度 ±250m — 測位中…）",a:{type:"gps",lat:35.7835,lng:139.9010,acc:250}},
  {s:"C",t:"すみません、人が道で倒れてます！意識がないみたいです！"},
  {s:"D",t:"119番消防です。救急ですね。今どちらにいらっしゃいますか？"},
  {s:"C",t:"松戸駅の近くの道路なんですけど…住所がわからなくて…"},
  {s:"S",t:"📡 GPS更新: 精度向上 ±100m",a:{type:"gps_update",acc:100}},
  {s:"S",t:"⚡ T3発火: 路上通報 — 周辺ランドマーク表示",a:{type:"trigger_t3"}},
  {s:"D",t:"GPSで松戸駅付近と出ています。周りにコンビニは見えますか？"},
  {s:"C",t:"はい！すぐ近くにコンビニがあります！",a:{type:"sv_gallery",cat:"convenience_store"}},
  {s:"S",t:"🏪 コンビニ候補: 4件 — 距離順にストリートビュー表示中"},
  {s:"D",t:"何のコンビニですか？看板の色は何色ですか？"},
  {s:"C",t:"えっと…青と白の看板です！"},
  {s:"D",t:"ローソンですね。入口にからあげクンのポスターは見えますか？"},
  {s:"C",t:"あ、はい！からあげクンあります！ローソンです！",a:{type:"sv_gallery_narrow",name:"ローソン松戸駅東口店"}},
  {s:"S",t:"✓ 場所特定: ローソン松戸駅東口店 付近",a:{type:"highlight_lm",name:"ローソン松戸駅東口店"}},
  {s:"D",t:"ローソン松戸駅東口店の前ですね。すぐに救急車を向かわせます。"},
  {s:"C",t:"お願いします！"},
  {s:"S",t:"📍 場所確定: ローソン松戸駅東口店前（松戸市松戸）",a:{type:"confirm_lm"}},
],
area_f:[
  {s:"C",t:"もしもし！野菊野団地で人が倒れています！救急車をお願いします！"},
  {s:"D",t:"119番消防です。救急ですね。松戸市の野菊野団地でよろしいですか？"},
  {s:"C",t:"はい、野菊野団地です！"},
  {s:"D",t:"何号棟ですか？",a:{type:"fly",lat:35.7795,lng:139.9140,z:16}},
  {s:"C",t:"えっと…3号棟だと思います。"},
  {s:"S",t:"住所検索: 「野菊野団地」→ 5棟ヒット（1号棟〜5号棟）",a:{type:"markers_t6"}},
  {s:"S",t:"⚡ T6発火: 同名団地5棟 — 号棟確認支援パネル表示",a:{type:"trigger_t6"}},
  {s:"D",t:"3号棟ですね。何階にいらっしゃいますか？"},
  {s:"C",t:"10階の廊下です！"},
  {s:"S",t:"⚠ 自動不一致検出: 3号棟は8階建て → 10階は存在しない（14階建ての別棟の可能性）"},
  {s:"D",t:"確認ですが、3号棟は8階建てなので10階はないはずです。近くにバス停のロータリーは見えますか？"},
  {s:"C",t:"はい！すぐ下にバスが停まっているロータリーが見えます！"},
  {s:"S",t:"→ バス停ロータリー = 4号棟の目の前（14階建て・10階あり）"},
  {s:"D",t:"バスのロータリーが見える14階建ての棟は4号棟です。建物の入口に号棟の番号は書いてありますか？"},
  {s:"C",t:"ちょっと待ってください…あ、「4」って書いてあります！4号棟でした、すみません！"},
  {s:"S",t:"✓ 確認修正: 3号棟(8階建て) → 4号棟(14階建て)で確定",a:{type:"highlight_d",id:"F4"}},
  {s:"D",t:"野菊野団地4号棟の10階ですね。すぐに救急車を向かわせます。",a:{type:"sv",lat:35.77934,lng:139.91395,h:0}},
  {s:"C",t:"お願いします！エレベーターの前で倒れています！"},
  {s:"S",t:"📍 住所確定: 千葉県松戸市野菊野 野菊野団地4号棟 10階エレベーター前",a:{type:"confirm_d",id:"F4"}},
],
area_g:[
  /* Phase 1: GPS入電 */
  {s:"S",t:"📡 入電GPS: 35.7940, 139.9042（精度 ±300m — 測位中…）",a:{type:"gps",lat:35.7940,lng:139.9042,acc:300}},
  {s:"C",t:"もしもし！ビルの中で人が倒れてます！救急車お願いします！"},
  {s:"D",t:"119番消防です。救急ですね。場所はどちらですか？"},
  {s:"C",t:"北松戸の駅の近くのビルです…住所がわかりません…"},
  {s:"S",t:"📡 GPS更新: 精度向上 ±100m",a:{type:"gps_update",acc:100}},
  /* Phase 2: ランドマーク確認 */
  {s:"D",t:"北松戸駅の近くですね。確認します。",a:{type:"fly",lat:35.7940,lng:139.9042,z:17}},
  {s:"S",t:"⚡ T3発火: GPS通報 — 周辺ランドマーク表示",a:{type:"trigger_t3"}},
  {s:"D",t:"周りに何が見えますか？コンビニや交差点はありますか？"},
  {s:"C",t:"1階にセブンイレブンが入っているビルです！交差点の角にあります！"},
  /* Phase 3: 類似ビル特定 */
  {s:"S",t:"住所検索: 「北松戸駅前 ビル」→ 3棟ヒット（北松戸ビル・第2ビル・第3ビル）",a:{type:"markers_t6"}},
  {s:"S",t:"⚡ T6発火: 駅前に類似ビル3棟 — 特定支援パネル表示",a:{type:"trigger_t6"}},
  {s:"D",t:"北松戸駅前にビルが3棟あります。ビルの名前はわかりますか？"},
  {s:"C",t:"いえ、わかりません…",a:{type:"q_answer_d",ans:"わからない"}},
  {s:"D",t:"建物は何階建てですか？"},
  {s:"C",t:"高いです…9階か10階くらいあると思います",a:{type:"q_answer_d",ans:"9階以上"}},
  {s:"S",t:"✓ 特定完了: 北松戸第3ビル（9階建て・交差点角・1階セブンイレブン）",a:{type:"highlight_d",id:"G3"}},
  /* Phase 4: テナント照合 */
  {s:"D",t:"北松戸第3ビルですね。何階で倒れていますか？"},
  {s:"C",t:"4階です！お店の中で…スナックっていうのかな…"},
  {s:"S",t:"🏢 テナント照合: 北松戸第3ビル4F =「スナック都」",a:{type:"show_tenants_g"}},
  {s:"D",t:"4階のスナック都ですね。すぐに救急車を向かわせます。",a:{type:"sv",lat:35.7940,lng:139.9046,h:0}},
  {s:"C",t:"お願いします！急いでください！"},
  {s:"S",t:"📍 住所確定: 千葉県松戸市上本郷902-1 北松戸第3ビル4F スナック都",a:{type:"confirm_d",id:"G3"}},
]};

/* ═══════════════════ 2b. KEYWORD SYSTEM ═══════════════════ */
let curKeywords=[];

const EXTRA_KW={
  area_a:[
    {text:"1234番地",cat:"address",data:{lat:35.7838,lng:139.9011,z:17}},
    {text:"松戸市松戸",cat:"address",data:{lat:35.7838,lng:139.9011,z:15}},
    {text:"月極駐車場",cat:"feature",data:{lat:35.78375,lng:139.90115}},
    {text:"コンビニ",cat:"store-cat",data:{storeCat:"convenience_store"}},
    {text:"公園",cat:"poi",data:{lat:35.78360,lng:139.90090}}
  ],
  area_b:[
    {text:"交差点",cat:"store-cat",data:{storeCat:"intersection"}},
    {text:"コンビニ",cat:"store-cat",data:{storeCat:"convenience_store"}}
  ],
  area_c:[
    {text:"チェルシー",cat:"tenant",data:{lat:35.78494,lng:139.90017}},
    {text:"5階",cat:"floor",data:{fl:5,bname:"新角ビル",lat:35.78494,lng:139.90017}}
  ],
  area_d:[
    {text:"ライオンズマンション鎌ケ谷",cat:"building-group",data:{lat:35.7700,lng:140.0010,z:15}},
    {text:"ローソン",cat:"store-cat",data:{storeCat:"convenience_store"}},
    {text:"コンビニ",cat:"store-cat",data:{storeCat:"convenience_store"}},
    {text:"5階",cat:"floor",data:{fl:5}}
  ],
  area_e:[
    {text:"コンビニ",cat:"store-cat",data:{storeCat:"convenience_store"}},
    {text:"ローソン",cat:"store-cat",data:{storeCat:"convenience_store"}},
    {text:"交差点",cat:"store-cat",data:{storeCat:"intersection"}}
  ],
  area_f:[
    {text:"野菊野団地",cat:"building-group",data:{lat:35.7795,lng:139.9140,z:16}},
    {text:"1号棟",cat:"building",data:{lat:35.7800,lng:139.9153}},
    {text:"2号棟",cat:"building",data:{lat:35.77972,lng:139.91481}},
    {text:"3号棟",cat:"building",data:{lat:35.7795,lng:139.9144}},
    {text:"4号棟",cat:"building",data:{lat:35.77934,lng:139.91395}},
    {text:"5号棟",cat:"building",data:{lat:35.7791,lng:139.9136}},
    {text:"バス停",cat:"poi",data:{lat:35.7791,lng:139.9130}},
    {text:"ロータリー",cat:"poi",data:{lat:35.7791,lng:139.9130}},
    {text:"8階建て",cat:"feature",data:{lat:35.7795,lng:139.9144,desc:"3号棟（唯一の8階建て）"}},
    {text:"10階",cat:"floor",data:{fl:10}}
  ],
  area_g:[
    {text:"セブンイレブン",cat:"store-cat",data:{storeCat:"convenience_store"}},
    {text:"コンビニ",cat:"store-cat",data:{storeCat:"convenience_store"}},
    {text:"交差点",cat:"store-cat",data:{storeCat:"intersection"}},
    {text:"スナック",cat:"tenant",data:{lat:35.7940,lng:139.9046,fl:4,name:"スナック都"}},
    {text:"4階",cat:"floor",data:{fl:4,bname:"北松戸第3ビル",lat:35.7940,lng:139.9046}},
    {text:"9階",cat:"feature",data:{lat:35.7940,lng:139.9046,desc:"北松戸第3ビル（9階建て）"}}
  ]
};

function buildScenarioKeywords(sid){
  const data=DEMO[sid];if(!data)return[];
  const kws=[];
  if(data.buildings)data.buildings.forEach(b=>{kws.push({text:b.np,cat:"person",data:{lat:b.lat,lng:b.lng,eb:b.eb||0}})});
  if(data.mansions)data.mansions.forEach(m=>{kws.push({text:m.name,cat:"building",data:{lat:m.lat,lng:m.lng}})});
  if(data.landmarks)data.landmarks.forEach(l=>{kws.push({text:l.name,cat:"landmark",data:{lat:l.lat,lng:l.lng,heading:l.heading||0}})});
  if(data.pois)data.pois.forEach(p=>{kws.push({text:p.name,cat:"poi",data:{lat:p.lat,lng:p.lng}})});
  if(data.building)kws.push({text:data.building.name,cat:"building",data:{lat:data.building.lat,lng:data.building.lng}});
  if(data.ext)kws.push({text:data.ext.name,cat:"tenant",data:{lat:data.ext.lat,lng:data.ext.lng}});
  if(data.tenants)data.tenants.forEach(t=>{if(t.name!=="テナント")kws.push({text:t.name,cat:"tenant",data:{lat:data.building?data.building.lat:0,lng:data.building?data.building.lng:0,fl:t.fl}})});
  if(data.tenants_g3){const bld=data.mansions&&data.mansions[2];data.tenants_g3.forEach(t=>{if(t.name!=="（空室）"&&t.name!=="屋上（機械室）"&&t.name!=="テナント")kws.push({text:t.name,cat:"tenant",data:{lat:bld?bld.lat:0,lng:bld?bld.lng:0,fl:t.fl}})})}
  kws.push(...(EXTRA_KW[sid]||[]));
  kws.sort((a,b)=>b.text.length-a.text.length);
  const seen=new Set();
  return kws.filter(kw=>{if(seen.has(kw.text))return false;seen.add(kw.text);return true});
}

function kwTip(cat){
  return({"address":"地図で表示","person":"建物のSVを表示","building":"SVで確認","building-group":"候補を地図に表示","landmark":"SVで確認","poi":"SVで確認","tenant":"建物のSVを表示","store-cat":"候補一覧を表示","floor":"テナント情報を表示","feature":"関連情報を表示"})[cat]||"クリックで詳細";
}

function highlightText(text,keywords){
  if(!keywords||!keywords.length)return esc(text);
  const matches=[];
  for(const kw of keywords){let p=0;while(true){const i=text.indexOf(kw.text,p);if(i===-1)break;matches.push({start:i,end:i+kw.text.length,kw});p=i+1}}
  matches.sort((a,b)=>a.start-b.start||(b.end-b.start)-(a.end-a.start));
  const fil=[];let le=0;
  for(const m of matches){if(m.start>=le){fil.push(m);le=m.end}}
  let html="",pos=0;
  for(const m of fil){
    if(m.start>pos)html+=esc(text.substring(pos,m.start));
    const ds=JSON.stringify(m.kw.data||{}).replace(/'/g,"&#39;");
    html+=`<span class="kw kw-${m.kw.cat}" data-cat="${m.kw.cat}" data-kw='${ds}' title="${kwTip(m.kw.cat)}">${esc(text.substring(m.start,m.end))}</span>`;
    pos=m.end;
  }
  if(pos<text.length)html+=esc(text.substring(pos));
  return html;
}

function handleKeywordClick(el){
  const cat=el.dataset.cat,data=JSON.parse(el.dataset.kw||"{}");
  switch(cat){
    case"address":flyTo(data.lat,data.lng,data.z||17);break;
    case"person":flyTo(data.lat,data.lng,19);openSV(data.lat,data.lng,((data.eb||0)+180)%360);break;
    case"building":flyTo(data.lat,data.lng,18);openSV(data.lat,data.lng);break;
    case"building-group":flyTo(data.lat,data.lng,data.z||15);break;
    case"landmark":flyTo(data.lat,data.lng,18);openSV(data.lat,data.lng,data.heading||0);break;
    case"poi":if(data.lat&&data.lng){flyTo(data.lat,data.lng,18);openSV(data.lat,data.lng)}break;
    case"tenant":if(data.lat&&data.lng){flyTo(data.lat,data.lng,18);openSV(data.lat,data.lng)}break;
    case"store-cat":if(data.storeCat)showSVGallery(data.storeCat);break;
    case"floor":if(data.lat&&data.lng){flyTo(data.lat,data.lng,18);openSV(data.lat,data.lng)}break;
    case"feature":if(data.lat&&data.lng){flyTo(data.lat,data.lng,19);openSV(data.lat,data.lng)}break;
  }
}

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

/* ═══════════════════ 4. STREET VIEW EMBED ═══════════════════ */
function openSV(lat,lng,heading){
  const h=heading||0;
  const iframe=document.getElementById("sv-iframe");
  iframe.src=svEmbedUrl(lat,lng,h);
  const panel=document.getElementById("sv-panel");
  panel.classList.remove("hidden");
  document.getElementById("sv-addr").textContent=lat.toFixed(4)+", "+lng.toFixed(4);
}
window.closeSV=function(){document.getElementById("sv-panel").classList.add("hidden");document.getElementById("sv-iframe").src=""};
window.openSV=openSV;

/* ═══════════════════ 4b. SV GALLERY (multiple candidates) ═══════════════════ */
const catNames={intersection:"交差点",convenience_store:"コンビニ",gas_station:"ガソリンスタンド",store:"店舗",school:"学校",temple_shrine:"神社・寺",parking:"駐車場"};
let galMarkers=[];

function svEmbedUrl(lat,lng,heading){
  return`https://www.google.com/maps/embed/v1/streetview?key=AIzaSyB7--VFS8Fz9_vsnHbiB17JCjJEjGeeq0E&location=${lat},${lng}&heading=${heading||0}&pitch=0&fov=90`;
}

function clearGalMarkers(){galMarkers.forEach(m=>m.remove());galMarkers=[]}

function showSVGallery(cat){
  const a=DEMO[curScenario];
  if(!a||!a.landmarks||!a.gps)return;
  const g=a.gps;
  const lms=a.landmarks.filter(l=>l.cat===cat).map(l=>({...l,d:Math.round(hav(g.lat,g.lng,l.lat,l.lng))})).sort((x,y)=>x.d-y.d);
  if(!lms.length)return;
  const show=lms.slice(0,5);

  aiHide();
  clearGalMarkers();

  // Add numbered markers on map
  show.forEach((l,i)=>{
    const el=document.createElement("div");el.className="marker svg-num-m";el.innerHTML=String(i+1);el.title=l.name+" ("+l.d+"m)";
    el.addEventListener("click",e=>{e.stopPropagation();flyTo(l.lat,l.lng,18);openSV(l.lat,l.lng,l.heading||0);
      // Also highlight in gallery
      const ge=document.querySelector(`.svg-entry[data-name="${l.name}"]`);
      if(ge){document.querySelectorAll(".svg-entry").forEach(x=>x.classList.remove("active"));ge.classList.add("active")}
    });
    const mk=new maplibregl.Marker({element:el}).setLngLat([l.lng,l.lat]).addTo(map);
    galMarkers.push(mk);
  });

  const panel=document.getElementById("sv-gallery");
  const body=document.getElementById("svg-body");
  panel.querySelector(".svg-title").textContent="📷 "+(catNames[cat]||cat)+" のストリートビュー";
  panel.querySelector(".svg-count").textContent=show.length+"件";

  body.innerHTML=show.map((l,i)=>`<div class="svg-entry" data-name="${esc(l.name)}" data-lat="${l.lat}" data-lng="${l.lng}" data-h="${l.heading||0}" data-idx="${i}">
    <div class="svg-entry-hd">
      <span class="svg-rank">${i+1}</span>
      <span class="svg-icon">${catI(l.cat)}</span>
      <span class="svg-name">${esc(l.name)}</span>
      <span class="svg-dist">${l.d}m</span>
      <button class="svg-popup-btn" title="パネルで拡大表示">⛶</button>
    </div>
    <div class="svg-frame-wrap">
      <iframe class="svg-frame" src="${svEmbedUrl(l.lat,l.lng,l.heading)}" allowfullscreen loading="lazy"></iframe>
    </div>
  </div>`).join("");

  // Header click → select + fly to + highlight map marker
  body.querySelectorAll(".svg-entry-hd").forEach(hd=>{
    hd.addEventListener("click",function(e){
      if(e.target.closest(".svg-popup-btn"))return;
      const entry=this.closest(".svg-entry");
      const idx=+entry.dataset.idx;
      body.querySelectorAll(".svg-entry").forEach(x=>x.classList.remove("active"));
      entry.classList.add("active");
      flyTo(+entry.dataset.lat,+entry.dataset.lng,18);
      // Pulse the map marker
      galMarkers.forEach((mk,mi)=>{const el=mk.getElement();if(el){el.style.transform=mi===idx?"scale(1.4)":"";el.style.boxShadow=mi===idx?"0 0 16px rgba(46,204,113,.8)":""}});
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
  // Dim non-matching map markers
  const matched=body.querySelector(".svg-entry.active");
  const matchIdx=matched?+matched.dataset.idx:-1;
  galMarkers.forEach((mk,mi)=>{
    const el=mk.getElement();if(!el)return;
    if(mi===matchIdx){el.classList.remove("dimmed")}
    else{el.classList.add("dimmed")}
  });
}

function hideSVGallery(){
  const panel=document.getElementById("sv-gallery");
  panel.classList.remove("visible");
  setTimeout(()=>panel.classList.add("hidden"),300);
  clearGalMarkers();
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
  DEMO.area_e.landmarks.forEach(l=>ALL.push({type:"poi",text:l.name,name:l.name,cat:l.cat,lat:l.lat,lng:l.lng,area:"area_e"}));
  ALL.push({type:"addr",text:DEMO.area_c.building.addr,bname:DEMO.area_c.building.name,lat:DEMO.area_c.building.lat,lng:DEMO.area_c.building.lng,area:"area_c"});
  DEMO.area_c.tenants.forEach(t=>ALL.push({type:"poi",text:t.name,name:t.name,cat:"tenant",lat:DEMO.area_c.building.lat,lng:DEMO.area_c.building.lng,area:"area_c"}));
  DEMO.area_d.mansions.forEach(m=>ALL.push({type:"addr",text:m.addr+" "+m.name,bname:m.name,bt:"mansion",fl:m.fl,lat:m.lat,lng:m.lng,area:"area_d"}));
  DEMO.area_f.mansions.forEach(m=>ALL.push({type:"addr",text:m.addr+" "+m.name,bname:m.name,bt:"mansion",fl:m.fl,lat:m.lat,lng:m.lng,area:"area_f"}));
  DEMO.area_f.pois.forEach(p=>ALL.push({type:"poi",text:p.name,name:p.name,cat:p.cat,lat:p.lat,lng:p.lng,area:"area_f"}));
  DEMO.area_g.mansions.forEach(m=>ALL.push({type:"addr",text:m.addr+" "+m.name,bname:m.name,bt:"mansion",fl:m.fl,lat:m.lat,lng:m.lng,area:"area_g"}));
  DEMO.area_g.landmarks.forEach(l=>ALL.push({type:"poi",text:l.name,name:l.name,cat:l.cat,lat:l.lat,lng:l.lng,area:"area_g"}));
  DEMO.area_g.pois.forEach(p=>ALL.push({type:"poi",text:p.name,name:p.name,cat:p.cat,lat:p.lat,lng:p.lng,area:"area_g"}));
  DEMO.area_g.tenants_g3.forEach(r=>ALL.push({type:"poi",text:r.name,name:r.name,cat:"tenant",lat:DEMO.area_g.mansions[2].lat,lng:DEMO.area_g.mansions[2].lng,area:"area_g"}));
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
  d.style.borderRightColor=color;d.querySelector(".ai-icon").style.background=color;d.querySelector(".ai-icon").textContent=icon;
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

/* ─── T3 (generic for any road-report scenario) ─── */
function showT3(){
  const a=DEMO[curScenario];
  if(!a||!a.landmarks||!a.gps)return;
  const g=a.gps;
  const lms=a.landmarks.map(l=>({...l,d:Math.round(hav(g.lat,g.lng,l.lat,l.lng))})).sort((x,y)=>x.d-y.d);
  lms.forEach((l,i)=>addM(l.lat,l.lng,{cls:"lm-m lm-numbered",label:catI(l.cat)+'<span class="lm-num">'+(i+1)+'</span>',title:(i+1)+". "+l.name+" ("+l.d+"m)",click:()=>{flyTo(l.lat,l.lng,18);openSV(l.lat,l.lng,l.heading||0)}}));
  let html=`<div class="ai-sec"><div class="ai-sec-title">周辺の目印（距離順・クリックでSV表示）</div>`;
  lms.slice(0,10).forEach((l,i)=>{html+=`<div class="lm-item" data-lat="${l.lat}" data-lng="${l.lng}" data-h="${l.heading||0}"><span class="lm-num-badge">${i+1}</span><span class="lm-icon">${catI(l.cat)}</span><span class="lm-name">${esc(l.name)}</span><span class="lm-dist">${l.d}m</span></div>`});
  html+=`</div>`;
  const cvs=lms.filter(l=>l.cat==="convenience_store").length;
  const ixs=lms.filter(l=>l.cat==="intersection").length;
  html+=`<div class="ai-sec"><div class="ai-sec-title">絞り込みヒント</div>`;
  if(cvs>1)html+=`<div style="font-size:12px;color:#e67e22;padding:4px 8px">🏪 コンビニ ${cvs}件 — 通報者に看板を確認</div>`;
  if(ixs>1)html+=`<div style="font-size:12px;color:#e67e22;padding:4px 8px">🚦 交差点 ${ixs}件 — 信号の有無を確認</div>`;
  html+=`</div>`;
  aiShow("#3498db","GPS","路上通報 — 場所の絞り込み","GPS精度: ±"+g.acc+"m",html);
  document.querySelectorAll(".lm-item").forEach(el=>el.addEventListener("click",function(){flyTo(+this.dataset.lat,+this.dataset.lng,18);openSV(+this.dataset.lat,+this.dataset.lng,+this.dataset.h)}));
}

/* ─── T4 ─── */
function showT4(){
  const a=DEMO.area_c,ext=a.ext;
  let html=`<div class="ai-sec"><div class="ai-sec-title">検索結果</div><div class="poi-r"><div class="poi-r-name">${esc(ext.name)}<span class="ext-badge">外部検索</span></div><div class="poi-r-addr">📍 ${esc(ext.addr)}</div><div style="font-size:11px;color:#7f8c8d;margin-top:4px">消防DB: ${esc(a.building.name)} (${a.building.reg})</div><div class="poi-r-acts"><button class="poi-btn" onclick="openSV(${ext.lat},${ext.lng})">📷 ストリートビュー確認</button></div></div></div>`;
  html+=`<div class="ai-sec"><div class="ai-sec-title">同じビルの情報</div><div class="tenant-list">${a.tenants.map(t=>`<div class="tenant-row${t.name.includes("Chelsea")?" hl":""}"><span class="tenant-fl">${t.fl}F:</span><span class="tenant-nm">${esc(t.name)}</span></div>`).join("")}</div></div>`;
  aiShow("#8e44ad","🔍","DB該当なし — 外部検索",`「${esc(ext.name)}」`,html);
}

/* ─── T6 ─── */
function showT6(){
  const a=DEMO[curScenario],ms=a.mansions;
  let html=`<div class="ai-sec"><div class="ai-sec-title">候補一覧（クリックで地図移動+SV表示）</div>`;
  ms.forEach((m,i)=>{html+=`<div class="cand" data-lat="${m.lat}" data-lng="${m.lng}"><div><span class="cand-num">${i+1}</span><span class="cand-name">${esc(m.name)}</span></div><div class="cand-type" style="padding-left:32px">${esc(m.addr)}</div><div class="cand-type" style="padding-left:32px">${m.fl}階建て / ${m.units}戸</div><div class="feat-tags">${m.feats.map(f=>`<span class="feat-tag">${esc(f)}</span>`).join("")}</div></div>`});
  html+=`</div>`;
  if(a.dtree){qSet(a.dtree);const q=qGet();if(q)html+=`<div class="ai-sec"><div class="ai-sec-title">確認質問</div><div id="q-ctr">${renderQ(q)}</div></div>`}
  const t6n=ms[0].name.replace(/[0-9０-９]+号棟?$|第[一二三四五六七八九十]+$/,"").trim();
  aiShow("#2c3e50","🏢",`類似名称 ${ms.length}件`,`「${t6n}…」`,html);
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
    resetUI();curKeywords=buildScenarioKeywords(curScenario);
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
    document.getElementById("transcript-lines").innerHTML=`<div class="tl-placeholder">シナリオを選択して「開始」をクリック</div>`;
    curKeywords=[];
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
  div.innerHTML=`<span class="tl-speaker ${clsMap[line.s]}">${speakerMap[line.s]}</span><span class="tl-text">${highlightText(line.t,curKeywords)}</span>`;
  container.appendChild(div);
  // Auto-scroll
  const area=document.getElementById("transcript-area");
  area.scrollTop=area.scrollHeight;
}

function execAction(a){
  const t=a.type;
  if(t==="fly") flyTo(a.lat,a.lng,a.z||17);
  else if(t==="gps"){
    const d=DEMO[curScenario];
    const gLat=a.lat||(d&&d.gps?d.gps.lat:0);
    const gLng=a.lng||(d&&d.gps?d.gps.lng:0);
    const gAcc=a.acc||(d&&d.gps?d.gps.acc:150);
    if(d&&d.gps){d.gps.acc=gAcc}
    clearM();flyTo(gLat,gLng,16);showGPS(gLat,gLng,gAcc);
    addM(gLat,gLng,{cls:"gps-m",label:"📡",title:"GPS ±"+gAcc+"m"});
    setGPSBadge(gAcc);
  }
  else if(t==="gps_update"){
    const d=DEMO[curScenario];
    const gLat=a.lat||(d&&d.gps?d.gps.lat:0);
    const gLng=a.lng||(d&&d.gps?d.gps.lng:0);
    const gAcc=a.acc||50;
    if(d&&d.gps){d.gps.acc=gAcc}
    showGPS(gLat,gLng,gAcc);
    setGPSBadge(gAcc);
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
    const ms=DEMO[curScenario].mansions;
    ms.forEach((m,i)=>{addM(m.lat,m.lng,{cls:"cand-m",label:String(i+1),title:m.name})});
    fitB(ms.map(m=>({lat:m.lat,lng:m.lng})),80);
    const c=DEMO[curScenario].center;
    showAerial(c[1],c[0],16);
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
    const d=DEMO[curScenario];
    const lm=d&&d.landmarks?d.landmarks.find(l=>l.name===a.name):null;
    if(lm){clearGalMarkers();addM(lm.lat,lm.lng,{cls:"ok-m",label:"✓",title:"特定: "+lm.name});flyTo(lm.lat,lm.lng,19);openSV(lm.lat,lm.lng,lm.heading||0)}
  }
  else if(t==="highlight_c"){
    addM(DEMO.area_c.ext.lat,DEMO.area_c.ext.lng,{cls:"ok-m",label:"✓",title:"確認一致"});flyTo(DEMO.area_c.ext.lat,DEMO.area_c.ext.lng,19);
  }
  else if(t==="highlight_d"){
    const m=(DEMO[curScenario].mansions||[]).find(x=>x.id===a.id);
    if(m){addM(m.lat,m.lng,{cls:"ok-m",label:"✓",title:"特定: "+m.name});flyTo(m.lat,m.lng,19);openSV(m.lat,m.lng)}
  }
  else if(t==="show_tenants_g"){
    const ag=DEMO.area_g,ts=ag.tenants_g3,bld=ag.mansions.find(m=>m.id==="G3");
    let html=`<div class="ai-sec"><div class="ai-sec-title">テナント一覧: ${esc(bld.name)}</div><div class="tenant-list">${ts.map(r=>`<div class="tenant-row${r.fl===4?" hl":""}"><span class="tenant-fl">${r.fl}F:</span><span class="tenant-nm">${esc(r.name)}</span></div>`).join("")}</div></div>`;
    html+=`<div class="ai-sec"><div class="ai-sec-title">ビル情報</div><div style="font-size:12px;color:#2c3e50;padding:4px 8px">📍 ${esc(bld.addr)}<br>🏢 ${bld.fl}階建て・交差点角<br>📋 1階: セブンイレブン</div></div>`;
    aiShow("#8e44ad","🏢","テナント照合",bld.name+" — 4F スナック都",html);
  }
  else if(t==="sv_gallery") showSVGallery(a.cat);
  else if(t==="sv_gallery_narrow") narrowSVGallery(a.name);
  else if(t==="confirm"||t==="confirm_lm"||t==="confirm_c"||t==="confirm_d"){
    setBadge("call-status","confirmed","確定済み");setAI("ai-idle","AI: 待機中");hideSVGallery();
  }
}

function resetUI(){
  clearM();clearGalMarkers();clearGPS();aiHide();hideAerial();closeSV();hideSVGallery();
  setBadge("call-status","idle","待機中");setAI("ai-idle","AI: 待機中");setGPSBadge(null);
}

/* ═══════════════════ INIT ═══════════════════ */
document.addEventListener("DOMContentLoaded",()=>{
  buildIndex();initMap();initSearch();initPlayer();
  document.getElementById("ai-close").addEventListener("click",aiHide);
  document.getElementById("transcript-area").addEventListener("click",function(e){const kw=e.target.closest(".kw");if(kw)handleKeywordClick(kw)});
});

})();
