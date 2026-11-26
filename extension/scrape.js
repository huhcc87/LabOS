// Runs INSIDE the vendor page (via chrome.scripting.executeScript), so it must be self-contained.
// Order of trust: JSON-LD Product > meta/microdata > labelled text on the page > guesses.
function scrapePage() {
  const clean = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  const num = (v) => { const m = String(v == null ? '' : v).replace(/,/g, '').match(/\d+(?:\.\d+)?/); return m ? parseFloat(m[0]) : null; };
  const text = (sel) => { const e = document.querySelector(sel); return e ? clean(e.textContent) : ''; };
  const meta = (n) => clean(document.querySelector(`meta[property="${n}"], meta[name="${n}"], meta[itemprop="${n}"]`)?.content);
  const body = document.body ? document.body.innerText || '' : '';
  const out = { name: '', price: null, image: '', catalog: '', size: '', cas: '' };

  // 1. JSON-LD: handles arrays, @graph, and offers as object/array/AggregateOffer.
  const products = [];
  const walk = (n) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) return n.forEach(walk);
    if ([].concat(n['@type'] || []).some((t) => /Product/i.test(t))) products.push(n);
    if (n['@graph']) walk(n['@graph']);
  };
  for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
    try { walk(JSON.parse(s.textContent)); } catch (_) {}
  }
  const p = products[0];
  if (p) {
    const offer = [].concat(p.offers || [])[0] || {};
    const img = [].concat(p.image || [])[0];
    out.name = clean(p.name);
    out.catalog = clean(p.sku || p.mpn || p.productID);
    out.price = num(offer.price != null ? offer.price : offer.lowPrice);
    out.image = typeof img === 'string' ? img : (img && img.url) || '';
    out.cas = clean(p.casNumber);
  }

  // 2. Meta tags / microdata.
  out.name = out.name || meta('og:title') || text('[itemprop="name"]') || text('h1') || clean(document.title);
  out.image = out.image || meta('og:image') || document.querySelector('[itemprop="image"]')?.src || document.querySelector('img.product-image, img.product')?.src || '';
  if (out.price == null) out.price = num(meta('product:price:amount') || meta('price') || document.querySelector('[itemprop="price"]')?.getAttribute('content') || text('[itemprop="price"]'));
  out.catalog = out.catalog || text('[itemprop="sku"]') || text('[itemprop="mpn"]') || text('.product-code, .catalog-number, .sku, .item-number');

  // 3. Labelled text, e.g. "Cat. No.: A1234", "Item # 56789", "CAS 64-17-5", "Pack of 50", "Price: $12.50".
  out.catalog = out.catalog || (body.match(/\b(?:Cat(?:alog)?\.?\s*(?:No\.?|Number|#)|Item\s*(?:No\.?|Number|#)|Product\s*(?:No\.?|Number|Code|#)|Part\s*(?:No\.?|Number|#)|SKU|Ref(?:erence)?\.?)\s*[:#]?\s*([A-Z0-9][\w./-]{2,24})/i) || [])[1] || '';
  out.cas = out.cas || (body.match(/\bCAS(?:\s*(?:No\.?|Number|#))?\s*[:#]?\s*(\d{2,7}-\d{2}-\d)\b/i) || [])[1] || '';
  out.size = (body.match(/\b((?:Pack|Case|Box|Bag|Kit|Set)\s+of\s+\d+)\b/i) || [])[1]
    || (body.match(/\b(\d+(?:\.\d+)?\s?(?:mL|ml|L|µL|uL|mg|g|kg|µg|ug|mmol|mol|units?|rxns?|reactions?|tests?)\b)/) || [])[1] || '';
  if (out.price == null) {
    out.price = num(text('.price, .product-price, .price-value, [class*="price" i]'))
      || num((body.match(/(?:Price|Your price|List price)[^\d$]{0,20}\$?\s*([\d,]+\.\d{2})/i) || [])[1])
      || num((body.match(/\$\s*([\d,]+\.\d{2})/) || [])[1]);
  }

  // Catalog fallback: last URL path segment that looks like a catalog id.
  if (!out.catalog) {
    const seg = location.pathname.split('/').filter(Boolean).pop() || '';
    if (/\d/.test(seg) && seg.length <= 24 && !/\.(html?|php|aspx?)$/i.test(seg)) out.catalog = seg;
  }
  out.name = out.name.slice(0, 200);
  return out;
}
