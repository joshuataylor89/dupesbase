(function () {
  var CFG = window.HH_DATA;
  if (!CFG) return;
  var D = CFG.items, PR = CFG.pairs, TAG = CFG.tag;
  var BY = {}; D.forEach(function (d) { BY[d.slug] = d; });
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var TIERS = ['Under $50', '$50 to $150', '$150 and up'];
  var tierRank = function (t) { var i = TIERS.indexOf(t); return i < 0 ? 9 : i; };
  var roleLabel = function (d) { return d.role === 'original' ? 'Original' : 'Alternative'; };
  var cap = function (s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; };
  var allNotes = function (d) { return d.top.concat(d.heart, d.base, d.flat); };

  // facets: key, label, group, values(d) -> array, optional order
  var FACETS = [
    { k: 'tier', l: 'Price tier (approx.)', g: 'General', v: function (d) { return [d.tier]; }, order: TIERS },
    { k: 'gender', l: 'Gender', g: 'General', v: function (d) { return d.gender ? [d.gender] : []; }, order: ['Men', 'Women', 'Unisex'] },
    { k: 'role', l: 'Original or alternative', g: 'General', v: function (d) { return [roleLabel(d)]; }, order: ['Original', 'Alternative'] },
    { k: 'brand', l: 'House / brand', g: 'General', v: function (d) { return [d.brand]; } },
    { k: 'conc', l: 'Concentration', g: 'Specifications', v: function (d) { return d.conc ? [d.conc] : []; }, order: ['EDT', 'EDP', 'Parfum', 'Cologne'] },
    { k: 'accord', l: 'Main accords', g: 'Specifications', v: function (d) { return d.accords; } },
    { k: 'season', l: 'Season (editorial)', g: 'Specifications', v: function (d) { return d.season; }, order: ['Spring', 'Summer', 'Fall', 'Winter'] },
    { k: 'note', l: 'Published notes', g: 'Specifications', v: function (d) { return d.nk.map(cap); } },
    { k: 'longevity', l: 'Longevity', g: 'Specifications', na: true },
    { k: 'projection', l: 'Projection', g: 'Specifications', na: true }
  ];
  var LEAF = FACETS.filter(function (f) { return !f.na; });
  D.forEach(function (d) {
    d._v = {}; LEAF.forEach(function (f) { d._v[f.k] = f.v(d); });
    d._s = (d.full + ' ' + d.brand + ' ' + allNotes(d).join(' ') + ' ' + d.accords.join(' ') + ' ' + d.gender + ' ' + d.conc + ' ' + d.tier).toLowerCase();
  });
  LEAF.forEach(function (f) {
    var c = {}; D.forEach(function (d) { d._v[f.k].forEach(function (x) { c[x] = (c[x] || 0) + 1; }); });
    var keys = Object.keys(c);
    f.opts = f.order ? f.order.filter(function (x) { return c[x]; }) : keys.sort(function (a, b) { return c[b] - c[a] || a.localeCompare(b); });
    f.counts = c;
  });

  var state = { q: '', view: 'pairs', sort: 'name', sel: {}, limit: 12 };
  try { var sv = localStorage.getItem('db-view'); if (sv) state.view = sv; } catch (e) {}
  LEAF.forEach(function (f) { state.sel[f.k] = {}; });

  var SORTS = { name: 'Name: A to Z', new: 'Release: newest first', old: 'Release: oldest first', plo: 'Price tier: lowest first', phi: 'Price tier: highest first', ovl: 'Match %: highest first (pairs)' };
  function pairOverlapOf(d) { var m = 0; PR.forEach(function (p) { if (p.a === d.slug || p.b === d.slug) m = Math.max(m, p.main == null ? 0 : p.main); }); return m; }
  function itemSort(a, b) {
    var s = state.sort;
    if (s === 'new') return (b.year || 0) - (a.year || 0) || a.full.localeCompare(b.full);
    if (s === 'old') return (a.year || 9999) - (b.year || 9999) || a.full.localeCompare(b.full);
    if (s === 'plo') return tierRank(a.tier) - tierRank(b.tier) || a.full.localeCompare(b.full);
    if (s === 'phi') return tierRank(b.tier) - tierRank(a.tier) || a.full.localeCompare(b.full);
    if (s === 'ovl') return pairOverlapOf(b) - pairOverlapOf(a) || a.full.localeCompare(b.full);
    return a.full.localeCompare(b.full);
  }
  function matches(d) {
    var q = state.q.trim().toLowerCase(), words = q ? q.split(/\s+/) : [];
    for (var i = 0; i < words.length; i++) if (d._s.indexOf(words[i]) < 0) return false;
    for (var j = 0; j < LEAF.length; j++) {
      var f = LEAF[j], sel = Object.keys(state.sel[f.k]);
      if (!sel.length) continue;
      var ok = false;
      for (var k = 0; k < sel.length; k++) if (d._v[f.k].indexOf(sel[k]) > -1) { ok = true; break; }
      if (!ok) return false;
    }
    return true;
  }
  function filteredItems() { return D.filter(matches).sort(itemSort); }
  function filteredPairs() {
    var list = PR.filter(function (p) { return matches(BY[p.a]) || matches(BY[p.b]); });
    // a search word must match at least one side; facets can match either side
    var q = state.q.trim().toLowerCase();
    if (q) { var w = q.split(/\s+/); list = list.filter(function (p) { var s = BY[p.a]._s + ' ' + BY[p.b]._s; return w.every(function (x) { return s.indexOf(x) > -1; }); }); }
    return list.sort(function (x, y) {
      if (state.sort === 'ovl') return (y.main == null ? -1 : y.main) - (x.main == null ? -1 : x.main);
      if (state.sort === 'plo') return tierRank(BY[x.b].tier) - tierRank(BY[y.b].tier) || BY[x.a].full.localeCompare(BY[y.a].full);
      if (state.sort === 'phi') return tierRank(BY[y.b].tier) - tierRank(BY[x.b].tier) || BY[x.a].full.localeCompare(BY[y.a].full);
      if (state.sort === 'new') return (BY[y.b].year || 0) - (BY[x.b].year || 0);
      if (state.sort === 'old') return (BY[x.b].year || 9999) - (BY[y.b].year || 9999);
      return BY[x.a].full.localeCompare(BY[y.a].full);
    });
  }

  // ---- bottle art ----
  function icon(d) {
    if (d.img) return '<img src="/img/f/' + d.slug + '/icon.webp" alt="' + esc(d.full) + ' bottle" width="480" height="360" loading="lazy" decoding="async">';
    if (d.imageUrl) return '<img referrerpolicy="no-referrer" src="' + esc(d.imageUrl) + '" alt="' + esc(d.full) + ' bottle" loading="lazy" decoding="async">';
    var s = '#0d0f1f', o = d.role === 'original';
    return '<svg viewBox="0 0 120 150" aria-hidden="true"><rect x="46" y="6" width="28" height="22" rx="4" fill="' + s + '" stroke="currentColor" stroke-width="3"/><rect x="52" y="28" width="16" height="10" fill="currentColor"/><rect x="22" y="38" width="76" height="104" rx="' + (o ? 8 : 20) + '" fill="currentColor"/><rect x="34" y="62" width="52" height="46" rx="4" fill="' + s + '"/><rect x="42" y="74" width="36" height="4" fill="currentColor" opacity=".7"/><rect x="42" y="84" width="26" height="4" fill="currentColor" opacity=".7"/></svg>';
  }
  function amazon(d) { return d.link ? d.link : d.asin ? 'https://www.amazon.com/dp/' + d.asin + '?tag=' + TAG : 'https://www.amazon.com/s?k=' + encodeURIComponent(d.full + ' perfume') + '&tag=' + TAG; }
  var HC = {}; D.forEach(function (d) { HC[d.brand] = (HC[d.brand] || 0) + 1; });
  function slugify(s) { return s.toLowerCase().replace(/&/g, 'and').replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  function houseHref(b) { return HC[b] > 1 ? '/house/' + slugify(b) + '/' : '/database/?brand=' + encodeURIComponent(b); }
  function href(d) { return '/fragrance/' + d.slug + '/'; }
  function tagLink(k, v) { return '<a class="hh-tag" data-k="' + k + '" data-v="' + esc(v) + '" href="' + esc('/database/?' + k + '=' + encodeURIComponent(v)) + '" title="Show all ' + esc(v) + '">' + esc(v) + '</a>'; }
  function nameHtml(d) { return '<a class="hh-brand" href="' + esc(houseHref(d.brand)) + '" title="See all ' + esc(d.brand) + ' fragrances">' + esc(d.brand) + '</a> <a class="hh-nm" href="' + href(d) + '">' + esc(d.name) + '</a>'; }
  function tagsHtml(d) { return [tagLink('role', roleLabel(d))].concat(d.gender ? [tagLink('gender', d.gender)] : [], d.conc ? [tagLink('conc', d.conc)] : [], [tagLink('tier', d.tier)]).join(''); }
  function kv(rows) { return '<dl class="hh-kv">' + rows.filter(function (r) { return r[1] && r[1] !== '?'; }).map(function (r) { return '<div><dt>' + esc(r[0]) + '</dt><dd>' + r[1] + '</dd></div>'; }).join('') + '</dl>'; }
  function top(d) { return [['Type', esc(roleLabel(d))], ['Released', d.year ? String(d.year) : ''], ['Concentration', esc(d.conc)], ['Gender', esc(d.gender)], ['Price tier', '<b class="hh-price">' + esc(d.tier) + '</b>']]; }
  function buy(d) { return '<a class="btn hh-buy" href="' + esc(amazon(d)) + '" target="_blank" rel="sponsored nofollow noopener">' + (d.asin || d.link ? 'View on Amazon' : 'Check price on Amazon') + ' <small>→</small></a>'; }
  function notesBlock(d) {
    if (d.flat.length) return kv([['Notes', esc(d.flat.join(', '))]]);
    return kv([['Top notes', esc(d.top.join(', '))], ['Heart notes', esc(d.heart.join(', '))], ['Base notes', esc(d.base.join(', '))]]);
  }

  function cardFull(d) {
    return '<article class="hh-card"><h2 class="hh-title">' + nameHtml(d) + '</h2><div class="hh-top"><a class="hh-img" href="' + href(d) + '">' + icon(d) + '</a><div>' + kv(top(d)) + '</div></div><div class="hh-tags">' + tagsHtml(d) + '</div>' +
      '<h3>Published notes</h3>' + notesBlock(d) +
      (d.accords.length ? '<h3>Main accords (as listed)</h3>' + kv([['Accords', esc(d.accords.join(', '))]]) : '') +
      (d.size ? '<h3>Size</h3>' + kv([['Listed size', esc(d.size)]]) : '') +
      '<p><a class="more" href="' + href(d) + '">View full details →</a></p><p>' + buy(d) + '</p></article>';
  }
  function cardRecap(d) {
    return '<article class="hh-card hh-recap"><h2 class="hh-title">' + nameHtml(d) + '</h2><div class="hh-top"><a class="hh-img" href="' + href(d) + '">' + icon(d) + '</a><div>' + kv(top(d)) + '</div></div><div class="hh-tags">' + tagsHtml(d) + '</div><p>' + buy(d) + '</p></article>';
  }
  function rowPrev(d) {
    return '<div class="hh-row"><a class="hh-rimg" href="' + href(d) + '" tabindex="-1" aria-hidden="true">' + icon(d) + '</a><span class="hh-rmain"><b>' + nameHtml(d) + '</b><span class="hh-rtags">' + tagsHtml(d) + '</span></span><a class="hh-rside" href="' + href(d) + '"><b class="hh-price">' + esc(d.tier) + '</b><span>' + esc(d.gender || '') + (d.year ? ' • ' + d.year : '') + '</span></a></div>';
  }
  function pairRow(p) {
    var a = BY[p.a], b = BY[p.b];
    var cmpHref = '/compare/' + a.slug + '-vs-' + b.slug + '/';
    return '<article class="pr"><div class="pr-side"><span class="pr-lab">Original</span><a class="pr-img" href="' + href(a) + '">' + icon(a) + '</a><b class="pr-name">' + nameHtml(a) + '</b><span class="pr-tier">' + esc(a.tier) + '</span>' + buy(a).replace('class="btn hh-buy"', 'class="btn btn2 hh-buy"') + '</div>' +
      '<div class="pr-mid"><span class="pr-arrow" aria-hidden="true">→</span><div class="pr-pct" title="' + (p.rep != null ? 'Reported similarity: a figure supplied to us, not our own testing.' : 'Published notes overlap: a rough comparison of two published note lists. It does not measure how similar the two smell.') + '"><b>' + (p.main == null ? '—' : (p.rep != null ? '~' : '') + p.main + '%') + '</b><span>' + (p.main == null ? 'not rated yet' : p.lab) + '</span></div><div class="pr-bar"><i style="width:' + (p.main || 0) + '%"></i></div><span class="pr-gender">' + esc(a.gender || b.gender) + '</span><a class="more" href="' + cmpHref + '">Compare →</a></div>' +
      '<div class="pr-side"><span class="pr-lab">Alternative</span><a class="pr-img" href="' + href(b) + '">' + icon(b) + '</a><b class="pr-name">' + nameHtml(b) + '</b><span class="pr-tier">' + esc(b.tier) + '</span>' + buy(b) + '</div></article>';
  }

  var listEl = $('#hh-list'), countEl = $('#hh-count'), moreEl = $('#hh-more');
  function render() {
    var pairs = state.view === 'pairs';
    var items = pairs ? filteredPairs() : filteredItems(), shown = items.slice(0, state.limit);
    var fn = pairs ? pairRow : state.view === 'full' ? cardFull : state.view === 'recap' ? cardRecap : rowPrev;
    listEl.className = 'hh-list hh-' + state.view;
    listEl.innerHTML = shown.length ? shown.map(fn).join('') : '<p class="hh-empty">Nothing matches. Try removing a filter or changing your search.</p>';
    countEl.textContent = pairs ? items.length + ' of ' + PR.length + ' dupe pairs' : items.length + ' of ' + D.length + ' fragrances';
    moreEl.style.display = items.length > shown.length ? '' : 'none';
    moreEl.textContent = 'Show more (' + (items.length - shown.length) + ' left)';
    document.querySelectorAll('[data-view]').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-view') === state.view ? 'true' : 'false'); });
    var n = 0; LEAF.forEach(function (f) { n += Object.keys(state.sel[f.k]).length; });
    $('#hh-filter-btn').textContent = 'Filter' + (n ? ' (' + n + ')' : '');
    var chips = []; LEAF.forEach(function (f) { Object.keys(state.sel[f.k]).forEach(function (v) { chips.push('<button type="button" class="hh-chip" data-k="' + f.k + '" data-v="' + esc(v) + '">' + esc(v) + ' ×</button>'); }); });
    syncUrl();
    $('#hh-active').innerHTML = chips.join('') + (chips.length ? '<button type="button" class="hh-clear" id="hh-clear-all">Clear all</button>' : '');
  }
  function syncUrl() {
    try {
      var q = []; if (state.q) q.push('q=' + encodeURIComponent(state.q));
      LEAF.forEach(function (f) { Object.keys(state.sel[f.k]).forEach(function (v) { q.push(encodeURIComponent(f.k) + '=' + encodeURIComponent(v)); }); });
      history.replaceState(null, '', location.pathname + (q.length ? '?' + q.join('&') : ''));
    } catch (e) {}
  }
  function fromUrl() {
    try {
      new URLSearchParams(location.search).forEach(function (v, k) {
        if (k === 'q') { state.q = v; $('#hh-q').value = v; return; }
        var f = LEAF.filter(function (x) { return x.k === k; })[0];
        if (f && f.counts[v]) state.sel[k][v] = 1;
      });
    } catch (e) {}
  }
  function reset() { state.limit = state.view === 'preview' ? 40 : 12; render(); }

  // ---- filter panel ----
  function opts(f) {
    return '<div class="hh-opts">' + f.opts.map(function (o) {
      var id = 'f-' + f.k + '-' + o.replace(/[^a-z0-9]/gi, '');
      return '<label for="' + id + '"><input type="checkbox" id="' + id + '" data-k="' + f.k + '" data-v="' + esc(o) + '"' + (state.sel[f.k][o] ? ' checked' : '') + '> ' + esc(o) + ' <span>' + f.counts[o] + '</span></label>';
    }).join('') + '</div>';
  }
  function buildPanel() {
    var html = '', curG = '';
    FACETS.forEach(function (f) {
      if (f.g !== curG) { curG = f.g; html += '<h3 class="hh-g">' + esc(curG) + '</h3>'; }
      var body = f.na ? '<p class="hh-na">We do not have published ratings for this yet. It is coming soon.</p>' : opts(f);
      html += '<details class="hh-fg"' + (f.na ? ' data-na="1"' : '') + '><summary>' + esc(f.l) + '</summary>' + body + '</details>';
    });
    $('#hh-panel-body').innerHTML = html;
  }
  function setSel(k, v, on) { if (on) state.sel[k][v] = 1; else delete state.sel[k][v]; }

  document.addEventListener('change', function (e) {
    var t = e.target;
    if (t.matches && t.matches('input[data-k]')) { setSel(t.getAttribute('data-k'), t.getAttribute('data-v'), t.checked); reset(); }
    if (t.id === 'hh-sort') { state.sort = t.value; reset(); }
  });
  document.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('a[data-k]') : null;
    if (a && !e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0) {
      e.preventDefault();
      LEAF.forEach(function (f) { state.sel[f.k] = {}; }); state.q = ''; $('#hh-q').value = '';
      setSel(a.getAttribute('data-k'), a.getAttribute('data-v'), true);
      buildPanel(); reset();
      var tp = $('#hh-count'); if (tp && tp.scrollIntoView) tp.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    var t = e.target.closest ? e.target.closest('button,[data-view]') : null;
    if (!t) return;
    if (t.hasAttribute('data-view')) { state.view = t.getAttribute('data-view'); try { localStorage.setItem('db-view', state.view); } catch (x) {} reset(); }
    else if (t.id === 'hh-filter-btn') { document.body.classList.toggle('hh-open'); }
    else if (t.id === 'hh-close' || t.id === 'hh-scrim') { document.body.classList.remove('hh-open'); }
    else if (t.id === 'hh-more') { state.limit += state.view === 'preview' ? 60 : 12; render(); }
    else if (t.classList.contains('hh-chip')) { setSel(t.getAttribute('data-k'), t.getAttribute('data-v'), false); var cb = document.querySelector('input[data-k="' + t.getAttribute('data-k') + '"][data-v="' + t.getAttribute('data-v').replace(/"/g, '\\"') + '"]'); if (cb) cb.checked = false; reset(); }
    else if (t.id === 'hh-clear-all' || t.id === 'hh-reset') { LEAF.forEach(function (f) { state.sel[f.k] = {}; }); state.q = ''; $('#hh-q').value = ''; document.querySelectorAll('input[data-k]').forEach(function (c) { c.checked = false; }); reset(); }
  });
  var timer;
  $('#hh-q').addEventListener('input', function (e) { clearTimeout(timer); var v = e.target.value; timer = setTimeout(function () { state.q = v; reset(); }, 120); });
  $('#hh-sort').innerHTML = Object.keys(SORTS).map(function (k) { return '<option value="' + k + '">' + SORTS[k] + '</option>'; }).join('');
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') document.body.classList.remove('hh-open'); });
  fromUrl(); buildPanel(); render();
})();
