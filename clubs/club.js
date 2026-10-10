/* チームの独自ホームページ（共通テンプレート v2・2026-10）
 *  clubs/index.html が clubs.json から window.CLUB を決めてから、このファイルを読み込む
 *    univ  … チームマスターの大学名（必須）。この大学のチームを、全大会から集める
 *    name  … サイトの名前（例：札幌大学サッカー部）。空なら「大学名＋サッカー部」
 *    en    … 英語名（任意）。トップの大きな英語の見出しにも使う
 *    color … 強調色。空ならチーム紹介の「チームカラー」
 *    hero  … トップ画像のURL。空ならチーム紹介の「チーム写真」
 *    lead  … トップの一言（キャッチコピー）。空ならチーム紹介の紹介文の最初の一文
 *  ページ：HOME・NEWS・MATCH（日程・結果・順位表）・TEAM（選手・スタッフ・個人成績）・ABOUT・GALLERY・CONTACT
 *  デザインは body[data-tpl]（a・b・c）で切り替え。ページ構成とデータは共通（club.css）
 *  データ：公式記録（results/data/*.json）と、管理画面の名鑑・ニュース（*-roster.json）。新しい入力は作らない
 */
(function () {
  'use strict';
  const CFG = Object.assign({ univ: '', name: '', en: '', color: '', hero: '', heroCaption: '', lead: '',
    data: '../results/data/', results: '../results/', site: '../new/' }, window.CLUB || {});
  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const has = v => v != null && String(v).trim() !== '';
  const WD = ['日', '月', '火', '水', '木', '金', '土'];
  const jstToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const ymd = s => /^(\d{4})-(\d{2})-(\d{2})/.exec(s || '');
  function md(s) { const m = ymd(s); return m ? (+m[2]) + '.' + String(+m[3]).padStart(2, '0') : (s || '未定'); }
  function wd(s) { const m = ymd(s); return m ? WD[new Date(+m[1], +m[2] - 1, +m[3]).getDay()] : ''; }
  function fullDate(s) { const m = ymd(s); return m ? m[1] + '.' + m[2] + '.' + m[3] + '（' + wd(s) + '）' : (s || ''); }
  function daysUntil(s) { const a = ymd(s), b = ymd(jstToday()); if (!a || !b) return null; return Math.round((Date.UTC(+a[1], +a[2] - 1, +a[3]) - Date.UTC(+b[1], +b[2] - 1, +b[3])) / 864e5); }
  const safeUrl = u => /^https?:\/\//i.test(String(u || '')) ? String(u) : '';
  function richText(t) { return esc(t).replace(/(https?:\/\/[^\s<>"']+)/g, '<a href="$1" target="_blank" rel="noopener" style="text-decoration:underline">$1</a>').replace(/\n/g, '<br>'); }
  /* ドライブの共有リンクは縮小版にする */
  function img(u, w) {
    u = String(u || '').trim(); if (!u) return '';
    const d = u.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=\w+&)?id=)([\w-]{20,})/);
    if (d) return 'https://drive.google.com/thumbnail?id=' + d[1] + '&sz=w' + w;
    if (/^https:\/\//i.test(u)) return u;
    if (/^[^\/\\?#]+\.(png|jpe?g|webp|svg|gif)$/i.test(u)) return CFG.site + 'emblems/' + encodeURIComponent(u);
    return '';
  }
  const shortComp = n => String(n || '').replace(/^\d{4}年度\s*/, '').replace(/第\d+回\s*/, '').replace(/^北海道学生サッカー/, '').replace(/^北海道/, '')
    .replace(/北海道大会$/, '').replace(/インディペンデンスリーグ/, 'Iリーグ').replace(/全日本大学サッカー/, '').replace(/トーナメント/, '').replace(/\s+/g, '').trim() || n;
  const tname = t => typeof t === 'string' ? t : (t?.short || t?.name || '未定');
  const mine = t => t && typeof t === 'object' && t.univ === CFG.univ;
  const isDone = m => m.status === 'finished' && m.score && m.score.home != null && m.score.home !== '' && m.score.away != null && m.score.away !== '';

  const S = { comps: [], data: {}, roster: {}, teams: [], profile: null, matches: [], players: [], staff: [], news: [], stats: [], gallery: [], sponsors: [] };

  /* ───────── 読み込み ───────── */
  async function getJSON(f) { const r = await fetch(CFG.data + f, { cache: 'no-store' }); if (!r.ok) throw Error('HTTP ' + r.status); return r.json(); }
  async function load() {
    const c = await getJSON('competitions.json');
    S.comps = c.competitions || [];
    await Promise.all(S.comps.map(async comp => {
      const [d, ro] = await Promise.all([getJSON(encodeURIComponent(comp.id) + '.json').catch(() => null), getJSON(encodeURIComponent(comp.id) + '-roster.json').catch(() => null)]);
      if (d) S.data[comp.id] = d;
      if (ro) S.roster[comp.id] = ro;
    }));
    // この大学のチーム（大会ごと）
    for (const comp of S.comps) {
      const d = S.data[comp.id]; if (!d) continue;
      const seen = new Set();
      for (const m of d.matches || []) for (const t of [m.home, m.away]) if (mine(t) && !seen.has(t.id)) { seen.add(t.id); S.teams.push({ comp, team: t }); }
    }
    S.teams.forEach(x => { x.label = shortComp(x.comp.name) + (S.teams.filter(y => y.comp.id === x.comp.id).length > 1 ? '（' + tname(x.team) + '）' : ''); });
    // チーム紹介・名鑑・ニュース
    const newsSeen = new Set(), pmap = new Map();
    for (const comp of S.comps) {
      for (const t of (S.roster[comp.id]?.teams || []).filter(t => mine(t.team))) {
        if (!S.profile && t.profile) S.profile = t.profile;
        if (!S.staff.length && (t.staff || []).length) S.staff = t.staff;
        if (!S.gallery.length && (t.gallery || []).length) S.gallery = t.gallery;
        if (!S.sponsors.length && (t.sponsors || []).length) S.sponsors = t.sponsors;
        for (const n of t.news || []) { const k = n.id || (n.date + '|' + n.title); if (!newsSeen.has(k)) { newsSeen.add(k); S.news.push(n); } }
        for (const p of t.players || []) {
          if (!pmap.has(p.id)) pmap.set(p.id, { ...p, teams: [] });
          const q = pmap.get(p.id);
          q.teams.push({ teamId: t.team.id, comp: comp.id, no: p.no, label: shortComp(comp.name) });
          for (const k of ['photo', 'comment', 'school', 'grade', 'kana']) if (!has(q[k]) && has(p[k])) q[k] = p[k];
        }
      }
    }
    S.players = [...pmap.values()];
    S.news.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    for (const x of S.teams) {
      for (const m of S.data[x.comp.id].matches || []) {
        if (m.placeholder) continue;
        const home = m.home?.id === x.team.id, away = m.away?.id === x.team.id;
        if (!home && !away) continue;
        S.matches.push({ comp: x.comp, label: x.label, team: x.team, m, home, opp: home ? m.away : m.home });
      }
    }
    S.matches.sort((a, b) => String(a.m.date || '9999').localeCompare(String(b.m.date || '9999')) || String(a.m.kickoff || '').localeCompare(String(b.m.kickoff || '')));
    for (const x of S.teams) {
      const ps = (S.data[x.comp.id].playerStats || []).find(s => s.team?.id === x.team.id);
      if (ps) S.stats.push({ ...x, players: ps.players || [] });
    }
  }

  /* ───────── 共通の部品 ───────── */
  /* PK戦：{home,away} でも「4-5」でも [ホーム, アウェイ] にする */
  function pkPair(pk) {
    if (pk == null || pk === '') return null;
    if (typeof pk === 'object') return pk.home != null && pk.home !== '' ? [+pk.home, +pk.away] : null;
    const p = String(pk).split(/[-–:]/).map(Number); return p.length === 2 && !p.some(isNaN) ? p : null;
  }
  function result(x) {
    const m = x.m; if (!isDone(m)) return '';
    let a = +m.score.home, b = +m.score.away;
    if (a === b && m.score.pk) { const p = pkPair(m.score.pk); if (p) { a = p[0]; b = p[1]; } }
    if (!x.home) [a, b] = [b, a];
    return a > b ? 'W' : a < b ? 'L' : 'D';
  }
  const RES = { W: '勝', D: '分', L: '敗' };
  const myScore = x => x.home ? x.m.score.home : x.m.score.away, opScore = x => x.home ? x.m.score.away : x.m.score.home;
  function pkText(x) { const pk = pkPair(x.m.score.pk); return pk ? 'PK ' + (x.home ? pk[0] + '-' + pk[1] : pk[1] + '-' + pk[0]) : ''; }
  const matchUrl = x => CFG.site + 'results.html?comp=' + encodeURIComponent(x.comp.id) + (x.m.matchId ? '&match=' + encodeURIComponent(x.m.matchId) : '');
  function matchRow(x) {
    const m = x.m, r = result(x), done = isDone(m), pk = done ? pkText(x) : '';
    return '<a class="mr" href="' + esc(matchUrl(x)) + '">' +
      '<div class="d"><b>' + esc(md(m.date)) + '</b>' + esc(wd(m.date) ? '（' + wd(m.date) + '）' : '') + '</div>' +
      '<div class="o"><b>vs ' + esc(tname(x.opp)) + '</b><small>' + esc(x.label) + (m.round ? '　' + esc(m.round) : '') + (m.venue ? '　' + esc(m.venue) : '') + '</small></div>' +
      '<div class="s">' + (done ? esc(myScore(x)) + ' - ' + esc(opScore(x)) + (pk ? '<small style="font-size:11px;color:var(--sub);font-family:Noto Sans JP,sans-serif">' + esc(pk) + '</small>' : '') + '<span class="res ' + r + '">' + RES[r] + '</span>' : '<span class="ko">' + esc(m.kickoff ? m.kickoff + ' KO' : '予定') + '</span>') + '</div></a>';
  }
  const ini = () => [...CFG.univ.replace(/(大学|大)$/, '')].slice(0, 2).join('');
  function emb(t, mineSide) {
    if (mineSide) { const eu = img(S.profile?.emblem, 200); return eu ? '<span class="emb img"><img src="' + esc(eu) + '" alt=""></span>' : '<span class="emb">' + esc(ini()) + '</span>'; }
    return '<span class="emb op">' + esc([...tname(t)].slice(0, 2).join('')) + '</span>';
  }
  const band = (cls, en, ja, inner, link) => '<section class="band ' + (cls || '') + '"><div class="wrap reveal"><div class="sh"><h2><span class="en">' + en + '</span>' + ja + '</h2>' + (link || '') + '</div>' + inner + '</div></section>';
  const emptyBox = t => '<div class="card"><p class="empty">' + esc(t) + '</p></div>';
  const pageTop = (en, ja) => '<div class="ph-top"><div class="wrap"><div class="crumb"><a href="#home">HOME</a> ／ ' + esc(ja) + '</div><div class="en">' + en + '</div><p>' + esc(ja) + '</p></div></div>';

  /* ───────── HOME ───────── */
  function nextMatch() { const t = jstToday(); return S.matches.find(x => !isDone(x.m) && (x.m.date || '9999') >= t); }
  function viewHome() {
    const next = nextMatch(), last = S.matches.filter(x => isDone(x.m)).slice(-1)[0];
    let html = '';
    // NEXT MATCH（メインビジュアルの下に重ねる）
    html += '<div class="wrap reveal on">' + (next ? (() => {
      const d = daysUntil(next.m.date), me = next.home ? next.m.home : next.m.away;
      return '<div class="nextm"><div class="meta"><span class="lab">NEXT MATCH</span><span>' + esc(next.label) + (next.m.round ? '　' + esc(next.m.round) : '') + '</span></div>' +
        '<div class="board"><div class="tm">' + emb(me, true) + '<b>' + esc(tname(me)) + '</b></div><div class="mid"><div class="en">VS</div><small>' + esc(next.home ? 'HOME' : 'AWAY') + '</small></div><div class="tm">' + emb(next.opp) + '<b>' + esc(tname(next.opp)) + '</b></div></div>' +
        '<div class="when">' + esc(fullDate(next.m.date)) + (next.m.kickoff ? '　' + esc(next.m.kickoff) + ' KICK OFF' : '') + (next.m.venue ? '　📍' + esc(next.m.venue) : '') + (d != null && d >= 0 ? '<span class="cd">' + (d === 0 ? 'TODAY' : 'あと ' + d + ' 日') + '</span>' : '') + '</div></div>';
    })() : '<div class="nextm"><div class="meta"><span class="lab">NEXT MATCH</span></div><p class="empty" style="padding:0">これからの試合は、日程が決まるとここに出ます。</p></div>') + '</div>';
    // LAST MATCH ＋ 順位
    const st = standings();
    const lastBox = last ? (() => {
      const me = last.home ? last.m.home : last.m.away, r = result(last), pk = pkText(last);
      return '<a class="card lastm" href="' + esc(matchUrl(last)) + '" style="display:block"><div class="meta"><span class="lab">LAST MATCH</span><span>' + esc(fullDate(last.m.date)) + '　' + esc(last.label) + (last.m.round ? '　' + esc(last.m.round) : '') + '</span></div>' +
        '<div class="board"><div class="tm">' + emb(me, true) + '<b>' + esc(tname(me)) + '</b></div><div class="mid"><div class="en">' + esc(myScore(last)) + ' - ' + esc(opScore(last)) + '</div><small>' + esc(pk || 'FULL TIME') + '</small></div><div class="tm">' + emb(last.opp) + '<b>' + esc(tname(last.opp)) + '</b></div></div>' +
        '<div class="rs"><span class="res ' + r + '" style="width:auto;padding:0 14px">' + RES[r] + '</span></div></a>';
    })() : emptyBox('まだ試合の結果はありません');
    html += band('', 'MATCH', '試合結果・順位', '<div class="duo">' + lastBox + '<div>' + (st.length ? standBox(st) : emptyBox('順位表は、リーグ戦が始まると出ます')) +
      '<div class="card" style="margin-top:12px">' + S.matches.filter(x => isDone(x.m)).slice(-3).reverse().map(matchRow).join('') + '</div></div></div>', '<a href="#matches">試合一覧 ›</a>');
    // LATEST NEWS
    html += band('alt', 'LATEST NEWS', '最新ニュース', S.news.length ? '<div class="ng compact">' + S.news.slice(0, 3).map(newsCard).join('') + '</div>' : emptyBox('ニュースはまだありません'), S.news.length ? '<a href="#news">ニュース一覧 ›</a>' : '');
    // PLAYERS（注目選手）
    const fp = featured(8);
    if (fp.length) html += band('dark', 'OUR PLAYERS', '注目選手', '<div class="pl">' + fp.map(card).join('') + '</div>', '<a href="#players">選手一覧 ›</a>');
    // ABOUT CLUB
    html += band('', 'ABOUT CLUB', 'クラブ紹介', aboutBlock(true), '<a href="#club">くわしく ›</a>');
    // GALLERY
    if (S.gallery.length) html += band('alt', 'GALLERY', 'ギャラリー', galleryGrid(S.gallery.slice(0, 7), true), '<a href="#gallery">すべて見る ›</a>');
    // OFFICIAL PARTNERS
    if (S.sponsors.length) html += band('', 'OFFICIAL PARTNERS', 'スポンサー', sponsorList());
    return html;
  }
  function standings() {
    const st = [];
    for (const x of S.teams) for (const g of S.data[x.comp.id].groups || []) { const row = (g.table || []).find(r => r.team?.id === x.team.id); if (row) st.push({ x, row, n: g.table.length, g }); }
    return st;
  }
  function standBox(st) {
    return '<div class="stand">' + st.map(({ x, row, n }) => '<a href="' + esc(CFG.site + 'results.html?comp=' + encodeURIComponent(x.comp.id) + '&tab=standings') + '"><small>' + esc(x.label) + '</small><b>' + esc(row.rank) + '<span>位</span></b> <em>/ ' + n + 'チーム　勝点 ' + esc(row.points) + '　' + esc(row.won) + '勝' + esc(row.drawn) + '分' + esc(row.lost) + '敗</em></a>').join('') + '</div>';
  }
  /* 注目選手：写真のある選手を、得点の多い順に */
  function featured(n) {
    const g = new Map(aggStats('ALL').map(p => [p.id, p.goals]));
    const withPh = S.players.filter(p => has(p.photo)), base = withPh.length >= 4 ? withPh : S.players;
    return [...base].sort((a, b) => (g.get(b.id) || 0) - (g.get(a.id) || 0) || (Number(a.no) || 999) - (Number(b.no) || 999)).slice(0, n);
  }

  /* ───────── NEWS ───────── */
  let NK = 'ALL', NQ = '', NP = 1;
  function newsCard(n) {
    const ph = img(n.photo, 600);
    return '<a class="nc" href="#news/' + encodeURIComponent(n.id || '') + '"><span class="im">' + (ph ? '<img src="' + esc(ph) + '" alt="" loading="lazy" decoding="async" onerror="this.remove()">' : '<span class="en">NEWS</span>') + '</span>' +
      '<span class="bd"><time>' + esc(String(n.date || '').replace(/-/g, '.')) + '</time>' + (n.kind ? '<span class="tag">' + esc(n.kind) + '</span>' : '') + '<b>' + esc(n.title) + '</b></span></a>';
  }
  function viewNews(id) {
    if (id) {
      const n = S.news.find(x => String(x.id) === id);
      if (n) {
        const ph = img(n.photo, 1400), u = safeUrl(n.url);
        const rel = S.news.filter(x => x !== n && (!n.kind || x.kind === n.kind)).slice(0, 3);
        return pageTop('NEWS', 'ニュース') + '<section class="band"><div class="wrap"><article class="art"><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:13px;color:var(--sub)"><time>' + esc(fullDate(n.date)) + '</time>' + (n.kind ? '<span class="tag">' + esc(n.kind) + '</span>' : '') + '</div>' +
          '<h2>' + esc(n.title) + '</h2>' + (ph ? '<figure><img src="' + esc(ph) + '" alt="" decoding="async" onerror="this.parentNode.remove()"></figure>' : '') +
          (has(n.body) ? '<div class="body">' + richText(n.body) + '</div>' : '') + (u ? '<a class="btn" href="' + esc(u) + '" target="_blank" rel="noopener" style="margin-top:20px">詳しく見る ↗</a>' : '') + '<br><a class="back" href="#news">‹ ニュース一覧へ</a></article></div></section>' +
          (rel.length ? band('alt', 'RELATED', '関連記事', '<div class="ng">' + rel.map(newsCard).join('') + '</div>') : '');
      }
    }
    const kinds = [...new Set(S.news.map(n => n.kind).filter(Boolean))];
    const list = S.news.filter(n => (NK === 'ALL' || n.kind === NK) && (!NQ || (n.title + ' ' + (n.body || '')).toLowerCase().includes(NQ.toLowerCase())));
    const per = 9, pages = Math.max(1, Math.ceil(list.length / per)); if (NP > pages) NP = pages;
    const chips = kinds.length ? '<div class="chips" data-k="nk">' + [['ALL', 'すべて'], ...kinds.map(k => [k, k])].map(([k, l]) => '<button aria-pressed="' + (k === NK) + '" data-v="' + esc(k) + '">' + esc(l) + '</button>').join('') + '</div>' : '';
    return pageTop('NEWS', 'ニュース') + '<section class="band"><div class="wrap">' + chips +
      '<form class="search" id="nq"><input type="search" placeholder="キーワードでさがす" value="' + esc(NQ) + '" aria-label="ニュースをさがす"><button class="btn" type="submit">検索</button></form>' +
      (list.length ? '<div class="ng">' + list.slice((NP - 1) * per, NP * per).map(newsCard).join('') + '</div>' : emptyBox(S.news.length ? '見つかりませんでした' : 'ニュースはまだありません（管理画面の「チームニュース」に入れると表示されます）')) +
      (pages > 1 ? '<div class="pager">' + Array.from({ length: pages }, (_, i) => '<button data-np="' + (i + 1) + '" aria-current="' + (i + 1 === NP) + '">' + (i + 1) + '</button>').join('') + '</div>' : '') + '</div></section>';
  }

  /* ───────── MATCH ───────── */
  let MT = 'ALL', MS = 'up';
  function viewMatches() {
    const today = jstToday();
    const chipsT = S.teams.length > 1 ? '<div class="chips" data-k="mt">' + [['ALL', 'すべての大会'], ...S.teams.map(x => [x.team.id + '|' + x.comp.id, x.label])].map(([k, l]) => '<button aria-pressed="' + (k === MT) + '" data-v="' + esc(k) + '">' + esc(l) + '</button>').join('') + '</div>' : '';
    const chipsS = '<div class="chips" data-k="ms">' + [['up', 'NEXT MATCH（これから）'], ['done', 'RESULT（結果）']].map(([k, l]) => '<button aria-pressed="' + (k === MS) + '" data-v="' + k + '">' + l + '</button>').join('') + '</div>';
    const pick = x => MT === 'ALL' || x.team.id + '|' + x.comp.id === MT;
    let list = S.matches.filter(pick);
    list = MS === 'up' ? list.filter(x => !isDone(x.m) && (x.m.date || '9999') >= today) : list.filter(x => isDone(x.m)).reverse();
    const sum = { W: 0, D: 0, L: 0 }; S.matches.filter(x => pick(x) && isDone(x.m)).forEach(x => sum[result(x)]++);
    const tables = standings().filter(s => MT === 'ALL' || s.x.team.id + '|' + s.x.comp.id === MT).map(({ x, g }) =>
      '<h3 style="margin:24px 0 10px;font-size:15px">' + esc(x.label) + (g.name ? '　' + esc(g.name) : '') + '</h3><div class="card tw"><table><thead><tr><th>順位</th><th class="l">チーム</th><th>試合</th><th>勝点</th><th>勝</th><th>分</th><th>敗</th><th>得失点</th></tr></thead><tbody>' +
      (g.table || []).map(r => '<tr' + (r.team?.id === x.team.id ? ' class="me"' : '') + '><td>' + esc(r.rank) + '</td><td class="l">' + esc(tname(r.team)) + '</td><td>' + esc(r.played ?? '') + '</td><td><b>' + esc(r.points) + '</b></td><td>' + esc(r.won) + '</td><td>' + esc(r.drawn) + '</td><td>' + esc(r.lost) + '</td><td>' + esc(r.gd ?? '') + '</td></tr>').join('') + '</tbody></table></div>').join('');
    return pageTop('MATCH', '試合情報') + '<section class="band"><div class="wrap">' + chipsT + chipsS +
      '<p style="margin:0 0 12px;font-size:14px;color:var(--sub)">今季の成績：<b style="color:var(--ink)">' + sum.W + '勝 ' + sum.D + '分 ' + sum.L + '敗</b></p>' +
      (list.length ? '<div class="card">' + list.map(matchRow).join('') + '</div>' : emptyBox(MS === 'up' ? 'これからの試合は登録されていません' : 'まだ結果はありません')) +
      '<p style="font-size:12px;color:var(--sub);margin:10px 2px 0">試合を押すと、公式記録（得点経過・出場選手・交代・警告）が開きます。</p></div></section>' +
      (tables ? band('alt', 'STANDINGS', '順位表', tables) : '');
  }

  /* ───────── TEAM（選手・スタッフ・個人成績） ───────── */
  let PT = 'ALL', PP = 'ALL', TV = 'players';
  function viewPlayers(id) {
    const teamOpts = S.teams.filter(x => S.players.some(p => p.teams.some(t => t.teamId === x.team.id)));
    const chipsV = '<div class="chips" data-k="tv">' + [['players', '選手一覧'], ['stats', '個人成績'], ['staff', 'スタッフ']].map(([k, l]) => '<button aria-pressed="' + (k === TV) + '" data-v="' + k + '">' + l + '</button>').join('') + '</div>';
    let body = '';
    if (TV === 'stats') body = statsTable();
    else if (TV === 'staff') body = S.staff.length ? '<div class="card tw"><table><tbody>' + S.staff.map(s => '<tr><td class="l" style="color:var(--sub);width:40%">' + esc(s.role) + '</td><td class="l"><b>' + esc(s.name) + '</b></td></tr>').join('') + '</tbody></table></div>' : emptyBox('スタッフの登録はまだありません');
    else {
      const chipsT = teamOpts.length > 1 ? '<div class="chips" data-k="pt">' + [['ALL', 'すべてのチーム'], ...teamOpts.map(x => [x.team.id + '|' + x.comp.id, x.label])].map(([k, l]) => '<button aria-pressed="' + (k === PT) + '" data-v="' + esc(k) + '">' + esc(l) + '</button>').join('') + '</div>' : '';
      const chipsP = '<div class="chips" data-k="pp">' + [['ALL', 'ALL'], ['GK', 'GK'], ['DF', 'DF'], ['MF', 'MF'], ['FW', 'FW']].map(([k, l]) => '<button aria-pressed="' + (k === PP) + '" data-v="' + k + '">' + l + '</button>').join('') + '</div>';
      const [tid, cid] = PT === 'ALL' ? [] : PT.split('|');
      const list = S.players.filter(p => PT === 'ALL' || p.teams.some(t => t.teamId === tid && t.comp === cid)).map(p => {
        const t = PT === 'ALL' ? p.teams[0] : p.teams.find(t => t.teamId === tid && t.comp === cid);
        return { ...p, no: t?.no ?? p.no };
      });
      const groups = [['GK', 'ゴールキーパー'], ['DF', 'ディフェンダー'], ['MF', 'ミッドフィルダー'], ['FW', 'フォワード'], ['', 'その他']].filter(([k]) => PP === 'ALL' || k === PP);
      body = chipsT + chipsP + (groups.map(([k, l]) => {
        const ps = list.filter(p => k ? p.pos === k : !['GK', 'DF', 'MF', 'FW'].includes(p.pos)).sort((a, b) => (Number(a.no) || 999) - (Number(b.no) || 999));
        if (!ps.length) return '';
        return '<div class="pos"><h3><span class="en">' + (k || 'OTHERS') + '</span><span>' + l + '　' + ps.length + '人</span></h3><div class="pl">' + ps.map(card).join('') + '</div></div>';
      }).join('') || emptyBox('選手の登録はまだありません'));
    }
    setTimeout(() => { if (id) openPlayer(id); }, 0);
    return pageTop('TEAM', '選手・スタッフ') + '<section class="band dark"><div class="wrap">' + chipsV + body + '</div></section>';
  }
  function card(p) {
    const ph = img(p.photo, 500);
    return '<button type="button" class="p" data-pid="' + esc(p.id) + '"><span class="f">' + (ph ? '<img src="' + esc(ph) + '" alt="" loading="lazy" decoding="async" onerror="this.remove()">' : '<span class="ini">' + esc([...String(p.name || '')].slice(0, 1).join('')) + '</span>') +
      (has(p.no) ? '<span class="no">' + esc(p.no) + '</span>' : '') + '</span><span class="b"><span class="nm">' + (has(p.no) ? '<i>' + esc(p.no) + '</i>' : '') + '<b>' + esc(p.name) + '</b></span>' +
      '<small>' + [p.pos, p.grade ? esc(p.grade) + '年' : '', p.school || ''].filter(Boolean).map(esc).join('・') + '</small></span></button>';
  }
  function openPlayer(id) {
    const p = S.players.find(x => String(x.id) === String(id)); if (!p) return;
    const ph = img(p.photo, 900);
    const box = document.createElement('div'); box.className = 'pm'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', p.name);
    box.innerHTML = '<div class="box"><button class="x" type="button" aria-label="閉じる">×</button><div class="ph2">' + (ph ? '<img src="' + esc(ph) + '" alt="" onerror="this.remove()">' : '') + (has(p.no) ? '<span class="no">' + esc(p.no) + '</span>' : '') + '</div>' +
      '<div class="in"><span class="tag">' + esc(p.pos || 'PLAYER') + '</span><h3>' + esc(p.name) + '</h3>' + (p.kana ? '<small style="color:var(--sub)">' + esc(p.kana) + '</small>' : '') +
      '<dl>' + [['背番号', p.no], ['ポジション', p.pos], ['学年', p.grade ? p.grade + '年' : ''], ['出身校', p.school], ['所属', (p.teams || []).map(t => t.label).join('・')]].filter(r => has(r[1])).map(r => '<dt>' + r[0] + '</dt><dd>' + esc(r[1]) + '</dd>').join('') + '</dl>' +
      (has(p.comment) ? '<p style="margin:0;font-size:14px;line-height:1.8">「' + esc(p.comment) + '」</p>' : '') +
      compStats(p.id) +
      '<p style="font-size:11.5px;color:var(--sub);margin:12px 0 0">成績は公式記録から大会ごとに自動で集計しています。</p></div></div>';
    const close = () => { box.remove(); document.removeEventListener('keydown', esc1); if (location.hash.startsWith('#players/')) history.replaceState(null, '', '#players'); };
    const esc1 = e => { if (e.key === 'Escape') close(); };
    box.addEventListener('click', e => { if (e.target === box || e.target.closest('.x')) close(); });
    document.addEventListener('keydown', esc1);
    document.body.appendChild(box); box.querySelector('.x').focus();
  }
  /* 大会ごとの成績（選手のくわしい情報の中） */
  function compStats(id) {
    const rows = [];
    for (const s of S.stats) {
      const q = s.players.find(x => String(x.id) === String(id));
      if (q && (Number(q.apps) || Number(q.goals) || Number(q.assists) || Number(q.yc) || Number(q.rc))) rows.push({ label: s.label, ...q });
    }
    if (!rows.length) return '<div class="cst"><h4>大会ごとの成績</h4><p class="cst-n" style="font-size:13px">まだ公式戦の記録はありません。</p></div>';
    const n = v => Number(v) || 0, d = v => n(v) ? esc(n(v)) : '<span style="opacity:.4">–</span>';
    return '<div class="cst"><h4>大会ごとの成績</h4><div class="cst-w"><table><thead><tr><th class="l">大会</th><th>出場</th><th>得点</th><th>アシスト</th><th>時間</th><th>警告</th><th>退場</th></tr></thead><tbody>' +
      rows.map(r => '<tr><td class="l">' + esc(r.label) + '</td><td>' + d(r.apps) + (n(r.starts) ? '<small>(' + n(r.starts) + ')</small>' : '') + '</td><td class="g">' + d(r.goals) + '</td><td>' + d(r.assists) + '</td><td>' + (n(r.min) ? n(r.min) + '′' : d(0)) + '</td><td>' + d(r.yc) + '</td><td>' + d(r.rc) + '</td></tr>').join('') +
      '</tbody></table></div><p class="cst-n">出場の（ ）は先発の数</p></div>';
  }
  function aggStats(sel) {
    const m = new Map();
    for (const s of S.stats) {
      if (sel !== 'ALL' && s.team.id + '|' + s.comp.id !== sel) continue;
      for (const p of s.players) {
        if (!m.has(p.id)) m.set(p.id, { id: p.id, name: p.name, no: p.no, apps: 0, starts: 0, min: 0, goals: 0, assists: 0, yc: 0, rc: 0 });
        const q = m.get(p.id);
        for (const k of ['apps', 'starts', 'min', 'goals', 'assists', 'yc', 'rc']) q[k] += Number(p[k]) || 0;
        if (!has(q.no) && has(p.no)) q.no = p.no;
      }
    }
    return [...m.values()];
  }
  let SK = 'goals';
  /* 個人成績：大会ごとの表を、上から順に全部ならべる（切り替えなし・通算は出さない） */
  function statsTable() {
    const one = x => {
      const all = aggStats(x.team.id + '|' + x.comp.id);
      const cols = [['goals', '得点'], ['assists', 'アシスト'], ['apps', '出場'], ['starts', '先発'], ['min', '出場時間'], ['yc', '警告'], ['rc', '退場']].filter(([k]) => k === 'goals' || k === SK || all.some(p => p[k] > 0));
      const rows = all.filter(p => p.apps || p.goals || p.assists || p.yc || p.rc).sort((a, b) => ((b[SK] || 0) - (a[SK] || 0)) || (b.goals - a.goals) || (b.min - a.min));
      return '<h3 class="st-h">' + esc(x.label) + '</h3>' + (rows.length ? '<div class="card tw"><table><thead><tr><th class="l">選手</th>' + cols.map(([k, l]) => '<th><button data-sort="' + k + '"' + (k === SK ? ' aria-sort="descending"' : '') + '>' + l + (k === SK ? ' ▼' : '') + '</button></th>').join('') + '</tr></thead><tbody>' +
        rows.map(p => '<tr><td class="l">' + (has(p.no) ? '<span style="color:var(--sub);display:inline-block;min-width:26px">' + esc(p.no) + '</span>' : '') + '<button class="st-p" type="button" data-pid="' + esc(p.id) + '">' + esc(p.name) + '</button></td>' + cols.map(([k]) => '<td' + (k === SK ? ' style="font-weight:900"' : '') + '>' + (k === 'min' ? (p.min ? p.min + '分' : '−') : (p[k] || (k === 'yc' || k === 'rc' ? '−' : 0))) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>' : emptyBox('まだ記録はありません'));
    };
    return (S.stats.length ? S.stats.map(one).join('') : emptyBox('まだ記録はありません')) +
      '<p style="font-size:12px;color:var(--sub);margin:10px 2px 0">公式記録から大会ごとに自動で集計しています。見出しを押すと並べ替えます。選手の名前を押すと、その選手の大会ごとの成績を見られます。</p>';
  }

  /* ───────── ABOUT・GALLERY・CONTACT ───────── */
  function aboutBlock(short) {
    const p = S.profile || {};
    const rows = [['創部', p.founded], ['部員数', p.members], ['主将', p.captain], ['監督', p.coach], ['活動場所', p.ground]].filter(r => has(r[1]));
    const sns = [['公式サイト', p.website], ['Instagram', p.sns?.instagram], ['X', p.sns?.x], ['Facebook', p.sns?.facebook], ['YouTube', p.sns?.youtube], ['TikTok', p.sns?.tiktok]].filter(r => safeUrl(r[1]));
    if (!has(p.intro) && !rows.length && !sns.length) return emptyBox('クラブ紹介は準備中です（管理画面の「チーム紹介」に入れると表示されます）');
    const ph = img(p.teamPhoto, 1000);
    const intro = short && has(p.intro) ? String(p.intro).slice(0, 220) + (String(p.intro).length > 220 ? '…' : '') : p.intro;
    return '<div class="about"><div class="im">' + (ph ? '<img src="' + esc(ph) + '" alt="" loading="lazy" onerror="this.remove()">' : '') + '</div><div>' + (has(intro) ? '<p class="intro">' + esc(intro) + '</p>' : '') +
      (rows.length ? '<dl class="prof">' + rows.map(r => '<dt>' + r[0] + '</dt><dd>' + esc(r[1]) + '</dd>').join('') + '</dl>' : '') +
      (sns.length ? '<div class="sns">' + sns.map(r => '<a href="' + esc(safeUrl(r[1])) + '" target="_blank" rel="noopener">' + r[0] + ' ↗</a>').join('') + '</div>' : '') + '</div></div>';
  }
  function viewClub() {
    const p = S.profile || {};
    const block = (cls, en, ja, t) => has(t) ? band(cls, en, ja, '<div class="card pad"><p class="intro">' + richText(t) + '</p></div>') : '';
    let html = pageTop('ABOUT', 'クラブ紹介') + band('', 'CLUB', 'チーム概要', aboutBlock(false));
    html += block('alt', 'PHILOSOPHY', '理念', p.philosophy);
    if (has(p.history)) html += band('', 'HISTORY', '歴史・沿革', '<div class="card pad hist">' + String(p.history).split(/\n/).map(l => /^\s*(19|20)\d{2}(年度?)?\s*$/.test(l) ? '<h3>' + esc(l.trim()) + '</h3>' : (l.trim() ? '<p>' + richText(l) + '</p>' : '')).join('') + '</div>');
    if (S.staff.length) html += band('alt', 'STAFF', 'スタッフ', '<div class="card tw"><table><tbody>' + S.staff.map(s => '<tr><td class="l" style="color:var(--sub);width:40%">' + esc(s.role) + '</td><td class="l"><b>' + esc(s.name) + '</b></td></tr>').join('') + '</tbody></table></div>');
    if (has(p.ground)) html += band('', 'ACCESS', '活動拠点', '<div class="card pad"><p style="margin:0;font-size:15px"><b>' + esc(p.ground) + '</b></p><a class="btn ghost" style="margin-top:14px" href="https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(p.ground) + '" target="_blank" rel="noopener">地図で見る ↗</a></div>');
    if (S.sponsors.length) html += band('alt', 'OFFICIAL PARTNERS', 'スポンサー', sponsorList());
    return html;
  }
  function galleryGrid(list, swipe) {
    return '<div class="gal' + (swipe ? ' swipe' : '') + '">' + list.map((g, i) => {
      const u = img(g.photo, 800);
      return u ? '<a href="#" data-gi="' + S.gallery.indexOf(g) + '"><img src="' + esc(u) + '" alt="' + esc(g.caption || '') + '" loading="lazy" decoding="async" onerror="this.parentNode.remove()">' + (g.caption || g.date ? '<span>' + esc(g.caption || '') + (g.date ? '<small>' + esc(fullDate(g.date)) + '</small>' : '') + '</span>' : '') + '</a>' : '';
    }).join('') + '</div>';
  }
  function viewGallery() {
    return pageTop('GALLERY', 'ギャラリー') + '<section class="band"><div class="wrap">' + (S.gallery.length ? galleryGrid(S.gallery) : emptyBox('写真はまだありません（管理画面の「ギャラリー」に入れると表示されます）')) +
      (safeUrl(S.profile?.sns?.youtube) ? '<p style="margin-top:20px"><a class="btn" href="' + esc(safeUrl(S.profile.sns.youtube)) + '" target="_blank" rel="noopener">▶ YouTube で動画を見る</a></p>' : '') + '</div></section>';
  }
  function lightbox(i) {
    const list = S.gallery.filter(g => img(g.photo, 100)); let k = Math.max(0, list.indexOf(S.gallery[i]));
    const box = document.createElement('div'); box.className = 'lb'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
    const draw = () => { const g = list[k]; box.innerHTML = '<div><img src="' + esc(img(g.photo, 1800)) + '" alt="' + esc(g.caption || '') + '"><p>' + esc(g.caption || '') + (g.date ? '　' + esc(fullDate(g.date)) : '') + '</p></div><button class="x" aria-label="閉じる">×</button>' + (list.length > 1 ? '<button class="pv" aria-label="前の写真">‹</button><button class="nx" aria-label="次の写真">›</button>' : ''); };
    const close = () => { box.remove(); document.removeEventListener('keydown', key); };
    const key = e => { if (e.key === 'Escape') close(); if (e.key === 'ArrowLeft') { k = (k - 1 + list.length) % list.length; draw(); } if (e.key === 'ArrowRight') { k = (k + 1) % list.length; draw(); } };
    box.addEventListener('click', e => { if (e.target.closest('.x') || e.target === box) return close(); if (e.target.closest('.pv')) { k = (k - 1 + list.length) % list.length; draw(); } if (e.target.closest('.nx')) { k = (k + 1) % list.length; draw(); } });
    document.addEventListener('keydown', key); draw(); document.body.appendChild(box);
  }
  function sponsorList() {
    return '<div class="spn">' + S.sponsors.map(s => {
      const u = safeUrl(s.url), lg = img(s.logo, 400), tag = u ? 'a' : 'div';
      return '<' + tag + (u ? ' href="' + esc(u) + '" target="_blank" rel="noopener sponsored"' : '') + '>' + (lg ? '<img src="' + esc(lg) + '" alt="' + esc(s.name) + '" loading="lazy" onerror="this.replaceWith(document.createTextNode(this.alt))">' : '<b>' + esc(s.name) + '</b>') + '</' + tag + '>';
    }).join('') + '</div>';
  }
  /* CONTACT：入部・問い合わせ（フォームは置かず、チーム紹介の「入部の問い合わせ」へ） */
  function viewContact() {
    const p = S.profile || {};
    const c = String(p.joinContact || '').trim(), url = safeUrl(c), mail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c) ? c : '';
    const go = (label, subject) => url ? '<a class="btn" href="' + esc(url) + '" target="_blank" rel="noopener">' + label + ' ↗</a>' : mail ? '<a class="btn" href="mailto:' + esc(mail) + '?subject=' + encodeURIComponent(subject) + '">' + label + '</a>' : '';
    const box = (t, d, label, subj) => '<div class="card"><h3>' + t + '</h3><p>' + d + '</p>' + (go(label, subj) || '<p style="margin:0;font-size:13px">' + (has(c) ? '問い合わせ先：' + esc(c) : '問い合わせ先は準備中です') + '</p>') + '</div>';
    return pageTop('CONTACT', 'お問い合わせ') + '<section class="band"><div class="wrap">' +
      (has(p.join) ? '<div class="card pad" style="margin-bottom:16px"><h3 style="margin:0 0 10px">入部をお考えの方へ</h3><p class="intro">' + richText(p.join) + '</p></div>' : '') +
      '<div class="contact">' + box('入部・加入希望', '練習の見学・体験の申し込みなど', '入部について問い合わせる', '入部について') + box('取材のご依頼', 'メディア・取材についてのお問い合わせ', '取材について問い合わせる', '取材のご依頼') + box('スポンサーのご相談', '協賛・ご支援についてのご相談', 'スポンサーについて相談する', 'スポンサーのご相談') + '</div>' +
      '<p style="font-size:12px;color:var(--sub);margin-top:16px">お預かりした個人情報は、お問い合わせへの返答のためだけに使います。</p></div></section>';
  }

  /* ───────── 画面の切り替え ───────── */
  const VIEWS = { home: viewHome, news: viewNews, matches: viewMatches, players: viewPlayers, stats: () => { TV = 'stats'; return viewPlayers(); }, club: viewClub, gallery: viewGallery, contact: viewContact };
  const NAVMAP = { stats: 'players' };
  function route() {
    const h = decodeURIComponent(location.hash.replace(/^#/, '')) || 'home';
    const [v, arg] = h.split('/');
    const view = VIEWS[v] ? v : 'home', cur = NAVMAP[view] || view;
    document.querySelectorAll('.nav a,.bnav a').forEach(a => a.setAttribute('aria-current', a.getAttribute('href') === '#' + cur ? 'page' : 'false'));
    $('hero').hidden = view !== 'home';
    $('main').innerHTML = VIEWS[view](arg);
    document.title = ({ home: '', news: 'ニュース | ', matches: '試合情報 | ', players: '選手・スタッフ | ', stats: '個人成績 | ', club: 'クラブ紹介 | ', gallery: 'ギャラリー | ', contact: 'お問い合わせ | ' }[view]) + siteName();
    reveal();
  }
  /* スクロールで、ふわっと表示（動きを減らす設定のときは、すぐ表示） */
  let IO = null;
  function reveal() {
    const els = document.querySelectorAll('.reveal:not(.on)');
    if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) { els.forEach(e => e.classList.add('on')); return; }
    IO = IO || new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { en.target.classList.add('on'); IO.unobserve(en.target); } }), { rootMargin: '0px 0px -8% 0px' });
    els.forEach(e => IO.observe(e));
  }
  $('main').addEventListener('click', e => {
    const b = e.target.closest('.chips button');
    if (b) {
      const k = b.parentNode.dataset.k, v = b.dataset.v;
      if (k === 'pt') PT = v; if (k === 'pp') PP = v; if (k === 'tv') TV = v; if (k === 'mt') MT = v; if (k === 'ms') MS = v; if (k === 'nk') { NK = v; NP = 1; }
      route(); return;
    }
    const s = e.target.closest('th button[data-sort]'); if (s) { SK = s.dataset.sort; route(); return; }
    const pg = e.target.closest('[data-np]'); if (pg) { NP = +pg.dataset.np; route(); window.scrollTo(0, 0); return; }
    const pc = e.target.closest('.p[data-pid],.st-p[data-pid]'); if (pc) { openPlayer(pc.dataset.pid); return; }
    const gi = e.target.closest('[data-gi]'); if (gi) { e.preventDefault(); lightbox(+gi.dataset.gi); }
  });
  $('main').addEventListener('submit', e => { if (e.target.id === 'nq') { e.preventDefault(); NQ = e.target.querySelector('input').value.trim(); NP = 1; route(); } });
  window.addEventListener('hashchange', () => { route(); window.scrollTo(0, 0); });
  const toggleMenu = o => { $('nav').classList.toggle('open', o); $('menu').setAttribute('aria-expanded', String(o)); };
  $('menu').addEventListener('click', () => toggleMenu(!$('nav').classList.contains('open')));
  $('nav').addEventListener('click', e => { if (e.target.closest('a')) toggleMenu(false); });
  const bm = document.getElementById('bMenu'); if (bm) bm.addEventListener('click', () => { window.scrollTo(0, 0); toggleMenu(true); });

  /* ───────── 大学ごとの見た目 ───────── */
  const siteName = () => CFG.name || (CFG.univ + 'サッカー部');
  /* チームカラーの上の文字色（明るい色なら黒） */
  function inkOn(c) {
    const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c || ''); if (!m) return '#fff';
    let h = m[1]; if (h.length === 3) h = h.split('').map(x => x + x).join('');
    const n = parseInt(h, 16), L = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); });
    return (0.2126 * L[0] + 0.7152 * L[1] + 0.0722 * L[2]) > 0.42 ? '#111827' : '#fff';
  }
  function applyBrand() {
    const p = S.profile || {};
    const c = /^#[0-9a-f]{3,8}$/i.test(CFG.color) ? CFG.color : /^#[0-9a-f]{3,8}$/i.test(p.color || '') ? p.color : '#1976D2';
    const root = document.documentElement.style, tpl = document.body.getAttribute('data-tpl') || 'a';
    root.setProperty('--c', c);
    root.setProperty('--c-ink', inkOn(c));
    if (tpl === 'a') root.setProperty('--c-text', 'color-mix(in srgb, ' + c + ' 55%, #fff)');
    $('siteName').textContent = siteName();
    $('siteEn').textContent = CFG.en || '';
    const eu = img(p.emblem, 200), em = $('emb');
    if (eu) { em.classList.add('img'); em.innerHTML = '<img src="' + esc(eu) + '" alt="' + esc(CFG.univ) + '">'; em.querySelector('img').onerror = () => { em.classList.remove('img'); em.textContent = ini(); }; }
    else em.textContent = ini();
    const hu = img(CFG.hero || p.teamPhoto, 1800);
    const lead = CFG.lead || String(p.intro || '').split(/[。\n]/)[0];
    const big = CFG.en ? CFG.en.replace(/\s*(FOOTBALL|SOCCER)\s+CLUB\s*$/i, '').trim() || CFG.en : 'FOOTBALL CLUB';
    $('hero').innerHTML = '<div class="ph">' + (hu ? '<img src="' + esc(hu) + '" alt="" fetchpriority="high" onerror="this.remove()">' : '') + '</div>' +
      '<div class="wrap in"><div><div class="eb">' + esc(CFG.en ? 'FOOTBALL CLUB' : 'OFFICIAL SITE') + '</div><div class="en big">' + esc(big) + '</div><h1>' + esc(siteName()) + '</h1>' +
      (lead ? '<p>' + esc(lead + (/[。！!]$/.test(lead) ? '' : '。')) + '</p>' : '') + '<div class="cta"><a class="btn" href="#matches">試合日程を見る</a><a class="btn ghost" href="#players">選手を見る</a></div></div>' +
      '<div class="side">' + (hu ? '<img src="' + esc(img(CFG.hero || p.teamPhoto, 1200)) + '" alt="" onerror="this.remove()">' : '') + '</div></div>' + (CFG.heroCaption ? '<span class="cap">' + esc(CFG.heroCaption) + '</span>' : '');
    $('ftName').textContent = siteName();
    const sns = [['Instagram', p.sns?.instagram], ['X', p.sns?.x], ['Facebook', p.sns?.facebook], ['YouTube', p.sns?.youtube], ['TikTok', p.sns?.tiktok]].filter(r => safeUrl(r[1]));
    const fs = document.getElementById('ftSns'); if (fs) fs.innerHTML = sns.map(r => '<a href="' + esc(safeUrl(r[1])) + '" target="_blank" rel="noopener">' + r[0] + '</a>').join('');
    const fav = document.querySelector('link[rel=icon]'); if (fav && eu) fav.href = eu;
  }

  (async () => {
    try {
      if (!CFG.univ) throw Error('CLUB.univ（大学名）が設定されていません');
      await load();
      if (!S.teams.length) throw Error(CFG.univ + ' のチームが、今年度の大会に見つかりません');
      applyBrand();
      const up = [...Object.values(S.data)].map(d => d.updatedAt).filter(Boolean).sort().pop();
      $('updated').textContent = up ? '最終更新 ' + String(up).replace('T', ' ').slice(0, 16) : '';
      route();
    } catch (e) {
      $('main').innerHTML = '<div class="wrap" style="padding:40px 0"><div class="card"><p class="empty">データを読み込めませんでした：' + esc(e.message) + '</p></div></div>';
    }
  })();
})();
