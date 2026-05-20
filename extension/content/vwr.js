// VWR adapter
(function () {
  if (!window.LabOS) return;
  const { text, parsePrice, injectCaptureButton } = window.LabOS;

  function extract() {
    const name = text('.product-title, h1');
    const catalog = text('.catalog-number, [data-testid="catalog"]');
    const sizeEl = document.querySelector('.pack-size');
    const size = sizeEl ? sizeEl.textContent.trim() : '';
    const priceEl = document.querySelector('.price');
    const unitPrice = priceEl ? parsePrice(priceEl.textContent) : null;
    const imageUrl = document.querySelector('.product-image img')?.src;
    if (!name && !catalog) return null;
    return {
      vendor: 'VWR',
      name, catalog, size, unitPrice,
      currency: 'USD',
      url: location.href,
      imageUrl,
    };
  }

  function tryInject() {
    const product = extract();
    if (!product) return;
    const anchor =
      document.querySelector('.add-to-cart, button[class*="addToCart"], [data-testid="add-to-cart"]') ||
      document.querySelector('h1');
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
