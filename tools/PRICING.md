# Adding prices

`data/prices.json`: `"<Brand Name>": { "size": "3.4 oz / 100 ml", "quotes": [ { "amount": 99.99, "source": "Store", "date": "YYYY-MM-DD" } ] }`

- Size is written oz first, then ml. Use 3.4 oz / 100 ml, or the closest size listed (say so in `size`, add EDT/EDP if known).
- The site shows the average of all quotes for a fragrance. Add a second retailer's quote to an existing entry to average.
- Only record a price that was read on a retailer page and clearly matches the fragrance and size. No estimates, no out-of-stock-only or coupon-adjusted prices.
- Do not bulk-scrape. Read individual product pages (WebSearch to find them, WebFetch to read them).
