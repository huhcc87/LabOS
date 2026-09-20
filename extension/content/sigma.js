// Sigma-Aldrich / MilliporeSigma adapter
(function () {
  if (!window.LabOS) return;
  const { text, parsePrice, injectCaptureButton } = window.LabOS;

  function extract() {
    const name = text('h1[itemprop="name"]') || text('h1.MuiTypography-h2') || text('[data-testid="product-name"]') || text('h1');
    const catalog = text('[data-testid="product-number"]') || text('.product-number') || text('[itemprop="productID"]');
    const cas = text('[data-testid="cas-number"]') || text('.cas-number');
    const purity = text('[data-testid="purity"]');
    const sizeEl = document.querySelector('[data-testid="pack-size"], .pack-size, .price-package');
    const size = sizeEl ? sizeEl.textContent.trim() : '';
    const priceEl = document.querySelector('[data-testid="price"], .price, [itemprop="price"]');
    const unitPrice = priceEl ? parsePrice(priceEl.textContent) : null;
    const imageUrl = document.querySelector('img[data-testid="product-image"], img[itemprop="image"]')?.src;

    if (!name && !catalog) return null;
    return {
      vendor: 'Sigma-Aldrich',
      name, catalog, cas, purity, size, unitPrice,
      currency: 'USD',
      url: location.href,
      imageUrl,
    };
  }

  function tryInject() {
    const product = extract();
    if (!product) return;
    const anchor =
      document.querySelector('[data-testid="add-to-cart-button"]') ||
      document.querySelector('button[type="submit"][class*="cart"]') ||
      document.querySelector('h1');
    injectCaptureButton(product, anchor);
  }

  tryInject();
  // Re-run on SPA navigation
  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      setTimeout(tryInject, 800);
    }
  }).observe(document, { subtree: true, childList: true });
})();
