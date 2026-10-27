'use strict';
const periods={baseline:{from:'2026-09-07',to:'2026-09-09'},current:{from:'2026-09-14',to:'2026-09-16'}};
module.exports={id:'tutorial',part:0,chapter:'T',level:'intro',title:'最初のハントを一緒に進める',subtitle:'画面の見方と、検索から回答までの操作',minutes:'5–8',focus:'操作チュートリアル',periods,
 brief:'部署の端末から sync-demo.example への通信が記録されています。この通信がある端末を見つけ、記録を1件根拠として残しましょう。危険かどうかの判定は、この練習では扱いません。',
 context:'操作専用の小さな架空環境です。左が調査依頼、中央が調査道具、右が証拠と回答を置くハントノートです。スマートフォンではこの順に縦に並びます。文字を読むだけでなく、案内された場所を実際に操作して進めます。',
 hypotheses:[],findings:[],sources:[{name:'通信',description:'端末・通信先・時刻を記録しています。通信先の名前だけでは目的や安全性は判断できません。'}],
 guide:[
 {title:'画面の3つの場所を知る',tab:'logs',focus:'brief',body:'左の「調査依頼」を読んでください。中央で調べ、右の「ハントノート」に根拠と回答を残します。今回は「どの端末か」を確かめます。読み終えたら「次へ」を押します。'},
 {title:'通信先を検索する',tab:'logs',focus:'search',body:'中央の検索欄に destination:sync-demo.example と入力し、「検索」を押してください。通信先を指定して候補を絞ります。結果が2件になれば次へ進めます。'},
 {title:'1件の記録を開く',tab:'logs',focus:'logs',body:'検索結果のどちらかで「記録の詳細」を押してください。時刻・端末・通信先が1行の記録に入っています。確認したらダイアログを閉じます。'},
 {title:'根拠をハントノートに残す',tab:'logs',focus:'logs',body:'検索結果のどちらか1件の「＋ 証拠に追加」を押してください。右側のハントノートへ記録が移ります。元のログは消えません。'},
 {title:'証拠の役割を決める',tab:'logs',reportTab:'evidence',focus:'evidence',body:'ハントノートにある証拠の役割を「支持 — 事実・仮説の根拠」に変えてください。この通信があった端末を答える根拠として使う、という意味です。'},
 {title:'回答欄を開く',tab:'logs',reportTab:'answers',focus:'report-tabs',body:'右の「回答・まとめ」を押します。「証拠」は根拠を置く場所、「回答・まとめ」は調査で分かったことを記す場所です。'},
 {title:'端末を回答する',tab:'logs',reportTab:'answers',focus:'targets',body:'「調査結果として挙げる端末」で、通信記録に書かれた端末だけを選んでください。調査メモは任意です。証拠の詳細を開いて読み直しても構いません。'},
 {title:'証拠と回答を確認する',tab:'logs',reportTab:'answers',focus:'grade',body:'ハントノートの「証拠と回答を確認する」を押します。未達成の項目があれば内容を修正し、もう一度確認できます。誤答や再挑戦の回数による減点はありません。'},
 {title:'解説で考え方を振り返る',tab:'logs',reportTab:'answers',focus:'feedback',body:'採点結果の「解説で振り返る」を押してください。解説を見る操作は、正解を自動入力するものではありません。自分の根拠と比べてから閉じましょう。'},
 {title:'操作チュートリアル完了',tab:'logs',reportTab:'answers',focus:'finish',body:'検索→詳細を読む→証拠と役割を残す→回答→確認、が基本の流れです。上の「保存」は進捗JSON、「報告を保存」はこの調査の記録です。次は入門01から、集計や比較も練習します。'}
 ],
 hints:['中央で通信先を絞ると、どの端末の記録があるか見えます。','記録を1件ハントノートへ追加し、事実の根拠として役割を指定します。','検索結果の端末名と、回答欄の選択が一致しているか確認しましょう。'],
 logs:[
 {id:'tutorial-normal1',at:'2026-09-15T09:04:13Z',period:'current',source:'通信',host:'DEMO-WS-01',user:'aoki',event:'HTTP request',destination:'docs.example',process:'browser.exe',detail:'method=GET path=/guide status=200',bytes:4096},
 {id:'tutorial-net1',at:'2026-09-15T09:06:25Z',period:'current',source:'通信',host:'DEMO-WS-02',user:'mori',event:'HTTP request',destination:'sync-demo.example',process:'sync-client.exe',detail:'method=POST path=/sync status=200',bytes:2048},
 {id:'tutorial-net2',at:'2026-09-15T09:07:28Z',period:'current',source:'通信',host:'DEMO-WS-02',user:'mori',event:'HTTP request',destination:'sync-demo.example',process:'sync-client.exe',detail:'method=POST path=/sync status=200',bytes:1024},
 {id:'tutorial-normal2',at:'2026-09-15T09:08:19Z',period:'current',source:'通信',host:'DEMO-WS-03',user:'kudo',event:'HTTP request',destination:'updates.example',process:'updater.exe',detail:'method=GET path=/catalog status=200',bytes:3072}
 ],
 rubric:{targets:['DEMO-WS-02'],evidenceGroups:[{label:'通信した端末を示す記録',anyOf:['tutorial-net1','tutorial-net2'],role:'support'}],operations:['search']},
 explanation:{summary:'通信記録にある端末を、同じ記録を根拠にして回答できました。',reasoning:['通信先を絞ると、DEMO-WS-02の記録が2件残ります。','どちらか1件を「支持」として残せば、端末を回答する根拠になります。','ここで確認できたのは通信の存在です。実際のハントでは、実行元や正当な業務も調べて結論を出します。'],next:'入門01へ進み、似た名前の宛先を区別して調べましょう。',sampleReport:'仮説：指定された宛先への通信がある端末を確かめる。\n結果：DEMO-WS-02からの通信を確認。\n限界：通信の目的や安全性は、この記録だけでは判断していない。'}
};
