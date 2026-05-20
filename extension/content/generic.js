// Generic adapter — Santa Cruz, Miltenyi, Eppendorf, Beckman, Promega, Takara
// Plus any custom vendor configured in extension Options.
//
// Strategy: prefer schema.org product microdata, fall back to common selectors.
(function () {
  if (!window.LabOS) return;
  const { text, parsePrice, injectCaptureButton, vendorFromHost } = window.LabOS;

  function applyCustomConfig() {
    chrome.storage.sync.get('customVendors', ({ customVendors }) => {
      const host = location.hostname.replace(/^www\./, '');
      const match = (customVendors || []).find(v => host.endsWith(v.host));
      run(match);
    });
  }

  function extract(cfg) {
    // 1. Try JSON-LD Product schema first
    const jsonLd = [...document.querySelectorAll('script[type="application/ld+json"]')];
    for (const s of jsonLd) {
      try {
        const data = JSON.parse(s.textContent);
        const items = Array.isArray(data) ? data : [data];
        for (const item of items) {
          if (item['@type'] === 'Product' || item['@type']?.includes('Product')) {
            return {
              vendor: cfg?.vendor || item.brand?.name || vendorFromHost(),
              name: item.name,
              catalog: item.sku || item.mpn,
              size: item.weight || item.size,
              unitPrice: parsePrice(item.offers?.price),
              currency: item.offers?.priceCurrency || 'USD',
              url: location.href,
              imageUrl: typeof item.image === 'string' ? item.image : item.image?.[0],
            };
          }
        }
      } catch (_) {}
    }

    // 2. Microdata fallback
    const itemScope = document.querySelector('[itemscope][itemtype*="Product"]');
    const root = itemScope || document;
    const name = text('[itemprop="name"]', root) || (cfg?.nameSelector ? text(cfg.nameSelector) : '') || text('h1');
    const catalog = text('[itemprop="sku"]', root) || (cfg?.catalogSelector ? text(cfg.catalogSelector) : '') || text('.product-code, .catalog-number, .sku');
    const priceEl = root.querySelector('[itemprop="price"]') || (cfg?.priceSelector ? document.querySelector(cfg.priceSelector) : null) || document.querySelector('.price, .product-price');
    const unitPrice = priceEl ? parsePrice(priceEl.getAttribute('content') || priceEl.textContent) : null;
    const sizeEl = (cfg?.sizeSelector ? document.querySelector(cfg.sizeSelector) : null) || document.querySelector('.pack-size, .size');
    const size = sizeEl ? sizeEl.textContent.trim() : '';
    const imageUrl = (root.querySelector('[itemprop="image"]') || document.querySelector('img.product-image, img'))?.src;

    if (!name && !catalog) return null;
    return {
      vendor: cfg?.vendor || vendorFromHost(),
      name, catalog, size, unitPrice,
      currency: 'USD',
      url: location.href,
      imageUrl,
    };
  }

  function run(cfg) {
    const product = extract(cfg);
    if (!product) return;
    const anchor = document.querySelector(
      cfg?.anchorSelector || '.add-to-cart, button[class*="addToCart"], [data-testid="add-to-cart"], h1'
    ) || document.querySelector('h1');
    injectCaptureButton(product, anchor);
  }

  applyCustomConfig();
  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      setTimeout(applyCustomConfig, 800);
    }
  }).observe(document, { subtree: true, childList: true });
})();
