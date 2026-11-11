// Static site generator for DupesBase.com
// Usage: node build.mjs   -> writes the finished site to ./public
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(fs.readFileSync(path.join(root, 'config.json'), 'utf8'));
const out = path.join(root, 'public');
if (/^YOURTAG/i.test(cfg.amazonTag)) console.warn('WARNING: config.json still has the placeholder Amazon tag. Set amazonTag before publishing.');

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const slugify = (s) => s.toLowerCase().replace(/&/g, 'and').replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const DISCLOSURE = 'As an Amazon Associate I earn from qualifying purchases.';
const disclosureBox = `<div class="disclosure"><b>Affiliate disclosure:</b> ${DISCLOSURE} Links to Amazon on this page may earn us a commission at no extra cost to you. <a href="/affiliate-disclosure/">Details</a>.</div>`;
const TIER_ORDER = ['Under $50', '$50 to $150', '$150 and up'];

// ---------- Data ----------
const F = JSON.parse(fs.readFileSync(path.join(root, 'data/fragrances.json'), 'utf8'));
const PRICES_RAW = fs.existsSync(path.join(root, 'data/prices.json')) ? JSON.parse(fs.readFileSync(path.join(root, 'data/prices.json'), 'utf8')) : {};
// Each entry: { size: "3.4 oz / 100 ml", quotes: [{ amount, source, date }] }. The site shows the average of the quotes.
const PRICES = {};
for (const [k, v] of Object.entries(PRICES_RAW)) {
  const qs = (v.quotes || []).filter((q) => q.amount > 0);
  if (!qs.length) continue;
  PRICES[k] = { amount: Math.round((qs.reduce((t, q) => t + q.amount, 0) / qs.length) * 100) / 100, size: v.size, n: qs.length, sources: [...new Set(qs.map((q) => q.source))], date: qs.map((q) => q.date).sort().pop() };
}
const priceTxt = (p) => p ? `$${p.amount.toFixed(2)}` : '';
const priceDate = (p) => new Date(p.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const priceNote = (p) => p ? (p.sources.length === 1 && p.sources[0] === 'owner' ? `${p.size}, price as of ${priceDate(p)}` : p.n > 1 ? `Average of ${p.n} retailers (${p.sources.join(', ')}), ${p.size}, ${priceDate(p)}` : `${p.size} at ${p.sources[0]}, ${priceDate(p)}`) : '';
const SYN = { cassis: 'blackcurrant', 'black currant': 'blackcurrant', 'green apple': 'apple', 'pineapple leaf': 'pineapple', 'moroccan jasmine': 'jasmine', 'jasminum grandiflorum': 'jasmine', 'bitter almond': 'almond', 'candied almond': 'almond', cedar: 'cedarwood', 'woody notes': 'woods', 'dry woods': 'woods', 'wild lavender': 'lavender', 'tonka bean': 'tonka' };
const norm = (n) => { const k = n.toLowerCase().trim(); return SYN[k] || k; };
{
  const seen = {};
  for (const f of F) {
    let s = slugify(`${f.brand} ${f.name}`), n = 2;
    while (seen[s]) s = `${slugify(`${f.brand} ${f.name}`)}-${n++}`;
    seen[s] = 1; f.slug = s;
    f.full = `${f.brand} ${f.name}`;
    if (PRICES[f.full]) { f.price = PRICES[f.full]; f.tier = f.price.amount < 50 ? 'Under $50' : f.price.amount <= 150 ? '$50 to $150' : '$150 and up'; }
    f.top = f.top || []; f.heart = f.heart || []; f.base = f.base || []; f.flat = f.flat || [];
    f.allNotes = [...f.top, ...f.heart, ...f.base, ...f.flat];
    f.nk = [...new Set(f.allNotes.map(norm))];
    f.accords = f.accords || []; f.season = f.season || [];
    const dir = path.join(root, 'static', 'img', 'f', f.slug);
    if (fs.existsSync(path.join(dir, 'icon.webp'))) f.img = 1;
    if (fs.existsSync(dir)) f.n = fs.readdirSync(dir).filter((x) => /^\d+\.webp$/.test(x)).length;
  }
}
const BY = Object.fromEntries(F.map((f) => [f.slug, f]));
const byName = (n) => F.find((f) => f.name === n);
function overlap(a, b) {
  const A = new Set(a.nk), B = new Set(b.nk), common = [...A].filter((x) => B.has(x));
  const union = new Set([...A, ...B]).size;
  return { common, pct: union ? Math.round((common.length / union) * 100) : 0 };
}
const PAIRS = [];
const byFull = Object.fromEntries(F.map((f) => [f.full, f]));
const PAIR_SRC = { name: 'Reported similarity figure as supplied to Dupes Base (not our testing)', url: '/about/#similarity' };
const specs = new Map();
for (const f of F) {
  if (!f.similarTo) continue;
  const o = byName(f.similarTo);
  if (!o) throw new Error('similarTo not found: ' + f.similarTo);
  specs.set(o.slug + '|' + f.slug, { o, c: f, rep: typeof f.reported === 'number' ? f.reported : null, source: f.pairSource });
}
{
  const pj = path.join(root, 'data', 'pairs.json');
  const list = fs.existsSync(pj) ? JSON.parse(fs.readFileSync(pj, 'utf8')) : [];
  for (const p of list) {
    const o = byFull[p.original], c = byFull[p.clone];
    if (!o || !c) throw new Error('pairs.json: unknown fragrance ' + (o ? p.clone : p.original));
    const k = o.slug + '|' + c.slug, prev = specs.get(k);
    specs.set(k, { o, c, rep: p.pct, source: (prev && prev.source) || p.source || PAIR_SRC });
  }
}
for (const { o, c: f, rep, source } of specs.values()) {
  const ov = overlap(o, f);
  const hasNotes = !!(o.nk.length && f.nk.length);
  const main = rep != null ? rep : hasNotes ? ov.pct : null;
  const lab = rep != null ? 'reported similarity' : 'notes overlap';
  const extra = { rep, hasNotes, main, lab };
  PAIRS.push({ a: o.slug, b: f.slug, pct: ov.pct, common: ov.common, source, ...extra });
  (o.pairs = o.pairs || []).push({ with: f.slug, ...ov, source, ...extra });
  (f.origs = f.origs || []).push({ with: o.slug, ...ov, source, ...extra });
}
const byMain = (x, y) => (y.main ?? -1) - (x.main ?? -1);
PAIRS.sort(byMain);
for (const f of F) { if (f.pairs) f.pairs.sort(byMain); if (f.origs) { f.origs.sort(byMain); f.pair = f.origs[0]; } }
const mainTxt = (p) => (p.main == null ? '' : `${p.rep != null ? '~' : ''}${p.main}% ${p.lab}`);
const pairOf = (f) => (f.pair ? { ...f.pair, asClone: true } : f.pairs ? f.pairs[0] : null);

// ---------- Amazon ----------
const withTag = (u) => (/^https?:\/\/(www\.)?amazon\.com\//i.test(u) && !/[?&]tag=/.test(u) ? u + (u.includes('?') ? '&' : '?') + 'tag=' + cfg.amazonTag : u);
const amazonLink = (f) =>
  f.link ? withTag(f.link) : f.asin ? `https://www.amazon.com/dp/${f.asin}?tag=${cfg.amazonTag}` : `https://www.amazon.com/s?k=${encodeURIComponent(f.full + ' perfume')}&tag=${cfg.amazonTag}`;
const storeLinks = (f) => [
  ['Jomashop', `https://www.jomashop.com/search?q=${encodeURIComponent(f.full)}${cfg.jomashopParams || ''}`],
  ['FragranceNet', `https://www.fragrancenet.com/search?q=${encodeURIComponent(f.full)}${cfg.fragrancenetParams || ''}`],
];
const buyBtn = (f, cls = '') => `<span class="buy">${storeLinks(f).map(([n, u]) => `<a class="btn btn2 ${cls}" href="${esc(u)}" target="_blank" rel="nofollow noopener">Find on ${n} <small>→</small></a>`).join('')}<a class="btn ${cls}" href="${esc(amazonLink(f))}" target="_blank" rel="sponsored nofollow noopener">${f.asin || f.link ? 'View on Amazon' : 'Check price on Amazon'} <small>→</small></a></span>`;

// ---------- Placeholder bottle art ----------
const bottle = (f) => {
  const s = '#0d0f1f', orig = f && f.role === 'original';
  return `<svg viewBox="0 0 120 150" role="img" aria-hidden="true"><rect x="46" y="6" width="28" height="22" rx="4" fill="${s}" stroke="currentColor" stroke-width="3"/><rect x="52" y="28" width="16" height="10" fill="currentColor"/><rect x="22" y="38" width="76" height="104" rx="${orig ? 8 : 20}" fill="currentColor"/><rect x="34" y="62" width="52" height="46" rx="4" fill="${s}"/><rect x="42" y="74" width="36" height="4" fill="currentColor" opacity=".7"/><rect x="42" y="84" width="26" height="4" fill="currentColor" opacity=".7"/></svg>`;
};
const pic = (f, extra = 'loading="lazy"') => (f.img ? `<img src="/img/f/${f.slug}/icon.webp" alt="${esc(f.full)} bottle" width="480" height="360" ${extra}>` : f.imageUrl ? `<img referrerpolicy="no-referrer" src="${esc(f.imageUrl)}" alt="${esc(f.full)} bottle" ${extra}>` : bottle(f));
const thumb = (f) => `<div class="thumb">${pic(f)}</div>`;

// ---------- Components ----------
const roleLabel = (f) => (f.role === 'original' ? 'Original' : 'Alternative');
const noteLine = (f) =>
  f.flat.length ? `<b>Published notes:</b> ${esc(f.flat.join(', '))}` : [['Top', f.top], ['Heart', f.heart], ['Base', f.base]].filter(([, a]) => a.length).map(([k, a]) => `<b>${k}:</b> ${esc(a.join(', '))}`).join(' · ');
const metaLine = (f) => [f.brand, f.concentration, f.gender].filter(Boolean).map(esc).join(' · ');
const tierLine = (f) => `<div class="price">Approx. price tier: ${esc(f.tier)} <small>(check Amazon for the live price)</small></div>`;
function productCard(f, rank) {
  const p = pairOf(f);
  const other = p ? BY[p.with] : null;
  return `<section class="product" id="${f.slug}">
  ${thumb(f)}
  <div>
    ${rank ? `<div class="rank">#${rank}</div>` : ''}
    <h3>${esc(f.full)}<span class="badge">${roleLabel(f)}</span></h3>
    <div class="meta">${metaLine(f)}${f.year ? ' · ' + f.year : ''}${f.size ? ' · ' + esc(f.size) : ''}</div>
    ${tierLine(f)}
    <p class="notes">${noteLine(f)}</p>
    ${f.accords.length ? `<p class="notes"><b>Main accords (as listed):</b> ${esc(f.accords.join(', '))}</p>` : ''}
    ${other ? `<p class="notes"><b>${p.asClone ? 'Commonly compared to' : 'Commonly compared with'}:</b> <a href="/fragrance/${other.slug}/">${esc(other.full)}</a>.${p.main != null ? ' ' + mainTxt(p).replace(/^./, (c) => c.toUpperCase()) + (p.rep == null ? ` (${p.common.length} shared notes)` : '') + '.' : ''} <a href="/compare/${pairSlug(p.asClone ? other : f, p.asClone ? f : other)}/">Compare side by side</a>.</p>` : ''}
    <p>${buyBtn(f)} <a class="btn btn2" href="/fragrance/${f.slug}/">Full notes</a></p>
  </div>
</section>`;
}
const faqBlock = (items) => `<h2>Quick answers</h2><div class="faq">${items.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${a}</p></details>`).join('')}</div>`;
const sourcesFor = (list) => {
  const seen = new Map();
  for (const f of list) { if (f.source) seen.set(f.source.url, f.source.name); const p = pairOf(f); if (p && p.source) seen.set(p.source.url, p.source.name); }
  return `<h2>Where this guide comes from</h2>
<p>We have not tested these fragrances ourselves. Notes, release years and "commonly compared to" links come from the published sources below, and notes lists differ between sources, so treat them as a guide. The overlap percentage is a rough comparison of two published note lists. It is not a measure of how similar the two smell. Fragrances can smell different on different people and from batch to batch. Price tiers are approximate. Check the Amazon listing for the live price, size and seller.</p>
<ul>${[...seen].map(([u, n]) => `<li><a href="${esc(u)}" rel="noopener nofollow" target="_blank">${esc(n)}</a></li>`).join('')}</ul>`;
};
const pairSlug = (a, b) => `${a.slug}-vs-${b.slug}`;
function pairTable(ps) {
  return `<div class="tablewrap"><table>
<tr><th>Original</th><th>Alternative</th><th>Match</th><th>Gender</th><th>Alt. price tier</th></tr>
${ps.map((p) => { const a = BY[p.a], b = BY[p.b]; return `<tr><td><a href="#${a.slug}">${esc(a.full)}</a></td><td><a href="#${b.slug}">${esc(b.full)}</a></td><td>${esc(mainTxt(p) || '—')}</td><td>${esc(a.gender)}</td><td>${esc(b.tier)}</td></tr>`; }).join('\n')}
</table></div>`;
}
function listTable(ids) {
  return `<div class="tablewrap"><table>
<tr><th>Fragrance</th><th>Concentration</th><th>Gender</th><th>Price tier</th><th>Commonly compared to</th></tr>
${ids.map((f) => { const p = pairOf(f); return `<tr><td><a href="#${f.slug}">${esc(f.full)}</a></td><td>${esc(f.concentration || 'Not listed')}</td><td>${esc(f.gender)}</td><td>${esc(f.tier)}</td><td>${p ? esc(BY[p.with].full) : '—'}</td></tr>`; }).join('\n')}
</table></div>`;
}

// ---------- Page shell ----------
const NAV = [['/', 'Database'], ['/compare/', 'Compare'], ['/guides/', 'Guides'], ['/about/', 'About']];
function page({ title, desc, url, body, type = 'website', datePublished, wide = false, scripts = '', crumbs = null, product = null, image = null }) {
  const full = cfg.domain + url;
  const graph = [];
  if (type === 'article') {
    graph.push({ '@context': 'https://schema.org', '@type': 'Article', headline: title, description: desc, image: `${cfg.domain}/og-image.png`, datePublished, dateModified: datePublished, mainEntityOfPage: full, author: { '@type': 'Organization', name: cfg.siteName, url: cfg.domain }, publisher: { '@type': 'Organization', name: cfg.siteName, url: cfg.domain } });
    const faqs = [...String(body).matchAll(/<details><summary>([\s\S]*?)<\/summary><p>([\s\S]*?)<\/p><\/details>/g)].map((m) => ({ '@type': 'Question', name: m[1].replace(/<[^>]+>/g, ''), acceptedAnswer: { '@type': 'Answer', text: m[2].replace(/<[^>]+>/g, '') } }));
    if (faqs.length) graph.push({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqs });
  }
  if (url === '/') graph.push({ '@context': 'https://schema.org', '@type': 'WebSite', name: cfg.siteName, url: cfg.domain + '/', potentialAction: { '@type': 'SearchAction', target: `${cfg.domain}/database/?q={search_term_string}`, 'query-input': 'required name=search_term_string' } });
  if (crumbs) graph.push({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: crumbs.map(([n, u], k) => ({ '@type': 'ListItem', position: k + 1, name: n, item: cfg.domain + u })) });
  if (product) graph.push({ '@context': 'https://schema.org', '@type': 'Product', ...product, url: full });
  const ld = graph.map((g) => `<script type="application/ld+json">${JSON.stringify(g)}</script>`).join('\n');
  const og = image ? cfg.domain + image : cfg.domain + '/og-image.png';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="index,follow,max-image-preview:large">
<meta name="theme-color" content="#0d0f1f">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${full}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="${type}">
<meta property="og:url" content="${full}">
<meta property="og:site_name" content="${esc(cfg.siteName)}">
<meta property="og:image" content="${og}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(cfg.siteName)} logo">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${og}">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/style.css">
${ld}
</head>
<body>
<header class="site"><div class="wrap">
  <a class="logo" href="/" aria-label="${esc(cfg.siteName)} home"><img class="logo-ico" src="/favicon.svg" alt="" width="34" height="34"><span class="logo-t">DUPES<span>BASE</span></span></a>
  <nav aria-label="Main">${NAV.map(([h, t]) => `<a href="${h}"${(h === '/' ? url === '/' : url.startsWith(h)) ? ' class="active" aria-current="page"' : ''}>${t}</a>`).join('')}</nav>
</div></header>
<main class="wrap${wide ? ' wide' : ''}">
${body}
</main>
<footer class="site"><div class="wrap">
  <p>${DISCLOSURE}</p>
  <p><a href="/affiliate-disclosure/">Affiliate Disclosure</a> · <a href="/privacy/">Privacy</a> · <a href="/about/">About</a> · <a href="mailto:${esc(cfg.contactEmail)}?subject=Suggest%20a%20dupe">Suggest a dupe</a> · <a href="mailto:${esc(cfg.contactEmail)}?subject=Report%20an%20issue">Report an issue</a> · © ${new Date().getFullYear()} ${esc(cfg.siteName)}</p>
  <p>Brand names and trademarks belong to their owners and are used only to identify products. ${esc(cfg.siteName)} is not affiliated with any fragrance house. Prices and availability change; check Amazon for current details.</p>
</div></footer>
${scripts}
</body>
</html>
`;
}

// ---------- Guides (posts) ----------
const posts = [];
const O = (n) => byName(n);
const alts = F.filter((f) => f.role === 'alternative');

// POST 1: pairs hub
{
  const slug = 'best-designer-fragrance-dupes-2026';
  const title = 'Designer and Niche Fragrance Dupes: 4 Popular Pairs (2026)';
  const desc = 'Four well-known designer and niche fragrances and the alternatives people most often compare them to, with published notes, a notes-overlap score for each pair and Amazon links.';
  const body = `<article>
<span class="pill">DUPES · POPULAR PAIRS</span>
<h1>${esc(title)}</h1>
<p class="meta">Updated ${esc(cfg.updated)}</p>
<p class="lead">A "dupe" is a cheaper fragrance that people commonly compare to a pricier one. It is not the same perfume, and it will not smell identical on your skin. Here are four widely discussed pairs, each shown with published notes, a rough notes-overlap score and an Amazon link for both sides.</p>
<p>Short on time? Browse every pair in the <a href="/database/">Dupes Database</a> or run any two through <a href="/compare/">Compare</a>.</p>
<h2>The four pairs at a glance</h2>
${pairTable(PAIRS.filter((p) => p.hasNotes))}
<h2>Pair by pair</h2>
${PAIRS.filter((p) => p.hasNotes).map((p) => { const a = BY[p.a], b = BY[p.b]; return `<h3 class="pairh">${esc(a.full)} vs ${esc(b.full)}</h3>${productCard(a)}${productCard(b)}`; }).join('\n')}
<h2>How to shop for a dupe</h2>
<ul>
<li><b>Treat the notes as a starting point.</b> Two fragrances can share many notes and still smell different, because of the ratio of notes and the base materials.</li>
<li><b>Check the concentration and size.</b> EDT, EDP and parfum differ in strength, and sizes vary by listing.</li>
<li><b>Buy from Amazon or an authorized seller.</b> Counterfeits exist for popular originals, so a very low price on a designer bottle is a warning sign.</li>
<li><b>Start small if you can.</b> A sample or small size is a cheap way to find out whether it suits you.</li>
</ul>
${faqBlock([
  ['What is a fragrance dupe?', 'A dupe is a fragrance that people commonly compare to a more expensive one because they share some notes or a similar style. It is a different product from a different brand, not a copy of the original bottle.'],
  ['What does the notes overlap percentage mean?', 'It compares the published note lists of two fragrances and shows how much they share. It is a rough guide only and does not measure how similar the two smell.'],
  ['Are dupes the same as counterfeits?', 'No. A counterfeit pretends to be the original brand. The alternatives listed here are sold under their own brand names. Our buttons go to Amazon, and you should check the seller and the listing.'],
  ['Will a dupe smell exactly like the original?', 'Probably not exactly. Fragrances change from person to person and from batch to batch. Use our notes and the community comparisons as a guide.']
])}
${sourcesFor(F.filter((f) => f.pair || f.pairs))}
${disclosureBox}
</article>`;
  posts.push({ slug, title, desc, body, blurb: 'Four popular designer and niche fragrances next to the alternatives people compare them to, with published notes and links.', kicker: 'POPULAR PAIRS', hero: F.find((f) => f.slug.includes('armaf')) });
}

// POST 2: under $50
{
  const list = F.filter((f) => f.role === 'alternative' && f.tier === 'Under $50');
  const slug = 'best-fragrance-dupes-under-50-2026';
  const title = `Best Fragrance Dupes Under $50: ${list.length} Picks for 2026`;
  const desc = 'Affordable fragrance alternatives to popular designer and niche scents, typically priced under $50, with published notes and Amazon links.';
  const body = `<article>
<span class="pill">UNDER $50 · BUDGET</span>
<h1>${esc(title)}</h1>
<p class="meta">Updated ${esc(cfg.updated)}</p>
<p class="lead">You do not need to spend $300 to wear something that smells rich. These ${list.length} fragrances are typically priced under $50, and each button goes to Amazon. For each one we show the published notes and, where one exists, the pricier original it is commonly compared to.</p>
<h2>The ${list.length} at a glance</h2>
${listTable(list)}
<h2>The picks</h2>
${list.map((f, i) => productCard(f, i + 1)).join('\n')}
<h2>Before you buy</h2>
<ul>
<li><b>Prices move.</b> The tier shown is approximate and based on typical pricing, so use the Amazon button for the live price.</li>
<li><b>Check the size.</b> Listings vary between sizes and sellers.</li>
<li><b>Look at the seller.</b> Buy from the brand's own storefront or Amazon itself where possible.</li>
</ul>
${faqBlock([
  ['What is the best cheap fragrance?', 'It depends on the style you like. Browse by gender and notes in the <a href="/database/">Dupes Database</a> and compare two picks in <a href="/compare/">Compare</a>.'],
  ['Are cheap fragrances worse?', 'Not necessarily. Price reflects brand, marketing and ingredients, but how a fragrance smells and lasts on you is personal. We have not tested these ourselves.'],
  ['Which of these are for women?', 'In this list, Lattafa Yara is the one listed for women. Others are listed for men or as unisex. Gender labels are marketing, so wear what you like.']
])}
${sourcesFor(list)}
${disclosureBox}
</article>`;
  posts.push({ slug, title, desc, body, blurb: 'Affordable alternatives with Amazon links, published notes and the originals they are compared to.', kicker: 'UNDER $50' });
}

// POST 3: winter
{
  const list = F.filter((f) => f.season.includes('Winter') && f.role === 'alternative');
  const slug = 'best-winter-fragrance-dupes-2026';
  const title = 'Best Warm Winter Fragrance Dupes for 2026';
  const desc = 'Warm, sweet and spicy fragrances for fall and winter, with affordable alternatives to popular niche scents, published notes and Amazon links.';
  const body = `<article>
<span class="pill">WINTER · WARM SCENTS</span>
<h1>${esc(title)}</h1>
<p class="meta">Updated ${esc(cfg.updated)}</p>
<p class="lead">Cold weather suits warm, sweet and spicy fragrances. These picks list accords such as vanilla, amber, cinnamon and spice, which is why we file them under fall and winter. That season label is our own editorial read of the published accords, not a test result.</p>
<h2>At a glance</h2>
${listTable(list)}
<h2>The picks</h2>
${list.map((f, i) => productCard(f, i + 1)).join('\n')}
<h2>Want the original too?</h2>
<p>Where a pick is commonly compared to a pricier fragrance, the original is shown in the notes above and in the <a href="/database/?role=Original">database</a>. You can also use <a href="/compare/">Compare</a> to line the two up.</p>
${faqBlock([
  ['What makes a fragrance a winter fragrance?', 'Warm notes such as vanilla, amber, cinnamon and spice are usually described as cold-weather scents. This is a general rule of thumb, not a hard line.'],
  ['Can I wear these in summer?', 'You can wear any fragrance any time, but heavy sweet and spicy scents can feel strong in heat. Use fewer sprays.'],
  ['Where do the seasons come from?', 'The season label is our editorial read of each fragrance\'s published accords. We have not tested these fragrances.']
])}
${sourcesFor(list)}
${disclosureBox}
</article>`;
  posts.push({ slug, title, desc, body, blurb: 'Warm vanilla, amber and spice fragrances for fall and winter, with published notes and Amazon links.', kicker: 'WINTER' });
}

// POST 4: Aventus vs CDNIM
function vsPost(origName, altName, extra) {
  const o = O(origName), a = O(altName);
  const p = a.pair;
  const slug = `${a.slug}-vs-${o.slug}`;
  const title = `${a.full} vs ${o.full}: Notes Compared`;
  const desc = `${a.full} compared with ${o.full}: published notes side by side, ${p.pct}% notes overlap, price tiers, and what each is described as.`;
  const rows = [['Concentration', (f) => f.concentration || 'Not listed'], ['Gender', (f) => f.gender], ['Released', (f) => f.year || 'Not listed'], ['Size', (f) => f.size || 'Check the listing'], ['Approx. price tier', (f) => f.tier], ['Top notes', (f) => f.top.join(', ') || (f.flat.length ? 'See notes below' : 'Not listed')], ['Heart notes', (f) => f.heart.join(', ') || '—'], ['Base notes', (f) => f.base.join(', ') || '—']];
  const body = `<article>
<span class="pill">COMPARISON</span>
<h1>${esc(title)}</h1>
<p class="meta">Updated ${esc(cfg.updated)}</p>
<p class="lead">${esc(a.full)} is commonly compared to ${esc(o.full)}. Here are the published notes side by side. The published notes overlap is <b>${p.pct}%</b> (${p.common.length} shared notes). That is a rough comparison of two lists, and it is not a measure of how alike they smell.</p>
<p><b>Short answer:</b> ${extra.short}</p>
<h2>${esc(a.name)} vs ${esc(o.name)} at a glance</h2>
<div class="tablewrap"><table>
<tr><th></th><th>${esc(o.full)}</th><th>${esc(a.full)}</th></tr>
${rows.map(([k, fn]) => `<tr><td>${esc(k)}</td><td>${esc(fn(o))}</td><td>${esc(fn(a))}</td></tr>`).join('\n')}
<tr><td>Notes in common</td><td colspan="2">${esc(p.common.join(', ') || 'None found')}</td></tr>
</table></div>
${productCard(o)}
${productCard(a)}
<p>Want to line them up interactively? <a href="/compare/${pairSlug(o, a)}/">Open the Compare tool for this pair</a>.</p>
<h2>How to choose</h2>
<ul>${extra.choose.map((c) => `<li>${c}</li>`).join('')}</ul>
${faqBlock(extra.faq)}
${sourcesFor([o, a])}
${disclosureBox}
</article>`;
  posts.push({ slug, title, desc, body, blurb: `Published notes side by side, a ${p.pct}% notes overlap and the price tiers.`, kicker: 'COMPARISON', hero: a });
}
vsPost('Aventus', 'Club de Nuit Intense Man', {
  short: 'if you want to try the style at a much lower price, the Armaf is the one people reach for. If you want the exact Creed, only the Creed is the Creed. The notes lists share fruit and birch, but they are not identical.',
  choose: ['<b>Choose the Armaf</b> if you want to explore a fruity, smoky style without a large spend.', '<b>Choose the Creed</b> if you want the original and its own character, and the budget is not a concern.', '<b>Either way,</b> check the concentration and size on the Amazon listing. The Armaf is listed here as an EDT.'],
  faq: [['Is Armaf Club de Nuit Intense Man a Creed Aventus dupe?', 'It is commonly compared to Aventus by reviewers, but it is a different fragrance from a different brand. Their published note lists overlap on fruit, jasmine, birch and patchouli, and they differ elsewhere.'], ['Does it smell exactly like Aventus?', 'We have not tested either, and fragrances vary by person and batch. Treat the comparison as a guide.'], ['Which is cheaper?', 'The Armaf, which sits in our "Under $50" tier, compared with "$150 and up" for the Creed. Check Amazon for live prices.']]
});

// POST 5: Khamrah vs Angels' Share
vsPost("Angels' Share", 'Khamrah', {
  short: 'Khamrah is the budget option people compare to Angels\' Share. Both are warm, sweet and spiced, and both list cinnamon, tonka bean, praline and vanilla.',
  choose: ['<b>Choose Khamrah</b> if you like warm, sweet, spicy scents and want to spend far less.', '<b>Choose Angels\' Share</b> if you want the Kilian original, with its cognac and oak notes.', '<b>Either way,</b> use fewer sprays at first. Both are described as sweet and rich.'],
  faq: [["Is Lattafa Khamrah a Kilian Angels' Share dupe?", "It is commonly compared to Angels' Share by reviewers and retailers. It is a different fragrance from Lattafa, and its notes list adds dates, nutmeg and tuberose."], ['Is Khamrah for men or women?', 'It is listed as unisex.'], ['Which is better for winter?', 'Both list warm, sweet accords that are usually described as fall and winter scents. We have not tested either.']]
});

// ---------- Static pages ----------
const aboutBody = `<article><h1>About ${esc(cfg.siteName)}</h1>
<p class="lead">${esc(cfg.siteName)} is a searchable database of fragrance dupes: pricier designer and niche originals next to the alternatives people commonly compare them to.</p>
<p>We list published notes, release years, concentrations and price tiers, and we show a rough notes-overlap score so you can compare two fragrances quickly. We have not smelled or tested these fragrances ourselves, and we say where each note list comes from. Our buttons go to Amazon, so please confirm the seller, size and price on the listing before you buy.</p>
<p>The site is supported by Amazon affiliate commissions. See our <a href="/affiliate-disclosure/">affiliate disclosure</a>. Know a dupe we should add, or spotted a mistake? Email <a href="mailto:${esc(cfg.contactEmail)}">${esc(cfg.contactEmail)}</a>.</p>
<p><a class="btn" href="mailto:${esc(cfg.contactEmail)}?subject=Suggest%20a%20dupe">Suggest a dupe</a> <a class="btn btn2" href="mailto:${esc(cfg.contactEmail)}?subject=Report%20an%20issue">Report an issue</a></p>
<h2 id="similarity">About the similarity percentages</h2>
<p>Percentages marked with a ~ are reported similarity figures that were supplied to us. They are not our own measurements, and we have not tested these fragrances. Where no reported figure exists, we show a rough overlap of the published note lists, marked "notes". That overlap does not measure how alike two fragrances smell, because the amounts of each note and the base materials matter a lot. Fragrances also smell different on different people.</p>
${disclosureBox}</article>`;
const disclosureBody = `<article><h1>Affiliate Disclosure</h1>
<p><b>${DISCLOSURE}</b></p>
<p>${esc(cfg.siteName)} is a participant in the Amazon Services LLC Associates Program, an affiliate advertising program designed to provide a means for sites to earn advertising fees by advertising and linking to Amazon.com. When you click a link to Amazon on this site and make a qualifying purchase, we may earn a commission at no extra cost to you.</p>
<p>Commissions do not change what we list or how we describe it. Prices and availability on Amazon change at any time, so please check the Amazon listing for current information.</p><p>Our "Find on Jomashop" and "Find on FragranceNet" buttons are plain links to search results on those stores. They are not affiliate links today and we earn nothing from them. If that changes, we will say so here. Those retailers set their own prices, stock and sellers, so check each listing before you buy.</p></article>`;
const privacyBody = `<article><h1>Privacy Policy</h1>
<p>Last updated ${esc(cfg.updated)}.</p>
<p>${esc(cfg.siteName)} is a static website. We do not ask you to create an account, and we do not collect personal information through forms. If you email us, we use your address only to reply.</p>
<p><b>Hosting and analytics.</b> The site is delivered through Cloudflare, which may process technical data such as IP addresses to deliver pages and protect the site. If we add privacy-friendly analytics, we will list it here.</p>
<p><b>Third-party links.</b> Links to Amazon and other sites are governed by those sites' own privacy policies. Amazon may use cookies to attribute purchases to our affiliate account.</p>
<p><b>Your searches.</b> The database search and filters run in your browser. We do not send what you type to a server.</p>
<p><b>Fonts.</b> We load a font from Google Fonts, which may receive your IP address when it serves the font file.</p>
<p>Contact: <a href="mailto:${esc(cfg.contactEmail)}">${esc(cfg.contactEmail)}</a>.</p></article>`;

// ---------- Home ----------
const ordered = [...posts].reverse();
const entryCard = (p, i) => `<article class="entry${i === 0 ? ' lead-entry' : ''}"><a class="entry-img ph" href="/${p.slug}/" aria-label="${esc(p.title)}">${p.hero ? pic(p.hero) : bottle(p.hero)}</a><div class="entry-body"><span class="pill">${esc(p.kicker)}</span><h2><a href="/${p.slug}/">${esc(p.title)}</a></h2><p>${esc(p.blurb)}</p><a class="more" href="/${p.slug}/">Read the guide →</a></div></article>`;
const topClones = (o) => (o.pairs || []).slice(0, 3);
const featuredCfg = fs.existsSync(path.join(root, 'data', 'featured.json')) ? JSON.parse(fs.readFileSync(path.join(root, 'data', 'featured.json'), 'utf8')) : {};
const featIdx = new Map(); // slug -> { Men: 0, ... } position in each tab's pinned list
for (const [g, names] of Object.entries(featuredCfg)) {
  let n = 0;
  for (const nm of names) {
    const f = byFull[nm];
    if (!f || !(f.pairs || []).length) { console.warn(`featured.json (${g}): "${nm}" is not in the database yet, skipped`); continue; }
    if (!featIdx.has(f.slug)) featIdx.set(f.slug, {});
    featIdx.get(f.slug)[g] = n++;
  }
}
const tile = (o) => {
  const ps = topClones(o);
  const fi = featIdx.get(o.slug) || {};
  const gs = [o.gender || 'Unisex', ...Object.keys(fi).filter((g) => g !== o.gender)].join(' ');
  const hay = [o.full, ...(o.aliases || []), ...(o.pairs || []).flatMap((q) => [BY[q.with].full, ...(BY[q.with].aliases || [])])].join(' ').toLowerCase();
  return `<a class="tile" data-g="${esc(gs)}" data-f='${JSON.stringify(fi)}' data-s="${esc(hay)}" href="/compare/${pairSlug(o, BY[o.pairs[0].with])}/" aria-label="Clones of ${esc(o.full)}"><span class="tile-head"><span class="tile-hd"><span class="tile-k">Clones of</span><b class="tile-t">${esc(o.full)}</b></span><span class="tile-img">${pic(o, 'loading="lazy" decoding="async"')}</span></span><ol class="tile-l">${ps.map((q) => `<li><span class="tile-n">${esc(BY[q.with].full)}</span><span class="tile-p${q.rep == null ? ' nt' : ''}">${q.main == null ? '—' : (q.rep != null ? '~' : '') + q.main + '%'}${q.rep == null && q.main != null ? '<small>notes</small>' : ''}</span></li>`).join('')}</ol><span class="tile-go">See all ${o.pairs.length} ${o.pairs.length === 1 ? 'clone' : 'clones'} →</span></a>`;
};
const featRank = (f, g) => { const v = (featIdx.get(f.slug) || {})[g]; return v == null ? 9999 : v; };
const tileList = F.filter((f) => f.role === 'original' && (f.pairs || []).length).sort((x, y) => (y.pairs[0].main ?? -1) - (x.pairs[0].main ?? -1));
// pinned originals first, in the order given, for the tab they are pinned in (client re-sorts per tab using data-f)
const homeBody = `<section class="hero hero-modern hero-slim">
<h1>Find the dupe. Skip the markup.</h1>
<form class="hero-search" id="tq-form" action="/" method="get" role="search"><input type="search" id="tq" name="q" placeholder="Search an original or a clone, e.g. Aventus or Khamrah" aria-label="Search the database" autocomplete="off"><button class="btn" type="submit">Search</button></form>
</section>
<div class="gtabs" role="tablist" aria-label="Show originals for"><button type="button" role="tab" class="on" aria-selected="true" data-g="Men">Men</button><button type="button" role="tab" aria-selected="false" data-g="Women">Women</button><button type="button" role="tab" aria-selected="false" data-g="Unisex">Unisex</button></div>
<div class="tiles" id="tiles">${tileList.map((o, i) => tile(o).replace('<a class="tile"', `<a class="tile" data-i="${i}"`)).join('')}</div>
<p class="hh-note tiles-more" id="tiles-empty" hidden></p>
<script>(function(){var g='Men',lim=1e9,tabs=document.querySelectorAll('.gtabs button'),ts=document.querySelectorAll('#tiles .tile'),q=document.getElementById('tq'),em=document.getElementById('tiles-empty');
function ord(){var arr=Array.prototype.slice.call(ts),c=document.getElementById('tiles');arr.sort(function(a,b){var x=JSON.parse(a.getAttribute('data-f'))[g],y=JSON.parse(b.getAttribute('data-f'))[g];x=x==null?9999:x;y=y==null?9999:y;return x-y||a.getAttribute('data-i')-b.getAttribute('data-i');});arr.forEach(function(t){c.appendChild(t);});}
function run(){ord();var v=q.value.trim().toLowerCase(),w=v?v.split(/\\s+/):[],n=0,shown=0;Array.prototype.forEach.call(document.querySelectorAll('#tiles .tile'),function(t){var s=t.getAttribute('data-s'),ok=w.length?w.every(function(x){return s.indexOf(x)>-1}):(' '+t.getAttribute('data-g')+' ').indexOf(' '+g+' ')>-1;if(ok)n++;var vis=ok&&shown<lim;if(vis)shown++;t.hidden=!vis;});
em.hidden=n>0;em.textContent=n?'':(w.length?'No match yet. Try the advanced filters, or send us the pair with the Suggest a dupe link below.':'More originals are being added.');}
Array.prototype.forEach.call(tabs,function(b){b.addEventListener('click',function(){g=b.getAttribute('data-g');Array.prototype.forEach.call(tabs,function(x){var on=x===b;x.classList.toggle('on',on);x.setAttribute('aria-selected',on);});run();});});
q.addEventListener('input',function(){run();});document.getElementById('tq-form').addEventListener('submit',function(e){e.preventDefault();run();});
try{var p=new URLSearchParams(location.search).get('q');if(p)q.value=p;}catch(e){}run();})();</script>
${disclosureBox}`;

// ---------- Write ----------
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
fs.cpSync(path.join(root, 'static'), out, { recursive: true });
const assetV = (f) => createHash('md5').update(fs.readFileSync(path.join(root, 'static', f))).digest('hex').slice(0, 8);
const ASSET_VER = Object.fromEntries(['style.css', 'compare.js', 'dupes.js', 'car.js'].filter((f) => fs.existsSync(path.join(root, 'static', f))).map((f) => [f, assetV(f)]));
const versioned = (html) => html.replace(/(href|src)="\/(style\.css|compare\.js|dupes\.js|car\.js)"/g, (m, a, f) => `${a}="/${f}?v=${ASSET_VER[f]}"`);
const write = (rel, html) => { const dir = path.join(out, rel); fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, 'index.html'), versioned(html)); };
const published = '2026-11-10';

write('', page({ title: `${cfg.siteName}: Fragrance Dupes Database`, desc: 'A searchable database of fragrance dupes: designer and niche originals next to the alternatives people compare them to, with published notes and Amazon links.', url: '/', body: homeBody }));
for (const p of posts) write(p.slug, page({ title: `${p.title} | ${cfg.siteName}`, desc: p.desc, url: `/${p.slug}/`, body: p.body, type: 'article', datePublished: published, crumbs: [['Home', '/'], ['Guides', '/guides/'], [p.title, `/${p.slug}/`]] }));
write('guides', page({ title: `Fragrance Dupe Guides | ${cfg.siteName}`, desc: 'Guides to fragrance dupes: popular pairs, budget picks, winter scents and side-by-side comparisons.', url: '/guides/', body: `<section class="hero"><span class="pill">GUIDES</span><h1>Fragrance dupe guides</h1><p>Popular pairs, budget picks, season guides and side-by-side comparisons.</p></section><div class="cards">${ordered.map((p) => `<a class="postcard" href="/${p.slug}/"><span class="pill">${esc(p.kicker)}</span><h2>${esc(p.title)}</h2><p>${esc(p.blurb)}</p></a>`).join('\n')}</div>${disclosureBox}` }));
write('about', page({ title: `About | ${cfg.siteName}`, desc: 'About Dupes Base, a searchable fragrance dupes database.', url: '/about/', body: aboutBody }));
write('affiliate-disclosure', page({ title: `Affiliate Disclosure | ${cfg.siteName}`, desc: 'Amazon Associates affiliate disclosure.', url: '/affiliate-disclosure/', body: disclosureBody }));
write('privacy', page({ title: `Privacy Policy | ${cfg.siteName}`, desc: 'Privacy policy for Dupes Base.', url: '/privacy/', body: privacyBody }));

// ---- data for client scripts ----
const clientItems = F.map((f) => ({ slug: f.slug, name: f.name, brand: f.brand, full: f.full, role: f.role, year: f.year || 0, conc: f.concentration, gender: f.gender, size: f.size, tier: f.tier, top: f.top, heart: f.heart, base: f.base, flat: f.flat, accords: f.accords, season: f.season, nk: f.nk, img: f.img ? 1 : 0, imageUrl: f.imageUrl || '', asin: f.asin || '', link: f.link || '', price: f.price ? { t: priceTxt(f.price), n: priceNote(f.price) } : null }));
const dataJs = 'window.HH_DATA=' + JSON.stringify({ tag: cfg.amazonTag, items: clientItems, pairs: PAIRS.map((p) => ({ a: p.a, b: p.b, pct: p.pct, common: p.common, rep: p.rep, main: p.main, lab: p.lab, hasNotes: p.hasNotes })) }).replace(/</g, '\\u003c') + ';';
const dataHash = createHash('md5').update(dataJs).digest('hex').slice(0, 8);
const dataScript = `<script src="/data.js?v=${dataHash}"></script>`;
fs.writeFileSync(path.join(out, 'data.js'), dataJs);

// ---- database page ----
const dbBody = `<div class="hh-head"><div><span class="pill">DATABASE</span><h1>Fragrance Dupes Database</h1></div></div>
<p class="meta" style="margin:0 0 8px">Search ${F.length} fragrances and ${PAIRS.length} dupe pairs. Notes are as published by the sources named on each page, and we have not tested these fragrances. Buttons go to Amazon.</p>
<div class="hh-bar">
<input type="search" id="hh-q" placeholder="Search a fragrance, house or note…" aria-label="Search fragrances" autocomplete="off">
<div class="hh-views" role="group" aria-label="Layout"><button type="button" class="hh-btn" data-view="pairs" aria-pressed="true">Pairs</button><button type="button" class="hh-btn" data-view="full" aria-pressed="false">Full</button><button type="button" class="hh-btn" data-view="recap" aria-pressed="false">Recap</button><button type="button" class="hh-btn" data-view="preview" aria-pressed="false">Preview</button></div>
<select id="hh-sort" aria-label="Sort"></select>
<button type="button" class="hh-btn" id="hh-filter-btn">Filter</button>
</div>
<div class="hh-meta"><span id="hh-count"></span><span id="hh-active"></span><button type="button" class="hh-clear" id="hh-reset">Reset</button><a class="hh-clear" href="mailto:${esc(cfg.contactEmail)}?subject=Suggest%20a%20dupe">Suggest a dupe</a></div>
<div id="hh-list" class="hh-list hh-pairs"></div>
<button type="button" class="hh-more" id="hh-more">Show more</button>
<p class="hh-note">Notes overlap compares two published note lists. It is not a measure of how similar two fragrances smell. Price tiers are approximate, so check Amazon for the live price. Not every listing is guaranteed, so confirm the seller and size.</p>
${disclosureBox}
<button type="button" id="hh-scrim" aria-label="Close filters"></button>
<aside id="hh-panel" aria-label="Filters"><div class="hh-ph"><b>Filters</b><button type="button" id="hh-close" aria-label="Close">×</button></div><div id="hh-panel-body"></div></aside>`;
write('database', page({ title: `Fragrance Dupes Database: Search and Filter | ${cfg.siteName}`, desc: `Search and filter ${F.length} fragrances and ${PAIRS.length} dupe pairs by gender, price tier, concentration, notes and house.`, url: '/database/', wide: true, body: dbBody, scripts: `${dataScript}<script src="/dupes.js" defer></script>`, crumbs: [['Home', '/'], ['Database', '/database/']] }));

// ---- detail pages ----
const houseCount = {}; for (const f of F) houseCount[f.brand] = (houseCount[f.brand] || 0) + 1;
const houseHref = (b) => (houseCount[b] > 1 ? `/house/${slugify(b)}/` : `/database/?brand=${encodeURIComponent(b)}`);
const fq = (k, v) => `/database/?${k}=${encodeURIComponent(v)}`;
const tagA = (k, v) => `<a class="hh-tag" href="${esc(fq(k, v))}" title="Show all ${esc(v)}">${esc(v)}</a>`;
const kv = (rows) => `<dl class="hh-kv">${rows.filter((r) => r[1] && r[1] !== '?').map((r) => `<div><dt>${esc(r[0])}</dt><dd>${esc(r[1])}</dd></div>`).join('')}</dl>`;
const carousel = (f) => {
  if (!f.n) return `<div class="hh-img dv-img">${pic(f, 'fetchpriority="high" decoding="async"')}</div>`;
  const slides = [`<div class="car-s on"><img src="/img/f/${f.slug}/icon.webp" alt="${esc(f.full)} bottle" width="480" height="360" fetchpriority="high" decoding="async"></div>`, ...Array.from({ length: f.n }, (_, i) => `<div class="car-s"><img src="/img/f/${f.slug}/${i + 1}.webp" alt="${esc(f.full)} photo ${i + 1}" width="640" height="640" loading="lazy" decoding="async"></div>`)];
  return `<div class="hh-img dv-img car" data-car role="region" aria-roledescription="carousel" aria-label="${esc(f.full)} photos">
  <div class="car-view">${slides.join('')}</div>
  <button type="button" class="car-b car-prev" aria-label="Previous photo">&#8249;</button><button type="button" class="car-b car-next" aria-label="Next photo">&#8250;</button>
  <div class="car-dots">${slides.map((_, i) => `<button type="button" class="car-d${i ? '' : ' on'}" aria-label="Show photo ${i + 1}"></button>`).join('')}</div></div>`;
};
const nameLink = (f) => `<a class="hh-brand" href="${esc(houseHref(f.brand))}" title="See all ${esc(f.brand)} fragrances">${esc(f.brand)}</a> ${esc(f.name)}`;
const similarList = (f) => {
  const rel = new Map();
  const p = pairOf(f);
  (f.origs || []).forEach((q) => rel.set(q.with, q));
  (f.pairs || []).forEach((q) => rel.set(q.with, q));
  return [...rel].map(([s, q]) => `<a class="hh-row" href="/fragrance/${s}/"><span class="hh-rimg">${pic(BY[s])}</span><span class="hh-rmain"><b>${esc(BY[s].full)}</b><span class="hh-rtags"><span class="hh-tag">${roleLabel(BY[s])}</span></span></span><span class="hh-rside"><b>${q.main == null ? '—' : (q.rep != null ? '~' : '') + q.main + '%'}</b><span>${q.main == null ? 'not rated' : q.lab}</span></span></a>`).join('');
};
const topThree = (f) => {
  const asOrig = (f.pairs || []).length > 0;
  const arr = (asOrig ? f.pairs : (f.origs || [])).filter((q) => q.main != null).slice().sort((x, y) => y.main - x.main).slice(0, 3);
  if (!arr.length) return '';
  return `<section class="dv-panel top3"><h2>${asOrig ? 'Commonly compared alternatives' : 'Commonly compared to'}</h2><div class="top3-g">${arr.map((q) => { const o = BY[q.with]; const href = asOrig ? pairSlug(f, o) : pairSlug(o, f); return `<a class="top3-c" href="/compare/${href}/"><span class="top3-i">${pic(o, 'loading="lazy" decoding="async"')}</span><span class="top3-n">${esc(o.full)}</span><b class="top3-p">${q.rep != null ? '~' : ''}${q.main}%</b></a>`; }).join('')}</div></section>`;
};
const pyramid = (f) =>
  f.flat.length
    ? `<div class="hh-tags">${f.flat.map((n) => `<span class="hh-tag">${esc(n)}</span>`).join('')}</div>`
    : [['Top notes', f.top], ['Heart notes', f.heart], ['Base notes', f.base]].filter(([, a]) => a.length).map(([k, a]) => `<h3 class="nl">${k}</h3><div class="hh-tags">${a.map((n) => `<span class="hh-tag">${esc(n)}</span>`).join('')}</div>`).join('');
for (const f of F) {
  const p = pairOf(f);
  const other = p ? BY[p.with] : null;
  const body = `<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/database/">Database</a> / <a href="${esc(houseHref(f.brand))}">${esc(f.brand)}</a> / ${esc(f.name)}</nav>
<div class="dv">
<aside class="dv-side">
  <h1 class="hh-title">${nameLink(f)}</h1>
  ${carousel(f)}
  ${buyBtn(f, 'hh-buy dv-buy')}
  <a class="btn dv-cmp" href="/compare/?a=${f.slug}">Compare with another fragrance</a>
  <div class="dv-box">${kv([['Type', roleLabel(f)], ['Released', f.year ? String(f.year) : ''], ['Concentration', f.concentration], ['Gender', f.gender], ['Size', f.size], ['Price tier', f.tier + ' (approx.)'], ...(f.price ? [['Price', priceTxt(f.price) + ' (' + priceNote(f.price) + ')']] : [])])}</div>
  ${similarList(f) ? `<h2 class="dv-sim">${f.role === 'original' ? 'Commonly compared alternatives' : 'Commonly compared to'}</h2>${similarList(f)}` : ''}
</aside>
<div class="dv-main">
  ${topThree(f)}
  <section class="dv-panel"><h2>Published notes</h2>${f.allNotes.length ? pyramid(f) : '<p class="meta">Not added yet.</p>'}<p class="hh-note">${f.source ? `${f.allNotes.length ? 'Notes as published by ' : 'Brand page: '}<a href="${esc(f.source.url)}" rel="noopener nofollow" target="_blank">${esc(f.source.name)}</a>. ` : ''}We have not tested this fragrance. ${esc(f.notesNote || 'Note lists differ between sources.')}</p></section>
  ${f.accords.length ? `<section class="dv-panel"><h2>Main accords (as listed)</h2><div class="hh-tags">${f.accords.map((t) => tagA('accord', t)).join('')}</div></section>` : ''}
  ${f.season.length ? `<section class="dv-panel"><h2>Season</h2><div class="hh-tags">${f.season.map((t) => tagA('season', t)).join('')}</div><p class="hh-note">Our editorial read of the published accords, not a test result.</p></section>` : ''}
  ${other ? `<section class="dv-panel"><h2>${p.asClone ? 'The original it is compared to' : 'Alternative people compare it to'}</h2><p><a href="/fragrance/${other.slug}/">${esc(other.full)}</a> ${p.main != null ? `· ${esc(mainTxt(p))}${p.rep == null && p.common.length ? ` (${esc(p.common.join(', '))})` : ''}` : ''}.</p><p class="hh-note">Pairing as described by <a href="${esc(p.source.url)}" rel="noopener nofollow" target="_blank">${esc(p.source.name)}</a>. ${p.rep != null ? 'The reported similarity is a community-style rating supplied to us. We have not tested either fragrance and it is not our measurement.' : 'The overlap is a rough comparison of two published note lists, not a measure of how alike they smell.'} <a href="/compare/${pairSlug(p.asClone ? other : f, p.asClone ? f : other)}/">Compare side by side</a>.</p></section>` : ''}
  <section class="dv-panel"><h2>Tags</h2><div class="hh-tags">${[tagA('brand', f.brand), f.gender && tagA('gender', f.gender), f.concentration && tagA('conc', f.concentration), tagA('tier', f.tier), tagA('role', roleLabel(f))].filter(Boolean).join('')}</div></section>
  ${disclosureBox}
</div>
</div>`;
  const product = { '@type': 'Product', name: f.full, brand: { '@type': 'Brand', name: f.brand }, description: `${f.full}${f.concentration ? ' ' + f.concentration : ''} for ${f.gender || 'everyone'}. Published notes: ${f.allNotes.join(', ')}.`, ...(f.img ? { image: `${cfg.domain}/img/f/${f.slug}/icon.webp` } : f.imageUrl ? { image: f.imageUrl } : {}) };
  delete product['@type']; const productLd = { ...product };
  write(`fragrance/${f.slug}`, page({ title: `${f.full}: Notes, Dupes and Alternatives | ${cfg.siteName}`, desc: `${f.full}${f.concentration ? ' ' + f.concentration : ''}: published notes (${f.allNotes.slice(0, 5).join(', ')}), ${other ? `commonly compared to ${other.full}, ` : ''}and where to find it on Amazon.`, url: `/fragrance/${f.slug}/`, body, product: productLd, image: f.img ? `/img/f/${f.slug}/icon.webp` : null, crumbs: [['Home', '/'], ['Database', '/database/'], [f.full, `/fragrance/${f.slug}/`]] }));
}

// ---- house pages ----
const houses = Object.keys(houseCount).filter((b) => houseCount[b] > 1).sort();
const houseRow = (f) => `<a class="hh-row" href="/fragrance/${f.slug}/"><span class="hh-rimg">${pic(f)}</span><span class="hh-rmain"><b>${esc(f.full)}</b><span class="hh-rtags">${[roleLabel(f), f.gender, f.concentration].filter(Boolean).map((t) => `<span class="hh-tag">${esc(t)}</span>`).join('')}</span></span><span class="hh-rside"><b>${esc(f.tier)}</b><span>${f.year || ''}</span></span></a>`;
for (const b of houses) {
  const list = F.filter((f) => f.brand === b);
  const body = `<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/database/">Database</a> / ${esc(b)}</nav>
<span class="pill">HOUSE</span><h1>${esc(b)} Fragrances</h1>
<p class="lead">${esc(b)} has ${list.length} fragrances in our database. Notes are as published by the sources named on each page, and we have not tested them.</p>
<p><a class="btn" href="/database/?brand=${encodeURIComponent(b)}">Filter ${esc(b)} in the database</a></p>
<div class="hh-list hh-preview brand-list">${list.map(houseRow).join('\n')}</div>
${disclosureBox}`;
  write(`house/${slugify(b)}`, page({ title: `${b} Fragrances: Notes and Dupes | ${cfg.siteName}`, desc: `Every ${b} fragrance in our dupes database, with published notes and Amazon links.`, url: `/house/${slugify(b)}/`, body, crumbs: [['Home', '/'], ['Database', '/database/'], [b, `/house/${slugify(b)}/`]] }));
}

// ---- compare pages ----
const cmpShell = (h1, extra, tabs = '') => `<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/database/">Database</a> / Comparison Tool</nav>
${tabs}<h1 id="cmp-h1" class="cmp-h1">${esc(h1)}</h1>
<div class="cmp-pickers">
<div class="cmp-pk"><label for="cmp-a">Compare</label><div class="cmp-sb"><input id="cmp-a" type="search" placeholder="Search" autocomplete="off" role="combobox" aria-expanded="true" aria-controls="cmp-a-list"><ul id="cmp-a-list" class="cmp-list" role="listbox" hidden></ul></div></div>
<button type="button" id="cmp-swap" class="cmp-swap" aria-label="Swap fragrances">&#8646;</button>
<div class="cmp-pk"><label for="cmp-b">With</label><div class="cmp-sb"><input id="cmp-b" type="search" placeholder="Search" autocomplete="off" role="combobox" aria-expanded="true" aria-controls="cmp-b-list"><ul id="cmp-b-list" class="cmp-list" role="listbox" hidden></ul></div></div>
</div>
${extra || ''}
<div id="cmp-out"></div>
<section id="cmp-sugg"><h2 class="cmp-sh">Suggestions<span></span></h2><div class="cmp-sgrid">${PAIRS.slice(0, 12).map((p) => `<a href="/compare/${pairSlug(BY[p.a], BY[p.b])}/" data-pair="${p.a},${p.b}"><span class="cmp-sicon">${bottle(BY[p.a])}</span><b>${esc(BY[p.a].full)} <i>vs.</i> ${esc(BY[p.b].full)}</b><span class="cmp-sicon">${bottle(BY[p.b])}</span></a>`).join('')}</div></section>
<p class="hh-note">Notes are as published by the sources named on each fragrance page, and we have not tested these fragrances. Notes overlap compares two published lists and is not a measure of how alike they smell.</p>
${disclosureBox}`;
const cmpScripts = (init) => `${dataScript}<script id="cmp-init" type="application/json">${JSON.stringify(init)}</script><script src="/compare.js" defer></script>`;
const cloneTabs = (a, b) => {
  const ps = (a.pairs || []);
  if (ps.length < 2) return '';
  return `<nav class="ctabs" aria-label="Other clones of ${esc(a.full)}"><span class="ctabs-k">${ps.length} clones of ${esc(a.full)}</span><div class="ctabs-row">${ps.map((q) => `<a href="/compare/${pairSlug(a, BY[q.with])}/" title="${esc(BY[q.with].full)}"${q.with === b.slug ? ' class="on" aria-current="page"' : ''}>${esc(BY[q.with].name)}<small>${q.main == null ? '' : (q.rep != null ? '~' : '') + q.main + '%'}</small></a>`).join('')}</div></nav><script>(function(){var e=document.querySelector('.ctabs a.on'),r=document.querySelector('.ctabs-row');if(e&&r){var x=e.offsetLeft-r.offsetLeft;if(x+e.offsetWidth>r.clientWidth)r.scrollLeft=x-r.clientWidth/2+e.offsetWidth/2;}})();</script>`;
};
const staticTable = (a, b) => {
  const ov = overlap(a, b), pr = PAIRS.find((q) => q.a === a.slug && q.b === b.slug);
  const rows = [['Type', (f) => roleLabel(f)], ['Concentration', (f) => f.concentration || 'Not listed'], ['Gender', (f) => f.gender || 'Not listed'], ['Released', (f) => f.year || 'Not listed'], ['Approx. price tier', (f) => f.tier], ['Notes', (f) => f.allNotes.join(', ')]];
  return `<div id="cmp-static"><table class="cmp-table"><caption>${esc(a.full)} vs ${esc(b.full)} key facts</caption><thead><tr><th></th><th>${esc(a.full)}</th><th>${esc(b.full)}</th></tr></thead><tbody>${rows.map(([k, fn]) => `<tr><td>${esc(k)}</td><td>${esc(fn(a))}</td><td>${esc(fn(b))}</td></tr>`).join('')}${pr && pr.rep != null ? `<tr><td>Reported similarity</td><td colspan="2">~${pr.rep}% (as supplied to us, not our testing)</td></tr>` : ''}${a.nk.length && b.nk.length ? `<tr><td>Published notes in common</td><td colspan="2">${esc(ov.common.join(', ') || 'None found')} (${ov.pct}% overlap)</td></tr>` : ''}</tbody></table><p><a class="btn" href="${esc(amazonLink(a))}" target="_blank" rel="sponsored nofollow noopener">${esc(a.name)} on Amazon →</a> <a class="btn" href="${esc(amazonLink(b))}" target="_blank" rel="sponsored nofollow noopener">${esc(b.name)} on Amazon →</a></p></div>`;
};
write('compare', page({ title: `Compare Fragrances Side by Side | ${cfg.siteName}`, desc: `Pick any two of ${F.length} fragrances and compare published notes, concentration, gender, price tier and notes overlap side by side.`, url: '/compare/', wide: true, scripts: cmpScripts({}), body: cmpShell('Compare Fragrances'), crumbs: [['Home', '/'], ['Compare', '/compare/']] }));
for (const p of PAIRS) {
  const a = BY[p.a], b = BY[p.b];
  write(`compare/${pairSlug(a, b)}`, page({ title: `${a.full} vs ${b.full}: Notes Comparison | ${cfg.siteName}`, desc: `${a.full} vs ${b.full} compared side by side: ${p.main != null ? mainTxt(p) + ', ' : ''}concentration, gender and price tier.`, url: `/compare/${pairSlug(a, b)}/`, wide: true, scripts: cmpScripts({ a: a.slug, b: b.slug }), body: cmpShell(`${a.full} vs. ${b.full} Comparison`, staticTable(a, b), cloneTabs(a, b)), crumbs: [['Home', '/'], ['Compare', '/compare/'], [`${a.name} vs ${b.name}`, `/compare/${pairSlug(a, b)}/`]] }));
}

// ---- sitemap, robots, headers ----
const urls = ['/', ...posts.map((p) => `/${p.slug}/`), '/guides/', '/database/', ...F.map((f) => `/fragrance/${f.slug}/`), ...houses.map((b) => `/house/${slugify(b)}/`), '/compare/', ...PAIRS.map((p) => `/compare/${pairSlug(BY[p.a], BY[p.b])}/`), '/about/', '/affiliate-disclosure/', '/privacy/'];
fs.writeFileSync(path.join(out, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${cfg.domain}${u}</loc><lastmod>${published}</lastmod></url>`).join('\n')}\n</urlset>\n`);
fs.writeFileSync(path.join(out, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${cfg.domain}/sitemap.xml\n`);
fs.writeFileSync(path.join(out, '_headers'), `/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  X-Frame-Options: DENY\n`);
console.log(`Built ${urls.length} pages into ${out} (affiliate tag: ${cfg.amazonTag})`);
