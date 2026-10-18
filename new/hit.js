/* アクセス数：ページが開かれたことだけを全体システムに知らせる（名前・IPアドレス・クッキーは使わない）。
   ダッシュボードの「発信」→「アクセス数」で見る。「トラッキング拒否」の設定のブラウザでは送らない */
(function(){
  try{
    if(navigator.doNotTrack==='1'||window.doNotTrack==='1')return;
    var EXEC='https://script.google.com/macros/s/AKfycbzfj3hI7VA1MsoDSu9Ag6Plibpv3vXyyKGf6hTZ8bpt6EoVF4jcv8mAB1CLeWuZXjun/exec';
    var p=(location.pathname.split('/').pop()||'index.html').replace(/\.html$/,'')||'index';
    var q=new URLSearchParams(location.search),x=p==='results'?(q.get('comp')||''):p==='team'?(q.get('team')||''):'';
    new Image().src=EXEC+'?api=hit&p='+encodeURIComponent(p)+'&q='+encodeURIComponent(x)+'&_='+Date.now();
  }catch(e){}
})();
