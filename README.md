# Dupes Base

Static site for DupesBase.com: a searchable fragrance dupes database with Amazon affiliate links.
Same architecture as PixelPocketGuides: `node build.mjs` writes the finished site to `public/` (Node 18+, no dependencies). Pushes to `main` deploy through Cloudflare Workers (`wrangler.jsonc`, build `node build.mjs`, deploy `npx wrangler deploy`).

| File | What it controls |
|---|---|
| `config.json` | Site name, domain, **Amazon Associates tag** (`amazonTag`), contact email |
| `data/fragrances.json` | Every fragrance: notes, year, concentration, gender, price tier, source, `similarTo` pairing |
| `build.mjs` | All page templates, guides, database, compare, house pages, SEO and sitemap |
| `static/` | CSS, `dupes.js` (database), `compare.js`, `car.js` (carousel), icons |
| `tools/ingest.mjs` | Bulk-match Amazon links and image URLs from a text/CSV file |
| `tools/images.py` | Turn a folder or zip of photos into icon + carousel images |

## Before you publish

1. Set `amazonTag` in `config.json` (the build warns while it is still `YOURTAG-20`).
2. Set up the `hello@dupesbase.com` address (for example with Cloudflare Email Routing), or change `contactEmail`.
3. Connect the repo to Cloudflare Workers and add `dupesbase.com` as a custom domain.

## Rules this site follows

- No fake reviews, no invented notes, no claims of testing. Every fragrance has a `source` for its notes, and `notesNote` records where sources disagree.
- The "notes overlap %" is a Jaccard overlap of two published note lists (with a small synonym map in `build.mjs`). It is labeled everywhere as not a measure of smell similarity.
- Price is shown only as an approximate tier. Amazon limits showing prices that are not live, so buttons say "Check price on Amazon".
- Amazon is never scraped. Buttons are tagged search links until you supply direct links and image URLs.
- Amazon Associates disclosure is in the footer and a disclosure box on every page, plus `/affiliate-disclosure/` and `/privacy/`.

## Adding links and images in bulk

```
node tools/ingest.mjs links.txt          # lines like: Lattafa Khamrah https://link.amazon/xxxx https://m.media-amazon.com/images/I/xxxx.jpg
node tools/ingest.mjs links.txt --dry    # preview matches only
python3 tools/images.py photos.zip       # "Lattafa Khamrah.jpg" = main image, "Lattafa Khamrah 2.jpg" = extra photos
node build.mjs
```

Names are matched loosely, and `aliases` in `data/fragrances.json` (for example "CDNIM") help. Anything that does not match is listed so a new fragrance can be researched and added.

## Adding a fragrance

Add an object to `data/fragrances.json` with `top`/`heart`/`base` (or `flat`), a `source`, and for an alternative `similarTo` (the original's `name`) plus `pairSource`. Pair pages, compare pages, sitemap and the Pairs view are generated automatically.
