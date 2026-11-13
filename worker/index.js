// DupesBase Worker: static assets are served by Cloudflare before this runs.
// This script only handles /api/* requests: it records what visitors type into the
// site's search boxes (the words only, no IP address or other identifier) and shows a
// private report to the site owner.
import { DurableObject } from 'cloudflare:workers';

const MAX_LEN = 80;
const WHERE = new Set(['home', 'database', 'compare']);
const clean = (s) => String(s || '').normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase().slice(0, MAX_LEN);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export class SearchLog extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS searches (
      term TEXT NOT NULL, place TEXT NOT NULL, day TEXT NOT NULL,
      hits INTEGER NOT NULL DEFAULT 0, zero INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (term, place, day))`);
  }
  add(term, place, results) {
    const day = new Date().toISOString().slice(0, 10);
    this.sql.exec(`INSERT INTO searches (term, place, day, hits, zero) VALUES (?, ?, ?, 1, ?)
      ON CONFLICT (term, place, day) DO UPDATE SET hits = hits + 1, zero = zero + excluded.zero`, term, place, day, results === 0 ? 1 : 0);
  }
  report(days) {
    const since = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
    const top = this.sql.exec(`SELECT term, SUM(hits) AS hits, SUM(zero) AS zero, GROUP_CONCAT(DISTINCT place) AS places, MAX(day) AS last
      FROM searches WHERE day >= ? GROUP BY term ORDER BY hits DESC, last DESC LIMIT 500`, since).toArray();
    const daily = this.sql.exec(`SELECT day, SUM(hits) AS hits, COUNT(DISTINCT term) AS terms FROM searches WHERE day >= ? GROUP BY day ORDER BY day DESC`, since).toArray();
    return { since, top, daily };
  }
}

const stub = (env) => env.SEARCH_LOG.get(env.SEARCH_LOG.idFromName('global'));

function sameKey(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

function page(r, days) {
  const zeroes = r.top.filter((x) => x.zero > 0);
  const row = (x) => `<tr><td>${esc(x.term)}</td><td>${x.hits}</td><td>${x.zero}</td><td>${esc(x.places)}</td><td>${esc(x.last)}</td></tr>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Site searches | DupesBase</title>
<style>body{font:15px/1.5 system-ui,sans-serif;margin:0;padding:16px;background:#fff;color:#111;max-width:960px}h1{font-size:22px}table{border-collapse:collapse;width:100%;margin:8px 0 24px}th,td{text-align:left;padding:6px 8px;border-bottom:1px solid #e5e5e5;font-size:14px}th{background:#f6f6f6}small{color:#666}.wrap{overflow-x:auto}@media(prefers-color-scheme:dark){body{background:#111;color:#eee}th{background:#222}th,td{border-color:#333}small{color:#aaa}}</style></head><body>
<h1>What visitors searched for</h1>
<p><small>Last ${days} days (since ${esc(r.since)}). Words typed into the search boxes only; no IP addresses or visitor IDs are stored. "No results" means the search box showed nothing for that term. Change the period with &amp;days=7 or &amp;days=90.</small></p>
<h2>Searches with no results (${zeroes.length})</h2><p><small>Fragrances people looked for that the site could not show. These are the best candidates to add.</small></p>
<div class="wrap"><table><tr><th>Search</th><th>Times</th><th>No results</th><th>Where</th><th>Last</th></tr>${zeroes.map(row).join('') || '<tr><td colspan="5">None yet.</td></tr>'}</table></div>
<h2>All searches (${r.top.length})</h2>
<div class="wrap"><table><tr><th>Search</th><th>Times</th><th>No results</th><th>Where</th><th>Last</th></tr>${r.top.map(row).join('') || '<tr><td colspan="5">None yet.</td></tr>'}</table></div>
<h2>By day</h2>
<div class="wrap"><table><tr><th>Day</th><th>Searches</th><th>Different terms</th></tr>${r.daily.map((d) => `<tr><td>${esc(d.day)}</td><td>${d.hits}</td><td>${d.terms}</td></tr>`).join('') || '<tr><td colspan="3">None yet.</td></tr>'}</table></div>
</body></html>`;
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === '/api/search' && req.method === 'POST') {
      const origin = req.headers.get('origin') || '';
      if (origin && origin !== url.origin && !/^https:\/\/(www\.)?dupesbase\.com$/.test(origin)) return new Response(null, { status: 204 });
      let body = {};
      try { const t = await req.text(); if (t.length < 500) body = JSON.parse(t); } catch (e) {}
      const term = clean(body.q), place = WHERE.has(body.w) ? body.w : '';
      if (term.length >= 2 && place) {
        const n = Number.isFinite(body.n) ? body.n : -1;
        await stub(env).add(term, place, n);
      }
      return new Response(null, { status: 204 });
    }
    if (url.pathname === '/api/searches' && req.method === 'GET') {
      const key = env.REPORT_KEY || '';
      if (!key) return new Response('The search report is not switched on yet: add a REPORT_KEY secret to this Worker in Cloudflare.', { status: 503 });
      if (!sameKey(url.searchParams.get('key') || '', key)) return new Response('Not found', { status: 404 });
      const days = Math.min(Math.max(parseInt(url.searchParams.get('days') || '30', 10) || 30, 1), 365);
      const r = await stub(env).report(days);
      if (url.searchParams.get('format') === 'json') return Response.json(r, { headers: { 'cache-control': 'no-store' } });
      return new Response(page(r, days), { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' } });
    }
    return env.ASSETS.fetch(req);
  },
};
