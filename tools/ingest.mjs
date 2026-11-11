// Bulk-match Amazon short links and image URLs to fragrances.
// Usage: node tools/ingest.mjs links.txt [more files...] [--dry]
// Accepts any text/CSV/TSV. Each line (or a name line followed by URL lines) may hold:
//   a fragrance name, an Amazon link (link.amazon/..., amzn.to/..., amazon.com/dp/ASIN) and/or an image URL.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = path.join(root, 'data/fragrances.json');
const F = JSON.parse(fs.readFileSync(file, 'utf8'));
const args = process.argv.slice(2), dry = args.includes('--dry'), inputs = args.filter((a) => !a.startsWith('--'));
if (!inputs.length) { console.error('Usage: node tools/ingest.mjs <file> [--dry]'); process.exit(1); }
const tok = (s) => s.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter((t) => t.length > 1 && !['the', 'eau', 'de', 'parfum', 'toilette', 'for', 'men', 'women', 'spray', 'oz', 'ml', 'edp', 'edt'].includes(t));
const isImg = (u) => /m\.media-amazon\.com\/images|\.(jpe?g|png|webp)(\?|$)/i.test(u);
const isLink = (u) => /link\.amazon|amzn\.to|amzn\.com|amazon\.[a-z.]+\//i.test(u) && !isImg(u);
function match(name) {
  const t = new Set(tok(name)); if (!t.size) return null;
  let best = null, bs = 0, tie = false;
  for (const f of F) {
    let sc = 0;
    for (const cand of [f.brand + ' ' + f.name, f.name, ...(f.aliases || [])]) {
      const ft = new Set(tok(cand)); const hit = [...t].filter((x) => ft.has(x)).length;
      sc = Math.max(sc, hit / Math.max(t.size, 1) * 0.7 + hit / Math.max(ft.size, 1) * 0.3);
    }
    if (sc > bs) { bs = sc; best = f; tie = false; } else if (sc === bs && sc > 0) tie = true;
  }
  return bs >= 0.55 && !tie ? best : null;
}
const entries = []; let last = null;
for (const f of inputs) for (const raw of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
  const urls = raw.match(/https?:\/\/[^\s,"'<>\t]+/g) || [];
  const name = raw.replace(/https?:\/\/[^\s,"'<>\t]+/g, ' ').replace(/[,\t|;"]+/g, ' ').replace(/^[\s\-*\d.)]+/, '').trim();
  if (name && tok(name).length) { last = { name, link: '', image: '', asin: '' }; entries.push(last); }
  if (!last) continue;
  for (const u of urls) {
    if (isImg(u)) last.image = last.image || u;
    else if (isLink(u)) { last.link = last.link || u; const m = u.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/); if (m) last.asin = m[1]; }
  }
}
let ok = 0; const miss = [];
for (const e of entries) {
  if (!e.link && !e.image) continue;
  const f = match(e.name);
  if (!f) { miss.push(e.name); continue; }
  if (e.link) { f.link = e.link; if (e.asin) f.asin = e.asin; }
  if (e.image) f.imageUrl = e.image;
  ok++; console.log(`matched: "${e.name}" -> ${f.brand} ${f.name}${e.link ? ' [link]' : ''}${e.image ? ' [image]' : ''}`);
}
if (miss.length) console.log('\nNo fragrance matched (send these so I can research and add them):\n  - ' + miss.join('\n  - '));
if (!dry) fs.writeFileSync(file, JSON.stringify(F, null, 2) + '\n');
console.log(`\n${ok} matched, ${miss.length} unmatched${dry ? ' (dry run, nothing written)' : '. Run: node build.mjs'}`);
