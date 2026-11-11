(function () {
  var CFG = window.HH_DATA; if (!CFG) return;
  var D = CFG.items, TAG = CFG.tag;
  var init = {}; try { init = JSON.parse(document.getElementById('cmp-init').textContent) || {}; } catch (e) {}
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var PR = CFG.pairs || [];
  var pairFor = function (a, b) { for (var i = 0; i < PR.length; i++) { var p = PR[i]; if ((p.a === a.slug && p.b === b.slug) || (p.a === b.slug && p.b === a.slug)) return p; } return null; };
  var BY = {}; D.forEach(function (d) { BY[d.slug] = d; });
  var TIERS = ['Under $50', '$50 to $150', '$150 and up'];
  var roleLabel = function (d) { return d.role === 'original' ? 'Original' : 'Alternative'; };
  var cap = function (s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; };
  function icon(d) {
    if (d.img) return '<img src="/img/f/' + d.slug + '/icon.webp" alt="' + esc(d.full) + ' bottle" width="480" height="360" loading="lazy" decoding="async">';
    if (d.imageUrl) return '<img referrerpolicy="no-referrer" src="' + esc(d.imageUrl) + '" alt="' + esc(d.full) + ' bottle" loading="lazy" decoding="async">';
    var s = '#0d0f1f', o = d.role === 'original';
    return '<svg viewBox="0 0 120 150" aria-hidden="true"><rect x="46" y="6" width="28" height="22" rx="4" fill="' + s + '" stroke="currentColor" stroke-width="3"/><rect x="52" y="28" width="16" height="10" fill="currentColor"/><rect x="22" y="38" width="76" height="104" rx="' + (o ? 8 : 20) + '" fill="currentColor"/><rect x="34" y="62" width="52" height="46" rx="4" fill="' + s + '"/><rect x="42" y="74" width="36" height="4" fill="currentColor" opacity=".7"/><rect x="42" y="84" width="26" height="4" fill="currentColor" opacity=".7"/></svg>';
  }
  var UP = '<svg class="ci ci-up" viewBox="0 0 24 24" role="img" aria-label="Ranks higher"><circle cx="12" cy="12" r="12" fill="#3fb950"/><path d="M6.5 14.5 12 9l5.5 5.5" fill="none" stroke="#0d1a10" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var DN = '<svg class="ci ci-dn" viewBox="0 0 24 24" role="img" aria-label="Ranks lower"><circle cx="12" cy="12" r="12" fill="#e5534b"/><path d="M6.5 9.5 12 15l5.5-5.5" fill="none" stroke="#2a0d0b" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var EQ = '<svg class="ci ci-eq" viewBox="0 0 24 24" role="img" aria-label="Equal"><circle cx="12" cy="12" r="12" fill="#f0c64a"/><path d="M7 9.5h10M7 14.5h10" stroke="#2b2206" stroke-width="2.6" stroke-linecap="round"/></svg>';
  var good = function (v) { return v && v !== '?'; };
  var tierNum = function (d) { var i = TIERS.indexOf(d.tier); return i < 0 ? null : i; };
  var notesOf = function (d) { return d.flat.length ? d.flat.join(', ') : ''; };
  // [section, label, display(d), rank(d) -> number|null, higherIsBetter]. Only hard numbers are ranked.
  var ROWS = [
    ['Overview', 'Type', function (d) { return roleLabel(d); }],
    ['Overview', 'Concentration', function (d) { return d.conc; }],
    ['Overview', 'Gender', function (d) { return d.gender; }],
    ['Overview', 'Released', function (d) { return d.year ? String(d.year) : ''; }],
    ['Overview', 'Size', function (d) { return d.size; }],
    ['Overview', 'Price tier (approx.)', function (d) { return d.tier; }, tierNum, -1],
    ['Scent', 'Main accords', function (d) { return d.accords.join(', '); }],
    ['Scent', 'Season (editorial)', function (d) { return d.season.join(', '); }],
    ['Notes', 'Top notes', function (d) { return d.top.join(', '); }],
    ['Notes', 'Heart notes', function (d) { return d.heart.join(', '); }],
    ['Notes', 'Base notes', function (d) { return d.base.join(', '); }],
    ['Notes', 'Notes (unlayered)', notesOf]
  ];
  function cmp(r, a, b) {
    if (!r[3]) return ['', ''];
    var x = r[3](a), y = r[3](b);
    if (x == null || y == null) return ['', ''];
    if (x === y) return [EQ, EQ];
    return (x - y) * r[4] > 0 ? [UP, DN] : [DN, UP];
  }
  function overlap(a, b) {
    var sb = {}; b.nk.forEach(function (n) { sb[n] = 1; });
    var common = a.nk.filter(function (n) { return sb[n]; });
    var union = {}; a.nk.concat(b.nk).forEach(function (n) { union[n] = 1; });
    var u = Object.keys(union).length;
    var onlyA = a.nk.filter(function (n) { return !sb[n]; });
    var sa = {}; a.nk.forEach(function (n) { sa[n] = 1; });
    var onlyB = b.nk.filter(function (n) { return !sa[n]; });
    return { common: common, onlyA: onlyA, onlyB: onlyB, pct: u ? Math.round(common.length / u * 100) : 0 };
  }
  var sel = { a: null, b: null };
  function setSel(side, d) { sel[side] = d; sync(); render(); }
  function sync() {
    try {
      var q = []; if (sel.a) q.push('a=' + sel.a.slug); if (sel.b) q.push('b=' + sel.b.slug);
      history.replaceState(null, '', '/compare/' + (q.length ? '?' + q.join('&') : ''));
    } catch (e) {}
    ['a', 'b'].forEach(function (k) { $('#cmp-' + k).value = sel[k] ? sel[k].full : ''; });
  }
  function diffs(a, b) {
    var out = [], ov = overlap(a, b);
    var f = function (ico, txt) { out.push('<li>' + ico.replace('<svg class="ci', '<svg class="ci sm') + '<span>' + txt + '</span></li>'); };
    var ta = tierNum(a), tb = tierNum(b);
    if (ta != null && tb != null && ta !== tb) f(ta < tb ? UP : DN, 'It sits in a <b>' + (ta < tb ? 'lower' : 'higher') + '</b> approximate price tier (' + esc(a.tier) + ' vs ' + esc(b.tier) + ')');
    if (a.nk.length && b.nk.length) f(EQ, 'Their published notes overlap by <b>' + ov.pct + '%</b>' + (ov.common.length ? ', sharing <b>' + esc(ov.common.map(cap).join(', ')) + '</b>' : '') + '. This compares two published lists and does not measure how alike they smell');
    if (a.nk.length && b.nk.length && ov.onlyA.length) f(EQ, 'It lists <b>' + esc(ov.onlyA.slice(0, 6).map(cap).join(', ')) + '</b> that the other does not');
    if (a.conc && b.conc && a.conc !== b.conc) f(EQ, 'It is listed as <b>' + esc(a.conc) + '</b>, versus <b>' + esc(b.conc) + '</b>');
    if (a.gender && b.gender && a.gender !== b.gender) f(EQ, 'It is marketed for <b>' + esc(a.gender) + '</b>, versus <b>' + esc(b.gender) + '</b>');
    if (a.year && b.year && a.year !== b.year) f(EQ, 'It was released in <b>' + a.year + '</b>, versus <b>' + b.year + '</b>');
    return '<ul class="cmp-diff">' + out.join('') + '</ul>';
  }
  function score(a, b) { var c = cmp(ROWS[5], a, b); return c[0] === UP ? 1 : c[0] === DN ? -1 : 0; }
  function nameHtml(d) { return '<span class="hh-brand">' + esc(d.brand) + '</span> ' + esc(d.name); }
  function amazonLink(d) { return d.link ? d.link : d.asin ? 'https://www.amazon.com/dp/' + d.asin + '?tag=' + TAG : 'https://www.amazon.com/s?k=' + encodeURIComponent(d.full + ' perfume') + '&tag=' + TAG; }
  function btn(d) { return '<a class="btn hh-buy" href="' + esc(amazonLink(d)) + '" target="_blank" rel="sponsored nofollow noopener">' + (d.asin || d.link ? 'View on Amazon' : 'Check price on Amazon') + ' <small>→</small></a>'; }
  function chips(list, common) { var c = {}; common.forEach(function (n) { c[n] = 1; }); return list.map(function (n) { return '<span class="hh-tag' + (c[n.toLowerCase()] ? ' on' : '') + '">' + esc(n) + '</span>'; }).join(''); }
  function render() {
    var out = $('#cmp-out'), a = sel.a, b = sel.b;
    $('#cmp-sugg').style.display = a && b ? 'none' : '';
    var st = $('#cmp-static'); if (st) st.style.display = 'none';
    if (!a || !b) { out.innerHTML = '<p class="cmp-empty">' + (a || b ? 'Now pick a second fragrance to compare.' : 'Pick two fragrances to see them side by side.') + '</p>'; $('#cmp-h1').textContent = 'Compare Fragrances'; document.title = 'Compare Fragrances Side by Side | Dupes Base'; return; }
    $('#cmp-h1').textContent = a.full + ' vs. ' + b.full + ' Comparison';
    document.title = a.full + ' vs ' + b.full + ': Notes Comparison | Dupes Base';
    var ov = overlap(a, b);
    var sc = score(a, b), ca = sc > 0 ? 'win' : sc < 0 ? 'lose' : 'tie', cb = sc > 0 ? 'lose' : sc < 0 ? 'win' : 'tie';
    var head = function (d, c, x) { return '<h2 class="cmp-ttl ' + c + '">' + nameHtml(d) + (x ? '<button type="button" class="cmp-x" data-clear="b" aria-label="Remove ' + esc(d.full) + '">×</button>' : '') + '</h2>'; };
    var pc = cmp(ROWS[5], a, b);
    var info = function (d, ind) { return '<div class="cmp-info"><div class="cmp-img">' + icon(d) + '</div><dl class="hh-kv"><div><dt>Type</dt><dd>' + esc(roleLabel(d)) + '</dd></div>' + (d.year ? '<div><dt>Released</dt><dd>' + d.year + '</dd></div>' : '') + (d.conc ? '<div><dt>Concentration</dt><dd>' + esc(d.conc) + '</dd></div>' : '') + (d.gender ? '<div><dt>Gender</dt><dd>' + esc(d.gender) + '</dd></div>' : '') + '<div><dt>Price tier</dt><dd><b class="hh-price">' + esc(d.tier) + '</b> ' + ind + '</dd></div></dl></div>'; };
    var rp0 = pairFor(a, b), hasN = a.nk.length && b.nk.length;
    var h = '<div class="cmp-pair">' + head(a, ca) + head(b, cb, 1) + '</div>';
    h += '<div class="cmp-pair">' + info(a, pc[0]) + info(b, pc[1]) + '</div>';
    h += '<div class="cmp-legend"><span>' + UP + ' Ranks higher in this category.</span><span>' + DN + ' Ranks lower in this category</span><span>' + EQ + ' Equal, or not ranked</span></div>';
    var panels = rp0 && rp0.rep != null ? '<section class="cmp-panel"><h2>Reported similarity</h2><p class="cmp-pct"><b>~' + rp0.rep + '%</b> reported similarity</p></section>' : '';
    if (hasN) panels += '<section class="cmp-panel"><h2>Notes in Common</h2><div class="cmp-common"><p class="cmp-pct"><b>' + ov.pct + '%</b> published notes overlap</p><div class="hh-tags">' + (ov.common.length ? ov.common.map(function (n) { return '<span class="hh-tag on">' + esc(cap(n)) + '</span>'; }).join('') : '<span class="meta">No shared notes in the published lists.</span>') + '</div><p class="cmp-note">A rough comparison of two published note lists. It does not measure how alike the two smell, and we have not tested either.</p></div></section>';
    h += panels;
    var cur = '';
    ROWS.forEach(function (r) {
      if (r[0] === 'Overview') return;
      var va = r[2](a), vb = r[2](b); if (!good(va) && !good(vb)) return;
      if (r[0] !== cur) { cur = r[0]; h += '<h3 class="cmp-sec">' + esc(cur) + '</h3>'; }
      var c = cmp(r, a, b);
      var cell = function (v, i) { return '<div class="cmp-cell">' + (i ? '<span class="cmp-ind">' + i + '</span>' : '') + '<span class="cmp-l">' + esc(r[1]) + '</span><span class="cmp-v">' + (good(v) ? esc(v) : 'Not listed') + '</span></div>'; };
      h += '<div class="cmp-pair cmp-rowp">' + cell(va, c[0]) + cell(vb, c[1]) + '</div>';
    });
    h += '<div class="cmp-pair cmp-foot"><div><a class="more" href="/fragrance/' + a.slug + '/">Full details →</a>' + btn(a) + '</div><div><a class="more" href="/fragrance/' + b.slug + '/">Full details →</a>' + btn(b) + '</div></div>';
    out.innerHTML = h;
  }
  // ---- search boxes ----
  function box(side) {
    var inp = $('#cmp-' + side), list = $('#cmp-' + side + '-list'), idx = -1, cur = [];
    function show() {
      var q = inp.value.trim().toLowerCase(), words = q ? q.split(/\s+/) : [];
      if (sel[side] && inp.value === sel[side].full) words = [];
      cur = D.filter(function (d) { if (sel[side === 'a' ? 'b' : 'a'] === d) return false; var s = d.full.toLowerCase(); return words.every(function (w) { return s.indexOf(w) > -1; }); }).sort(function (x, y) { var n = q.replace(/\s+/g, ' '), rx = x.full.toLowerCase() === n ? 0 : 1, ry = y.full.toLowerCase() === n ? 0 : 1; return rx - ry || x.full.length - y.full.length; }).slice(0, 8);
      idx = -1; list.innerHTML = cur.map(function (d, i) { return '<li role="option" data-i="' + i + '"><b>' + esc(d.full) + '</b><span>' + esc(roleLabel(d)) + '</span></li>'; }).join('') || '<li class="none">No match</li>';
      list.hidden = false;
    }
    function pick(i) { if (cur[i]) { list.hidden = true; inp.blur(); setSel(side, cur[i]); } }
    inp.addEventListener('focus', function () { inp.select(); show(); });
    inp.addEventListener('input', show);
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); idx = Math.max(0, Math.min(cur.length - 1, idx + (e.key === 'ArrowDown' ? 1 : -1))); Array.prototype.forEach.call(list.children, function (li, i) { li.classList.toggle('on', i === idx); }); }
      else if (e.key === 'Enter') { e.preventDefault(); pick(idx < 0 ? 0 : idx); }
      else if (e.key === 'Escape') { list.hidden = true; }
    });
    list.addEventListener('mousedown', function (e) { var li = e.target.closest('li[data-i]'); if (li) { e.preventDefault(); pick(+li.getAttribute('data-i')); } });
    inp.addEventListener('blur', function () { setTimeout(function () { list.hidden = true; inp.value = sel[side] ? sel[side].full : ''; }, 120); });
  }
  box('a'); box('b');
  $('#cmp-swap').addEventListener('click', function () { var t = sel.a; sel.a = sel.b; sel.b = t; sync(); render(); });
  document.addEventListener('click', function (e) {
    var x = e.target.closest('[data-clear]'); if (x) { sel[x.getAttribute('data-clear')] = null; sync(); render(); return; }
    var s = e.target.closest('a[data-pair]'); if (s) { e.preventDefault(); var p = s.getAttribute('data-pair').split(','); sel.a = BY[p[0]]; sel.b = BY[p[1]]; sync(); render(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  });
  var qs = {}; try { new URLSearchParams(location.search).forEach(function (v, k) { qs[k] = v; }); } catch (e) {}
  sel.a = BY[qs.a || init.a] || null; sel.b = BY[qs.b || init.b] || null;
  if (init.a && !qs.a && !qs.b) { $('#cmp-a').value = sel.a ? sel.a.full : ''; $('#cmp-b').value = sel.b ? sel.b.full : ''; } else sync();
  render();
})();
