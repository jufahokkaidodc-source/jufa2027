/* ホームページの構成（テンプレート5つ・載せるもの）
 *  ダッシュボードの「発信」→「ホームページの構成」で決める → 全体システムが ../results/data/site.json に書き出す
 *  { layout: 1〜5, hide: ['photos', 'p:history', 't:analysis', …] }
 *    ブロック（トップページ）… clubbar・photos（注目の試合）・ticker・gallery（写真）・news・results・schedule・standings・scorers・clubs・partner
 *    ページ（p:）… news・history・about        大会記録のタブ（t:）… grid・tournament・scorers・assists・cards・awards・analysis
 *  ・<head> で読む。前に開いたときの構成（localStorage）をすぐ当てるので、ちらつかない。site.json を読んだら当て直す
 *  ・?layout=1〜5（＆hide=…）で、保存する前の見え方を試せる（ダッシュボードの「プレビュー」）
 *  ・テンプレートの中身（並び・はじめから外すもの）は、ダッシュボード（Admin.html の HP_LAYOUTS）と同じにする
 */
(function () {
  var LAYOUTS = {
    1: { name: 'スタンダード', order: ['photos', 'ticker', 'news', 'results', 'scorers', 'gallery', 'clubs', 'partner'] },
    2: { name: '試合中心', order: ['ticker', 'results', 'scorers', 'news', 'photos', 'gallery', 'clubs', 'partner'] },
    3: { name: 'ニュース中心', order: ['photos', 'news', 'ticker', 'results', 'scorers', 'gallery', 'clubs', 'partner'] },
    4: { name: 'ビジュアル', order: ['photos', 'gallery', 'clubs', 'ticker', 'news', 'results', 'scorers', 'partner'] },
    5: { name: 'シンプル', order: ['ticker', 'results', 'news', 'scorers', 'photos', 'gallery', 'clubs', 'partner'] }
  };
  var PAGES = { news: 'news.html', history: 'history.html', about: 'about.html' };
  var KEY = 'jufa-site-v1', html = document.documentElement;
  var qs = new URLSearchParams(location.search), pv = Number(qs.get('layout'));
  var S = { layout: 1, hide: [] };
  try { var c = JSON.parse(localStorage.getItem(KEY) || 'null'); if (c && LAYOUTS[c.layout]) S = c; } catch (e) {}

  function norm(s) {
    s = s || {};
    var o = { layout: LAYOUTS[Number(s.layout)] ? Number(s.layout) : 1, hide: Array.isArray(s.hide) ? s.hide.map(String) : [] };
    if (LAYOUTS[pv]) { o.layout = pv; if (qs.has('hide')) o.hide = qs.get('hide').split(',').filter(Boolean); } // プレビュー
    return o;
  }
  function apply(s) {
    S = norm(s);
    html.setAttribute('data-layout', S.layout);
    // 前に当てた印を外してから付け直す
    html.className = html.className.split(/\s+/).filter(function (c) { return c && c.indexOf('hide-') !== 0; }).join(' ');
    S.hide.forEach(function (h) { html.classList.add('hide-' + h.replace(':', '-')); });
    if (document.readyState !== 'loading') arrange();
  }
  /* トップページのブロックを、テンプレートの順に並べる */
  function arrange() {
    var box = document.querySelector('.parts-main');
    if (box) LAYOUTS[S.layout].order.forEach(function (k) { var el = document.querySelector('[data-part="' + k + '"]'); if (el) box.appendChild(el); });
    // 出さないページへのリンクを消す（メニュー・フッター・お知らせの「一覧」など）
    Object.keys(PAGES).forEach(function (k) {
      var off = S.hide.indexOf('p:' + k) >= 0;
      document.querySelectorAll('a[href]').forEach(function (a) {
        var h = a.getAttribute('href') || '';
        if (h.replace(/^\.\//, '').split(/[?#]/)[0] === PAGES[k]) a.classList.toggle('site-off', off);
      });
    });
  }
  window.JUFA_SITE = {
    LAYOUTS: LAYOUTS,
    get: function () { return S; },
    hidden: function (k) { return S.hide.indexOf(k) >= 0; },
    tabOn: function (k) { return S.hide.indexOf('t:' + k) < 0; }
  };
  apply(S);
  document.addEventListener('DOMContentLoaded', arrange);
  fetch('../results/data/site.json', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
    if (!d) return;
    var s = { layout: d.layout, hide: d.hide };
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {}
    var before = JSON.stringify(S); apply(s);
    if (JSON.stringify(S) !== before) document.dispatchEvent(new CustomEvent('jufa-site'));
  }).catch(function () {});
})();
