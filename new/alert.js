/* 緊急のお知らせ：全体システム（ダッシュボードの「発信」→「緊急のお知らせ」）が書き出す ../results/data/alert.json を、
   ヘッダーのすぐ下に赤い帯で出す。期限（until・日本時間）を過ぎたら出さない */
(function(){
  fetch('../results/data/alert.json',{cache:'no-store'}).then(function(r){return r.ok?r.json():null}).then(function(a){
    if(!a||!a.text)return;
    if(a.until){var t=new Date(String(a.until).replace(' ','T')+':00+09:00');if(!isNaN(t)&&Date.now()>t.getTime())return;}
    var h=document.querySelector('header.header');if(!h)return;
    var d=document.createElement(a.link&&/^https:\/\//.test(a.link)?'a':'div');
    d.className='alertbar';d.setAttribute('role','alert');
    if(d.tagName==='A'){d.href=a.link;d.target='_blank';d.rel='noopener';}
    var inner=document.createElement('div');inner.className='alertin';
    var b=document.createElement('b');b.textContent='重要';
    var s=document.createElement('span');s.textContent=a.text;
    inner.appendChild(b);inner.appendChild(s);
    if(d.tagName==='A'){var m=document.createElement('i');m.textContent='›';inner.appendChild(m);}
    d.appendChild(inner);h.parentNode.insertBefore(d,h.nextSibling);
  }).catch(function(){});
})();
