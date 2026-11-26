// Universal "Add to LabOS" pill: a small button fixed at the bottom of the page on ANY website that looks like
// a reagent / chemical / lab-supply product page (or on every page if "Show on every site" is on in Options).
// Vendor-specific scripts keep their inline button; this one stays out of their way.
(function () {
  if (window.top !== window || window.__LABOS_UNIVERSAL__) return;
  window.__LABOS_UNIVERSAL__ = true;
  if (typeof scrapePage !== 'function' || !window.LabOS) return;

  const PILL_ID = 'labos-universal-pill';
  const host = location.hostname.replace(/^www\./, '');

  // Product-ish page: schema.org Product, a CAS number, or a catalog number next to a price / buy button.
  function looksLikeProduct() {
    for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
      if (/"@type"\s*:\s*\[?\s*"Product"/i.test(s.textContent || '')) return true;
    }
    const body = document.body ? document.body.innerText || '' : '';
    if (/\bCAS(?:\s*(?:No\.?|Number|#))?\s*[:#]?\s*\d{2,7}-\d{2}-\d\b/i.test(body)) return true;
    const hasCatalog = /\b(?:Cat(?:alog)?\.?\s*(?:No\.?|Number|#)|Item\s*(?:No\.?|#)|Product\s*(?:No\.?|Code|#)|SKU)\s*[:#]?\s*[A-Z0-9][\w./-]{2,}/i.test(body);
    const hasPrice = /\$\s*[\d,]+\.\d{2}/.test(body);
    const hasBuy = !!document.querySelector('.add-to-cart, button[class*="add-to-cart" i], button[class*="addToCart" i], [data-testid*="add-to-cart" i], button[name="add"], form[action*="cart" i] button[type="submit"]');
    return hasCatalog && (hasPrice || hasBuy);
  }

  async function settings() {
    return chrome.storage.sync.get(['alwaysShow', 'hiddenHosts', 'appUrl']);
  }

  function toProduct(r) {
    return {
      vendor: host,
      name: r.name,
      catalog: r.catalog,
      size: r.size,
      cas: r.cas,
      unitPrice: r.price,
      imageUrl: r.image,
      currency: 'USD',
      url: location.href,
      notes: 'Captured from the bottom "Add to LabOS" button — review fields in LabOS',
    };
  }

  function build() {
    const wrap = document.createElement('div');
    wrap.id = PILL_ID;
    wrap.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:2147483646;display:flex;align-items:center;gap:6px;font-family:ui-sans-serif,system-ui,sans-serif;';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.style.cssText = 'display:flex;align-items:center;gap:8px;padding:11px 18px;border:0;border-radius:999px;cursor:pointer;color:#fff;font-size:14px;font-weight:700;background:linear-gradient(135deg,#6366f1,#8b5cf6);box-shadow:0 6px 20px rgba(99,102,241,.45);';
    const logo = document.createElement('img');
    logo.src = chrome.runtime.getURL('icons/icon48.png');
    logo.width = 18; logo.height = 18; logo.style.borderRadius = '4px';
    const label = document.createElement('span');
    label.textContent = 'Add to LabOS';
    btn.append(logo, label);
    const close = document.createElement('button');
    close.type = 'button';
    close.title = 'Hide on this site';
    close.textContent = '×';
    close.style.cssText = 'width:26px;height:26px;border:0;border-radius:50%;cursor:pointer;background:rgba(15,23,42,.8);color:#fff;font-size:16px;line-height:1;';
    wrap.append(btn, close);

    const flash = (text, ms) => { label.textContent = text; setTimeout(() => { label.textContent = 'Add to LabOS'; btn.disabled = false; }, ms); };
    btn.addEventListener('click', () => {
      btn.disabled = true;
      label.textContent = 'Sending…';
      let product;
      try { product = toProduct(scrapePage()); } catch (e) { flash('Could not read page', 2500); return; }
      chrome.runtime.sendMessage({ type: 'LABOS_CAPTURE', product }, (r) => {
        const err = chrome.runtime.lastError && chrome.runtime.lastError.message;
        if (r && r.ok) {
          flash(r.synced === false ? '✓ Saved locally (not connected)' : '✓ Added to LabOS', 2500);
          if (r.synced === false) window.LabOS.showToast('Not sent to LabOS: ' + (r.syncError || 'not connected') + '. Open LabOS → Settings → Connect extension.', 'error');
          else window.LabOS.showToast('Added to LabOS reagent cart', 'success');
        } else {
          flash('✗ ' + (((r && r.error) || err || 'failed').slice(0, 40)), 3500);
        }
      });
    });
    close.addEventListener('click', async () => {
      const s = await settings();
      await chrome.storage.sync.set({ hiddenHosts: [...new Set([...(s.hiddenHosts || []), host])] });
      wrap.remove();
    });
    return wrap;
  }

  let timer;
  async function evaluate() {
    const s = await settings();
    const existing = document.getElementById(PILL_ID);
    const appHost = (() => { try { return new URL(s.appUrl || '').hostname; } catch (_) { return ''; } })();
    const skip = (s.hiddenHosts || []).includes(host) || host === appHost || host === 'lab-os-eight.vercel.app' || host === 'localhost';
    // A vendor script already put its own button on this page.
    const vendorBtn = document.querySelector('.labos-capture-btn');
    if (skip || vendorBtn || !(s.alwaysShow || looksLikeProduct())) { if (existing) existing.remove(); return; }
    if (!existing && document.body) document.body.appendChild(build());
  }
  const schedule = () => { clearTimeout(timer); timer = setTimeout(evaluate, 1200); };

  schedule();
  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) { lastUrl = location.href; schedule(); }
  }).observe(document, { subtree: true, childList: true });
})();
