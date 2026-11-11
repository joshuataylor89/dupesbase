# Adding prices

`data/prices.json`: `"<Brand Name>": { "size": "3.4 oz / 100 ml", "quotes": [ { "amount": 99.99, "source": "Store", "date": "YYYY-MM-DD" } ] }`

- Size is written oz first, then ml. Use 3.4 oz / 100 ml, or the closest size listed (say so in `size`, add EDT/EDP if known).
- The site shows the average of all quotes for a fragrance. Add a second retailer's quote to an existing entry to average.
- Only record a price that was read on a retailer page and clearly matches the fragrance and size. No estimates, no out-of-stock-only or coupon-adjusted prices.
- Do not bulk-scrape. Read individual product pages (WebSearch to find them, WebFetch to read them).

# Adding bottle icons
Run `python3 tools/cutout.py <image> <slug>` (needs a white-background bottle photo). Use only images the owner supplied or openly licensed ones (for example Wikimedia Commons, with the licence noted in the commit). Do not copy Fragrantica, Amazon or retailer product photos. A fragrance with no usable image keeps the placeholder bottle.
