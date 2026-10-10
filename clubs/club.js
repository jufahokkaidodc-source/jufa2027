/* 大学の独自サイト（共通テンプレート）
 *  clubs/index.html が clubs.json から window.CLUB を決めてから、このファイルを読み込む
 *    univ  … チームマスターの大学名（必須）。この大学のチームを、全大会から集める
 *    name  … サイトの名前（例：札幌大学サッカー部）。空なら「大学名＋サッカー部」
 *    en    … 英語名（任意）
 *    color … 強調色。空ならチーム紹介の「チームカラー」
 *    hero  … トップ画像のURL（ドライブの共有リンク可）。空ならチーム紹介の「チーム写真」
 *    heroCaption … トップ画像の説明（任意）
 *    lead  … トップの一言（任意）。空ならチーム紹介の紹介文の最初の一文
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
  function md(s) { const m = ymd(s); return m ? (+m[2]) + '/' + (+m[3]) : (s || '未定'); }
  function wd(s) { const m = ymd(s); return m ? WD[new Date(+m[1], +m[2] - 1, +m[3]).getDay()] : ''; }
  function fullDate(s) { const m = ymd(s); return m ? m[1] + '.' + m[2] + '.' + m[3] + '（' + wd(s) + '）' : (s || ''); }
  function daysUntil(s) { const a = ymd(s), b = ymd(jstToday()); if (!a || !b) return null; return Math.round((Date.UTC(+a[1], +a[2] - 1, +a[3]) - Date.UTC(+b[1], +b[2] - 1, +b[3])) / 864e5); }
  const safeUrl = u => /^https?:\/\//i.test(String(u || '')) ? String(u) : '';
  function richText(t) { return esc(t).replace(/(https?:\/\/[^\s<>"']+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>').replace(/\n/g, '<br>'); }
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
    // 名前：大会名（同じ大会に複数チームがあるときはチーム名も）
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
          q.teams.push({ teamId: t.team.id, comp: comp.id, no: p.no });
          for (const k of ['photo', 'comment', 'school', 'grade', 'kana']) if (!has(q[k]) && has(p[k])) q[k] = p[k];
        }
      }
    }
    S.players = [...pmap.values()];
    S.news.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    // 試合（全大会）
    for (const x of S.teams) {
      for (const m of S.data[x.comp.id].matches || []) {
        if (m.placeholder) continue;
        const home = m.home?.id === x.team.id, away = m.away?.id === x.team.id;
        if (!home && !away) continue;
        S.matches.push({ comp: x.comp, label: x.label, team: x.team, m, home, opp: home ? m.away : m.home });
      }
    }
    S.matches.sort((a, b) => String(a.m.date || '9999').localeCompare(String(b.m.date || '9999')) || String(a.m.kickoff || '').localeCompare(String(b.m.kickoff || '')));
    // 選手の記録（大会ごと）
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
  function scoreText(x) {
    const m = x.m, s = m.score, my = x.home ? s.home : s.away, op = x.home ? s.away : s.home;
    const pk = pkPair(s.pk);
    return esc(my) + ' - ' + esc(op) + (pk ? '<small style="font-size:11px;color:var(--muted);margin-left:4px">PK ' + esc(x.home ? pk[0] + '-' + pk[1] : pk[1] + '-' + pk[0]) + '</small>' : '');
  }
  function matchRow(x) {
    const m = x.m, r = result(x), done = isDone(m);
    return '<a class="mr" href="' + esc(CFG.results + '?comp=' + encodeURIComponent(x.comp.id)) + '">' +
      '<div class="d"><b>' + esc(md(m.date)) + '</b>（' + esc(wd(m.date)) + '）</div>' +
      '<div class="o"><b>vs ' + esc(tname(x.opp)) + '</b><small>' + esc(x.label) + (m.round ? '　' + esc(m.round) : '') + (m.venue ? '　' + esc(m.venue) : '') + '</small></div>' +
      '<div class="s">' + (done ? scoreText(x) + '<span class="res ' + r + '">' + RES[r] + '</span>' : '<span class="ko">' + esc(m.kickoff ? m.kickoff + ' KO' : '予定') + '</span>') + '</div></a>';
  }
  const sec = (en, ja, inner, link) => '<section class="sec"><div class="sh"><h2><small>' + en + '</small>' + ja + '</h2>' + (link || '') + '</div>' + inner + '</section>';
  const emptyBox = t => '<div class="card"><p class="empty">' + esc(t) + '</p></div>';

  /* ───────── HOME ───────── */
  function viewHome() {
    const today = jstToday();
    const next = S.matches.find(x => !isDone(x.m) && (x.m.date || '9999') >= today);
    const last = S.matches.filter(x => isDone(x.m)).slice(-5).reverse();
    let html = '';
    // 次の試合
    if (next) {
      const d = daysUntil(next.m.date);
      html += sec('NEXT MATCH', '次の試合', '<div class="next"><div class="meta"><span class="lab">NEXT</span><span>' + esc(next.label) + (next.m.round ? '　' + esc(next.m.round) : '') + '</span></div>' +
        '<div class="vs"><b>' + esc(tname(next.home ? next.m.home : next.m.away)) + '</b><i>VS</i><b>' + esc(tname(next.opp)) + '</b></div>' +
        '<div class="when">' + esc(fullDate(next.m.date)) + (next.m.kickoff ? '　' + esc(next.m.kickoff) + ' キックオフ' : '') + (next.m.venue ? '<br>' + esc(next.m.venue) : '') +
        (d != null && d >= 0 ? '<br><span class="cd">' + (d === 0 ? '今日' : 'あと ' + d + ' 日') + '</span>' : '') + '</div></div>');
    }
    // 順位（リーグ戦）
    const st = [];
    for (const x of S.teams) {
      const d = S.data[x.comp.id];
      for (const g of d.groups || []) { const row = (g.table || []).find(r => r.team?.id === x.team.id); if (row) st.push({ x, row, n: g.table.length }); }
    }
    if (st.length) html += sec('STANDINGS', '順位', '<div class="stand">' + st.map(({ x, row, n }) => '<a href="' + esc(CFG.results + '?comp=' + encodeURIComponent(x.comp.id)) + '"><small>' + esc(x.label) + '</small><b>' + esc(row.rank) + '<span>位</span></b> <em>/ ' + n + 'チーム　勝点 ' + esc(row.points) + '　' + esc(row.won) + '勝' + esc(row.drawn) + '分' + esc(row.lost) + '敗</em></a>').join('') + '</div>');
    // 最近の結果＋得点
    const top = topScorers(5);
    html += '<div class="grid2 sec">' +
      '<section><div class="sh"><h2><small>RESULTS</small>最近の結果</h2><a href="#matches">すべての試合 ›</a></div>' + (last.length ? '<div class="card">' + last.map(matchRow).join('') + '</div>' : emptyBox('まだ試合の結果はありません')) + '</section>' +
      '<section><div class="sh"><h2><small>SCORERS</small>チーム内得点</h2><a href="#stats">記録 ›</a></div>' + (top.length ? '<div class="card tw"><table><tbody>' + top.map((p, i) => '<tr><td style="width:36px;font-weight:900">' + (i + 1) + '</td><td class="l"><b>' + esc(p.name) + '</b></td><td style="font-weight:900;font-size:16px">' + p.goals + '<small style="font-size:10px;color:var(--muted)"> 点</small></td></tr>').join('') + '</tbody></table></div>' : emptyBox('まだ得点の記録はありません')) + '</section></div>';
    // ニュース
    html += sec('NEWS', 'ニュース', S.news.length ? '<div class="card nl">' + S.news.slice(0, 3).map(newsRow).join('') + '</div>' : emptyBox('ニュースはまだありません'), S.news.length ? '<a href="#news">一覧 ›</a>' : '');
    // ギャラリー
    if (S.gallery.length) html += sec('GALLERY', 'ギャラリー', galleryGrid(S.gallery.slice(0, 6)), '<a href="#club">すべて見る ›</a>');
    // クラブ紹介
    html += sec('CLUB', 'クラブ紹介', clubProfile(), '<a href="#club">くわしく ›</a>');
    if (S.sponsors.length) html += sec('SPONSORS', 'スポンサー', sponsorList());
    return html;
  }
  function galleryGrid(list) {
    return '<div class="gal">' + list.map((g, i) => {
      const u = img(g.photo, 600), big = img(g.photo, 1600);
      return u ? '<a href="' + esc(big) + '" target="_blank" rel="noopener" data-gi="' + i + '"><img src="' + esc(u) + '" alt="' + esc(g.caption || '') + '" loading="lazy" decoding="async" onerror="this.parentNode.remove()">' + (g.caption || g.date ? '<span>' + esc(g.caption || '') + (g.date ? '<small>' + esc(fullDate(g.date)) + '</small>' : '') + '</span>' : '') + '</a>' : '';
    }).join('') + '</div>';
  }
  function sponsorList() {
    return '<div class="spn">' + S.sponsors.map(s => {
      const u = safeUrl(s.url), lg = img(s.logo, 400), tag = u ? 'a' : 'div';
      return '<' + tag + (u ? ' href="' + esc(u) + '" target="_blank" rel="noopener sponsored"' : '') + '>' + (lg ? '<img src="' + esc(lg) + '" alt="' + esc(s.name) + '" loading="lazy" onerror="this.replaceWith(document.createTextNode(this.alt))">' : '<b>' + esc(s.name) + '</b>') + '</' + tag + '>';
    }).join('') + '</div>';
  }
  /* CLUB：理念・歴史・活動場所・入部案内・問い合わせ・ギャラリー・スポンサー */
  function viewClub() {
    const p = S.profile || {};
    const block = (en, ja, t) => has(t) ? sec(en, ja, '<div class="card pad"><p class="intro" style="margin:0">' + richText(t) + '</p></div>') : '';
    let html = sec('CLUB', 'クラブ紹介', clubProfile());
    html += block('PHILOSOPHY', '理念', p.philosophy);
    // 歴史：「2019」のように年だけの行は見出しにする
    if (has(p.history)) html += sec('HISTORY', '歴史', '<div class="card pad hist">' + String(p.history).split(/\n/).map(l => /^\s*(19|20)\d{2}(年度?)?\s*$/.test(l) ? '<h3>' + esc(l.trim()) + '</h3>' : (l.trim() ? '<p>' + richText(l) + '</p>' : '')).join('') + '</div>');
    if (has(p.join) || has(p.joinContact)) {
      const c = String(p.joinContact || '').trim(), url = safeUrl(c), mail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c) ? c : '';
      html += sec('JOIN US', '入部案内', '<div class="card pad">' + (has(p.join) ? '<p class="intro">' + richText(p.join) + '</p>' : '') +
        (url ? '<a class="btn" href="' + esc(url) + '" target="_blank" rel="noopener">問い合わせる ↗</a>' : mail ? '<a class="btn" href="mailto:' + esc(mail) + '">メールで問い合わせる</a>' : has(c) ? '<p style="margin:12px 0 0;font-size:14px">問い合わせ：' + esc(c) + '</p>' : '') + '</div>');
    }
    if (S.gallery.length) html += sec('GALLERY', 'ギャラリー', galleryGrid(S.gallery));
    if (S.sponsors.length) html += sec('SPONSORS', 'スポンサー', sponsorList());
    return html;
  }
  function clubProfile() {
    const p = S.profile || {};
    const rows = [['創部', p.founded], ['部員数', p.members], ['主将', p.captain], ['活動場所', p.ground]].filter(r => has(r[1]));
    const sns = [['公式サイト', p.website], ['Instagram', p.sns?.instagram], ['X', p.sns?.x], ['Facebook', p.sns?.facebook], ['YouTube', p.sns?.youtube], ['TikTok', p.sns?.tiktok]].filter(r => safeUrl(r[1]));
    if (!has(p.intro) && !rows.length && !sns.length) return emptyBox('クラブ紹介は準備中です（管理画面の「チーム紹介」に入れると表示されます）');
    return '<div class="card pad">' + (has(p.intro) ? '<p class="intro">' + esc(p.intro) + '</p>' : '') +
      (rows.length ? '<dl class="prof">' + rows.map(r => '<dt>' + r[0] + '</dt><dd>' + esc(r[1]) + '</dd>').join('') + '</dl>' : '') +
      (sns.length ? '<div class="sns">' + sns.map(r => '<a href="' + esc(safeUrl(r[1])) + '" target="_blank" rel="noopener">' + r[0] + ' ↗</a>').join('') + '</div>' : '') + '</div>';
  }

  /* ───────── PLAYERS ───────── */
  let PT = 'ALL';
  function viewPlayers() {
    const teamOpts = S.teams.filter(x => S.players.some(p => p.teams.some(t => t.teamId === x.team.id)));
    const chips = teamOpts.length > 1 ? '<div class="chips" data-k="pt">' + [['ALL', 'すべて'], ...teamOpts.map(x => [x.team.id + '|' + x.comp.id, x.label])].map(([k, l]) => '<button aria-pressed="' + (k === PT) + '" data-v="' + esc(k) + '">' + esc(l) + '</button>').join('') + '</div>' : '';
    const [tid, cid] = PT === 'ALL' ? [] : PT.split('|');
    const list = S.players.filter(p => PT === 'ALL' || p.teams.some(t => t.teamId === tid && t.comp === cid)).map(p => {
      const t = PT === 'ALL' ? p.teams[0] : p.teams.find(t => t.teamId === tid && t.comp === cid);
      return { ...p, no: t?.no ?? p.no };
    });
    const groups = [['GK', 'ゴールキーパー'], ['DF', 'ディフェンダー'], ['MF', 'ミッドフィルダー'], ['FW', 'フォワード'], ['', 'その他']];
    const body = groups.map(([k, l]) => {
      const ps = list.filter(p => k ? p.pos === k : !['GK', 'DF', 'MF', 'FW'].includes(p.pos)).sort((a, b) => (Number(a.no) || 999) - (Number(b.no) || 999));
      if (!ps.length) return '';
      return '<div class="pos"><h3>' + (k || l) + '<span>' + (k ? l + '　' : '') + ps.length + '人</span></h3><div class="pl">' + ps.map(card).join('') + '</div></div>';
    }).join('');
    const staff = S.staff.length ? sec('STAFF', 'スタッフ', '<div class="card tw"><table><tbody>' + S.staff.map(s => '<tr><td class="l" style="color:var(--muted);width:40%">' + esc(s.role) + '</td><td class="l"><b>' + esc(s.name) + '</b></td></tr>').join('') + '</tbody></table></div>') : '';
    return sec('PLAYERS', '選手名鑑', chips + (body || emptyBox('選手の登録はまだありません'))) + staff;
  }
  function card(p) {
    const ph = img(p.photo, 400);
    const big = '<span class="no">' + esc(has(p.no) ? p.no : (p.pos || '−')) + '</span>';
    return '<div class="p"><div class="f">' + (ph ? '<img src="' + esc(ph) + '" alt="" loading="lazy" decoding="async" onerror="this.parentNode.querySelector(\'.badge\')?.remove();this.outerHTML=this.dataset.big" data-big="' + esc(big) + '">' + (has(p.no) ? '<span class="badge">' + esc(p.no) + '</span>' : '') : big) + '</div><div class="b"><b>' + esc(p.name) + '</b>' +
      '<small>' + [p.grade ? esc(p.grade) + '年' : '', esc(p.school || '')].filter(Boolean).join('・') + '</small>' + (has(p.comment) ? '<q>' + esc(p.comment) + '</q>' : '') + '</div></div>';
  }

  /* ───────── MATCHES ───────── */
  let MT = 'ALL', MS = 'up';
  function viewMatches() {
    const today = jstToday();
    const chipsT = S.teams.length > 1 ? '<div class="chips" data-k="mt">' + [['ALL', 'すべての大会'], ...S.teams.map(x => [x.team.id + '|' + x.comp.id, x.label])].map(([k, l]) => '<button aria-pressed="' + (k === MT) + '" data-v="' + esc(k) + '">' + esc(l) + '</button>').join('') + '</div>' : '';
    const chipsS = '<div class="chips" data-k="ms">' + [['up', 'これから'], ['done', '結果']].map(([k, l]) => '<button aria-pressed="' + (k === MS) + '" data-v="' + k + '">' + l + '</button>').join('') + '</div>';
    let list = S.matches.filter(x => MT === 'ALL' || x.team.id + '|' + x.comp.id === MT);
    list = MS === 'up' ? list.filter(x => !isDone(x.m) && (x.m.date || '9999') >= today) : list.filter(x => isDone(x.m)).reverse();
    const sum = (() => { const r = { W: 0, D: 0, L: 0 }; S.matches.filter(x => (MT === 'ALL' || x.team.id + '|' + x.comp.id === MT) && isDone(x.m)).forEach(x => r[result(x)]++); return r; })();
    return sec('MATCHES', '日程・結果', chipsT + chipsS +
      '<p style="margin:0 0 10px;font-size:13px;color:var(--muted)">今季の成績：' + sum.W + '勝 ' + sum.D + '分 ' + sum.L + '敗</p>' +
      (list.length ? '<div class="card">' + list.map(matchRow).join('') + '</div>' : emptyBox(MS === 'up' ? 'これからの試合は登録されていません' : 'まだ結果はありません')) +
      '<p style="font-size:11.5px;color:var(--muted);margin:10px 2px 0">試合を押すと、公式記録（得点者・警告など）が開きます。</p>');
  }

  /* ───────── STATS ───────── */
  let ST = 'ALL', SK = 'goals';
  function aggStats() {
    const m = new Map();
    for (const s of S.stats) {
      if (ST !== 'ALL' && s.team.id + '|' + s.comp.id !== ST) continue;
      for (const p of s.players) {
        if (!m.has(p.id)) m.set(p.id, { id: p.id, name: p.name, no: p.no, apps: 0, starts: 0, min: 0, goals: 0, assists: 0, yc: 0, rc: 0 });
        const q = m.get(p.id);
        for (const k of ['apps', 'starts', 'min', 'goals', 'assists', 'yc', 'rc']) q[k] += Number(p[k]) || 0;
        if (!has(q.no) && has(p.no)) q.no = p.no;
      }
    }
    return [...m.values()];
  }
  function topScorers(n) { const keep = ST; ST = 'ALL'; const a = aggStats().filter(p => p.goals > 0).sort((a, b) => b.goals - a.goals || b.assists - a.assists).slice(0, n); ST = keep; return a; }
  function viewStats() {
    const chips = S.stats.length > 1 ? '<div class="chips" data-k="st">' + [['ALL', 'すべての大会'], ...S.stats.map(x => [x.team.id + '|' + x.comp.id, x.label])].map(([k, l]) => '<button aria-pressed="' + (k === ST) + '" data-v="' + esc(k) + '">' + esc(l) + '</button>').join('') + '</div>' : '';
    const all = aggStats();
    // まだ記録が入っていない項目（全員 0）は出さない
    const cols = [['goals', '得点'], ['assists', 'アシスト'], ['apps', '出場'], ['starts', '先発'], ['min', '出場時間'], ['yc', '警告'], ['rc', '退場']].filter(([k]) => k === 'goals' || all.some(p => p[k] > 0));
    if (!cols.some(c => c[0] === SK)) SK = 'goals';
    const rows = all.filter(p => p.apps || p.goals || p.assists || p.yc || p.rc).sort((a, b) => (b[SK] - a[SK]) || (b.goals - a.goals) || (b.min - a.min));
    const table = rows.length ? '<div class="card tw"><table><thead><tr><th class="l">選手</th>' + cols.map(([k, l]) => '<th><button data-sort="' + k + '"' + (k === SK ? ' aria-sort="descending"' : '') + '>' + l + (k === SK ? ' ▼' : '') + '</button></th>').join('') + '</tr></thead><tbody>' +
      rows.map(p => '<tr><td class="l">' + (has(p.no) ? '<span style="color:var(--muted);display:inline-block;min-width:24px">' + esc(p.no) + '</span>' : '') + '<b>' + esc(p.name) + '</b></td>' + cols.map(([k]) => '<td' + (k === SK ? ' style="font-weight:900"' : '') + '>' + (k === 'min' ? (p.min ? p.min + '分' : '−') : (p[k] || (k === 'yc' || k === 'rc' ? '−' : 0))) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>' : emptyBox('まだ記録はありません');
    return sec('STATS', '選手の記録', chips + table + '<p style="font-size:11.5px;color:var(--muted);margin:10px 2px 0">公式記録から自動で集計しています。見出しを押すと並べ替えます。出場・出場時間などは、公式記録の入力が進むと表示されます。</p>');
  }

  /* ───────── NEWS ───────── */
  function newsRow(n) {
    const ph = img(n.photo, 300);
    return '<a href="#news/' + encodeURIComponent(n.id || '') + '"><time>' + esc(fullDate(n.date)) + '</time><span class="t">' + (n.kind ? '<span class="tag">' + esc(n.kind) + '</span>' : '') + '<b>' + esc(n.title) + '</b></span>' +
      (ph ? '<span class="th"><img src="' + esc(ph) + '" alt="" loading="lazy" decoding="async" onerror="this.parentNode.remove()"></span>' : '<span></span>') + '<span class="go" style="color:var(--muted)">›</span></a>';
  }
  function viewNews(id) {
    if (id) {
      const n = S.news.find(x => String(x.id) === id);
      if (n) {
        const ph = img(n.photo, 1200), u = safeUrl(n.url);
        return '<article class="art"><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:13px;color:var(--muted)"><time>' + esc(fullDate(n.date)) + '</time>' + (n.kind ? '<span class="tag">' + esc(n.kind) + '</span>' : '') + '</div>' +
          '<h2>' + esc(n.title) + '</h2>' + (ph ? '<figure><img src="' + esc(ph) + '" alt="" decoding="async" onerror="this.parentNode.remove()"></figure>' : '') +
          (has(n.body) ? '<div class="body">' + richText(n.body) + '</div>' : '') + (u ? '<a class="btn" href="' + esc(u) + '" target="_blank" rel="noopener">詳しく見る ↗</a>' : '') + '</article><a class="back" href="#news">‹ ニュース一覧へ</a>';
      }
    }
    return sec('NEWS', 'ニュース', S.news.length ? '<div class="card nl">' + S.news.map(newsRow).join('') + '</div>' : emptyBox('ニュースはまだありません（管理画面の「チームニュース」に入れると表示されます）'));
  }

  /* ───────── 画面の切り替え ───────── */
  const VIEWS = { home: viewHome, players: viewPlayers, matches: viewMatches, stats: viewStats, news: viewNews, club: viewClub };
  function route() {
    const h = decodeURIComponent(location.hash.replace(/^#/, '')) || 'home';
    const [v, arg] = h.split('/');
    const view = VIEWS[v] ? v : 'home';
    document.querySelectorAll('.nav a').forEach(a => a.setAttribute('aria-current', a.getAttribute('href') === '#' + view ? 'page' : 'false'));
    $('hero').hidden = view !== 'home';
    $('main').innerHTML = VIEWS[view](arg);
    document.title = ({ home: '', players: '選手名鑑 | ', matches: '日程・結果 | ', stats: '記録 | ', news: 'ニュース | ', club: 'クラブ紹介 | ' }[view]) + siteName();
  }
  $('main').addEventListener('click', e => {
    const b = e.target.closest('.chips button');
    if (b) {
      const k = b.parentNode.dataset.k, v = b.dataset.v;
      if (k === 'pt') PT = v; if (k === 'mt') MT = v; if (k === 'ms') MS = v; if (k === 'st') ST = v;
      route(); return;
    }
    const s = e.target.closest('th button[data-sort]');
    if (s) { SK = s.dataset.sort; route(); }
  });
  window.addEventListener('hashchange', () => { route(); window.scrollTo(0, 0); });
  $('menu').addEventListener('click', () => { const o = $('nav').classList.toggle('open'); $('menu').setAttribute('aria-expanded', String(o)); });
  $('nav').addEventListener('click', e => { if (e.target.closest('a')) { $('nav').classList.remove('open'); $('menu').setAttribute('aria-expanded', 'false'); } });

  /* ───────── 大学ごとの見た目 ───────── */
  const siteName = () => CFG.name || (CFG.univ + 'サッカー部');
  function applyBrand() {
    const p = S.profile || {};
    const c = /^#[0-9a-f]{3,8}$/i.test(CFG.color) ? CFG.color : /^#[0-9a-f]{3,8}$/i.test(p.color || '') ? p.color : '#1976D2';
    const root = document.documentElement.style;
    root.setProperty('--c', c);
    root.setProperty('--c-text', 'color-mix(in srgb, ' + c + ' 55%, #fff)');
    $('siteName').textContent = siteName();
    $('siteEn').textContent = CFG.en || '';
    const eu = img(p.emblem, 200), emb = $('emb');
    const ch = [...CFG.univ.replace(/(大学|大)$/, '')].slice(0, 2).join('');
    if (eu) { emb.classList.add('img'); emb.innerHTML = '<img src="' + esc(eu) + '" alt="' + esc(CFG.univ) + '">'; emb.querySelector('img').onerror = () => { emb.classList.remove('img'); emb.textContent = ch; }; }
    else emb.textContent = ch;
    const hu = img(CFG.hero || p.teamPhoto, 1600);
    $('heroPh').innerHTML = hu ? '<img src="' + esc(hu) + '" alt="" fetchpriority="high" onerror="this.parentNode.innerHTML=\'\'">' : '';
    $('heroEb').textContent = CFG.en || 'FOOTBALL CLUB';
    $('heroTitle').textContent = siteName();
    const lead = CFG.lead || String(p.intro || '').split(/[。\n]/)[0];
    $('heroLead').textContent = lead ? lead + (/[。！!]$/.test(lead) ? '' : '。') : '';
    $('heroCap').textContent = CFG.heroCaption || '';
    $('ftName').textContent = siteName();
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
      $('main').innerHTML = '<div class="card"><p class="empty">データを読み込めませんでした：' + esc(e.message) + '</p></div>';
    }
  })();
})();
