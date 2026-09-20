// Thermo Fisher / Invitrogen / Life Technologies adapter
(function () {
  if (!window.LabOS) return;
  const { text, parsePrice, injectCaptureButton } = window.LabOS;

  function extract() {
    const name = text('h1[itemprop="name"]') || text('.pdp-product-name') || text('h1');
    const catalog = text('.pdp-product-code .product-code') || text('[data-testid="catalog-number"]') || text('.product-code');
    const sizeEl = document.querySelector('.pdp-pack-size, [data-testid="pack-size"]');
    const size = sizeEl ? sizeEl.textContent.trim() : '';
    const priceEl = document.querySelector('.price-value, [data-testid="price"], .pdp-price');
    const unitPrice = priceEl ? parsePrice(priceEl.textContent) : null;
    const imageUrl = document.querySelector('.pdp-image img, img.product-image')?.src;

    if (!name && !catalog) return null;
    return {
      vendor: 'Thermo Fisher',
      name, catalog, size, unitPrice,
      currency: 'USD',
      url: location.href,
      imageUrl,
    };
  }

  function tryInject() {
    const product = extract();
    if (!product) return;
    const anchor = document.querySelector('.add-to-cart, [data-testid="add-to-cart"], button[class*="addToCart"]') || document.querySelector('h1');
    injectCaptureButton(product, anchor);
  }

  tryInject();
  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      setTimeout(tryInject, 800);
    }
  }).observe(document, { subtree: true, childList: true });
})();
