// Thermo Fisher / Invitrogen / Life Technologies adapter
// thermofisher.com is a single-page app: the product renders AFTER document_idle and its class names change,
// so we poll until the page has a title, and fall back to the URL (/product/<catalog>) and visible labels.
(function () {
  if (!window.LabOS) return;
  const { text, parsePrice, injectCaptureButton } = window.LabOS;

  const match = (re) => { const m = (document.body.innerText || '').match(re); return m ? m[1].trim() : ''; };

  function extract() {
    const name = text('h1[itemprop="name"]') || text('.pdp-product-name') || text('h1');
    const catalog = text('.pdp-product-code .product-code') || text('[data-testid="catalog-number"]') || text('.product-code')
      || (location.pathname.match(/\/product\/([^/?#]+)/) || [])[1]
      || match(/Catalog number\s*([\w.-]+)/i);
    const sizeEl = document.querySelector('.pdp-pack-size, [data-testid="pack-size"]');
    const size = (sizeEl ? sizeEl.textContent.trim() : '') || match(/\b((?:Pack|Case|Box|Bag|Kit) of \d+)/i);
    const priceEl = document.querySelector('.price-value, [data-testid="price"], .pdp-price');
    const unitPrice = priceEl ? parsePrice(priceEl.textContent) : parsePrice(match(/Price \(USD\)\s*([\d,.]+)/i));
    const imageUrl = document.querySelector('.pdp-image img, img.product-image')?.src;

    if (!name && !catalog) return null;
    return {
      vendor: 'Thermo Fisher',
      name: name || catalog, catalog, size, unitPrice,
      currency: 'USD',
      url: location.href,
      imageUrl,
    };
  }

  function inject() {
    const product = extract();
    if (!product) return false;
    const anchor = document.querySelector('.add-to-cart, [data-testid="add-to-cart"], button[class*="addToCart"]') || document.querySelector('h1');
    injectCaptureButton(product, anchor);
    return true;
  }

  // Keep trying for ~20s so a slow-rendering page still gets its button.
  function start() {
    let tries = 0;
    const timer = setInterval(() => {
      if (inject() || ++tries > 40) clearInterval(timer);
    }, 500);
  }

  start();
  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      setTimeout(start, 800);
    }
  }).observe(document, { subtree: true, childList: true });
})();
