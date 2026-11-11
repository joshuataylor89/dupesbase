# Adding prices

`data/prices.json`: `"<Brand Name>": { "size": "3.4 oz / 100 ml", "quotes": [ { "amount": 99.99, "source": "Store", "date": "YYYY-MM-DD" } ] }`

- Size is written oz first, then ml. Use 3.4 oz / 100 ml, or the closest size listed (say so in `size`, add EDT/EDP if known).
- The site shows the average of all quotes for a fragrance. Add a second retailer's quote to an existing entry to average.
- Only record a price that was read on a retailer page and clearly matches the fragrance and size. No estimates, no out-of-stock-only or coupon-adjusted prices.
- Do not bulk-scrape. Read individual product pages (WebSearch to find them, WebFetch to read them).

# Adding bottle icons
Run `python3 tools/cutout.py <image> <slug>` (needs a white-background bottle photo). Use only images the owner supplied or openly licensed ones (for example Wikimedia Commons, with the licence noted in the commit). Do not copy Fragrantica, Amazon or retailer product photos. A fragrance with no usable image keeps the placeholder bottle.

# Adding Amazon product links (extra task for every scheduled run)
Set `asin` on the fragrance in data/fragrances.json (the build makes `https://www.amazon.com/dp/<ASIN>?tag=<tag>`).
- Find ASINs with WebSearch restricted to `allowed_domains: ["amazon.com"]`, a query like "<Brand> <Name> <size>". Take only a result whose URL contains `/dp/<10-char ASIN>` and whose title clearly names the same brand, fragrance, concentration and about 100 ml / 3.4 oz.
- Skip: gift sets, bundles, testers, minis, hair mists, perfumed oils, a different edition, or a size far from 100 ml. If nothing clean turns up, leave `asin` empty (the button then opens an Amazon search).
- Amazon blocks automated browsing, so never open Amazon pages; use search results only. Do ~25 fragrances per run (originals first, then the most-compared clones) and report how many were set.
- Not verified: who sells the listing. Tell the user that.
