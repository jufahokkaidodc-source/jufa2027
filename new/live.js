/* 速報（公式記録の入力中の内容から。スコアと得点者だけ）
 *  システムの ?api=live を読み、試合中だけ30秒ごとに読み直す（試合がないときは5分ごと）。
 *  使い方：JUFA_LIVE.on(関数) で、読み込むたびに呼ばれる。JUFA_LIVE.of(試合ID) でその試合の速報（なければ null）
 */
(function(){
  var API='https://script.google.com/macros/s/AKfycbzfj3hI7VA1MsoDSu9Ag6Plibpv3vXyyKGf6hTZ8bpt6EoVF4jcv8mAB1CLeWuZXjun/exec?api=live';
  var L={data:null,map:{},subs:[],timer:null,active:false};
  function next(){clearTimeout(L.timer);L.timer=setTimeout(load,L.active?30000:300000);}
  function load(){
    if(document.visibilityState==='hidden'){next();return;}
    var cb='__jufaLive'+Date.now(),s=document.createElement('script'),done=false;
    window[cb]=function(d){done=true;try{delete window[cb];}catch(e){window[cb]=undefined;}s.remove();
      if(d&&d.ok){L.data=d;L.active=!!d.active;L.map={};(d.matches||[]).forEach(function(m){L.map[m.matchId]=m;});L.subs.forEach(function(f){try{f(L);}catch(e){}});}
      next();};
    s.onerror=function(){s.remove();next();};
    setTimeout(function(){if(!done){s.remove();next();}},20000);
    s.src=API+'&callback='+cb;
    document.head.appendChild(s);
  }
  L.of=function(id){var m=L.map[id];return m&&m.state!=='final'?m:null;};
  /* 速報の見出し：入力中は「速報 後半」、提出済みは「試合終了（確定前）」 */
  L.label=function(m){return m.state==='live'?'速報'+(m.period?' '+m.period:''):'試合終了（確定前）';};
  L.on=function(f){L.subs.push(f);if(L.data)try{f(L);}catch(e){}};
  document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible'&&L.active)load();});
  window.JUFA_LIVE=L;
  load();
})();
