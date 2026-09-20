/**
 * LabOS Reagent Capture — shared helpers used by every vendor content script.
 *
 * Each vendor script implements a small "adapter" that extracts product
 * details (name, catalog #, size, price, etc.) from that vendor's DOM, then
 * calls window.LabOS.injectCaptureButton(product) to inject the orange
 * "Add to LabOS" button onto the product page.
 *
 * The user clicks the button → product gets sent to chrome.runtime → background
 * worker forwards it to the LabOS API. The popup shows everything captured so
 * far waiting for checkout.
 */
(function () {
  if (window.__LABOS_SHARED__) return;
  window.__LABOS_SHARED__ = true;

  const BRAND = '#6366f1';

  function ensureStyles() {
    if (document.getElementById('labos-capture-styles')) return;
    const style = document.createElement('style');
    style.id = 'labos-capture-styles';
    style.textContent = `
      .labos-capture-btn {
        position: relative; display: inline-flex; align-items: center; gap: 8px;
        padding: 10px 18px; border-radius: 10px; border: none; cursor: pointer;
        background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff;
        font-size: 14px; font-weight: 700;
        box-shadow: 0 4px 12px rgba(99,102,241,0.35);
        z-index: 999998; font-family: ui-sans-serif, system-ui, sans-serif;
      }
      .labos-capture-btn:hover { filter: brightness(1.08); transform: translateY(-1px); }
      .labos-capture-btn[data-state="added"] { background: linear-gradient(135deg, #22c55e, #16a34a); }
      .labos-capture-btn[data-state="error"] { background: linear-gradient(135deg, #ef4444, #dc2626); }
      .labos-floating {
        position: fixed; bottom: 28px; right: 28px; z-index: 999999;
      }
      .labos-badge {
        position: absolute; top: -6px; right: -6px;
        min-width: 18px; height: 18px; border-radius: 9px; background: #fbbf24;
        color: #0f172a; font-size: 11px; font-weight: 700;
        display: flex; align-items: center; justify-content: center; padding: 0 4px;
      }
      .labos-toast {
        position: fixed; bottom: 90px; right: 28px; z-index: 999999;
        padding: 12px 18px; border-radius: 10px; color: #fff; font-size: 13px;
        font-family: ui-sans-serif, system-ui, sans-serif;
        background: #1e293b; box-shadow: 0 8px 24px rgba(0,0,0,0.3);
        opacity: 0; transition: opacity 0.2s, transform 0.2s; transform: translateY(8px);
      }
      .labos-toast[data-show="1"] { opacity: 1; transform: translateY(0); }
      .labos-toast[data-kind="success"] { background: #16a34a; }
      .labos-toast[data-kind="error"]   { background: #dc2626; }
    `;
    document.head.appendChild(style);
  }

  function showToast(msg, kind) {
    ensureStyles();
    const el = document.createElement('div');
    el.className = 'labos-toast';
    el.dataset.kind = kind || 'info';
    el.textContent = msg;
    document.body.appendChild(el);
    requestAnimationFrame(() => { el.dataset.show = '1'; });
    setTimeout(() => {
      el.dataset.show = '0';
      setTimeout(() => el.remove(), 250);
    }, 2200);
  }

  // F4: SDS extraction — find a Safety Data Sheet link on the page
  function findSdsUrl() {
    const links = [...document.querySelectorAll('a')];
    const candidate = links.find(a => {
      const t = (a.textContent || '').toLowerCase();
      const h = (a.href || '').toLowerCase();
      return /sds|msds|safety data sheet/i.test(t) || /sds|msds/.test(h) || /\.pdf$/.test(h) && /safety|sds|msds/.test(h);
    });
    return candidate ? candidate.href : '';
  }

  // F4: Hazard codes (GHS pictogram alt text or text mentions)
  function findHazardCodes() {
    const codes = new Set();
    const txt = document.body.innerText || '';
    // Look for GHS H-codes like H315, H335, H351
    const matches = txt.match(/\bH\d{3}\b/g) || [];
    matches.forEach(m => codes.add(m));
    // Common keywords → category
    const lower = txt.toLowerCase();
    if (/carcinogen|cancer/i.test(lower)) codes.add('carcinogen');
    if (/teratogen|reproductive toxicity/i.test(lower)) codes.add('teratogen');
    if (/flammable/i.test(lower)) codes.add('flammable');
    if (/corrosive/i.test(lower)) codes.add('corrosive');
    if (/toxic/i.test(lower) && !/non-?toxic/i.test(lower)) codes.add('toxic');
    return [...codes].slice(0, 10);
  }

  function captureProduct(product) {
    // F4: enrich with SDS + hazards before sending
    if (!product.sdsUrl) product.sdsUrl = findSdsUrl();
    if (!product.hazards) product.hazards = findHazardCodes();
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'LABOS_CAPTURE', product }, (response) => {
        resolve(response || { ok: false, error: 'no response' });
      });
    });
  }

  function injectCaptureButton(product, anchor) {
    ensureStyles();
    if (document.querySelector(`[data-labos-id="${product.catalog || product.url}"]`)) return;

    const btn = document.createElement('button');
    btn.className = 'labos-capture-btn';
    btn.dataset.labosId = product.catalog || product.url;
    btn.innerHTML = `<span style="font-size:16px;">🧪</span> Add to LabOS<span class="labos-badge" data-labos-badge>?</span>`;

    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      btn.disabled = true;
      const original = btn.innerHTML;
      btn.innerHTML = '<span>⏳</span> Sending…';
      const res = await captureProduct(product);
      if (res.ok) {
        btn.dataset.state = 'added';
        btn.innerHTML = `<span>✓</span> Added to LabOS (cart: ${res.cartSize || '?'})`;
        showToast('Added to LabOS reagent cart', 'success');
      } else {
        btn.dataset.state = 'error';
        btn.innerHTML = `<span>✗</span> Failed — check extension settings`;
        showToast(res.error || 'Failed to send to LabOS', 'error');
      }
      setTimeout(() => {
        btn.disabled = false;
        btn.removeAttribute('data-state');
        btn.innerHTML = original;
        updateBadge();
      }, 2500);
    });

    // Insert badge with cart count
    chrome.runtime.sendMessage({ type: 'LABOS_CART_COUNT' }, (r) => {
      const badge = btn.querySelector('[data-labos-badge]');
      if (badge && r && typeof r.count === 'number') badge.textContent = String(r.count);
      else if (badge) badge.remove();
    });

    // Inventory cross-check: if lab already has this reagent, show a yellow warning hint
    chrome.runtime.sendMessage({
      type: 'LABOS_INVENTORY_CHECK',
      cas: product.cas,
      catalog: product.catalog,
      name: product.name,
    }, (r) => {
      if (r && r.matches && r.matches.length > 0) {
        const hint = document.createElement('div');
        hint.style.cssText = `
          margin-top: 8px; padding: 8px 12px; border-radius: 8px;
          background: rgba(234,179,8,0.15); color: #ca8a04; font-size: 12px;
          font-family: ui-sans-serif, system-ui, sans-serif; max-width: 280px;
          border: 1px solid rgba(234,179,8,0.35);
        `;
        const sample = r.matches[0];
        hint.innerHTML = `
          <strong>⚠ Already in your inventory</strong><br>
          ${(sample.name || 'Match').slice(0, 60)} · qty ${sample.quantity ?? '?'}
          ${r.matches.length > 1 ? `<br><em>+${r.matches.length - 1} more match${r.matches.length > 2 ? 'es' : ''}</em>` : ''}
        `;
        if (btn.parentNode) btn.parentNode.insertBefore(hint, btn.nextSibling);
      }
    });

    // F5: Restricted chemical scan
    chrome.runtime.sendMessage({
      type: 'LABOS_HAZARD_SCAN',
      cas: product.cas,
      name: product.name,
    }, (r) => {
      if (r && r.matches && r.matches.length > 0) {
        const blocked = r.blocked;
        const hint = document.createElement('div');
        hint.style.cssText = `
          margin-top: 8px; padding: 8px 12px; border-radius: 8px;
          background: ${blocked ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)'};
          color: ${blocked ? '#dc2626' : '#d97706'}; font-size: 12px;
          font-family: ui-sans-serif, system-ui, sans-serif; max-width: 280px;
          border: 1px solid ${blocked ? 'rgba(239,68,68,0.35)' : 'rgba(245,158,11,0.35)'};
        `;
        const m = r.matches[0];
        hint.innerHTML = `
          <strong>${blocked ? '⛔ BLOCKED — restricted chemical' : '☣ Hazard alert'}</strong><br>
          ${m.name} · ${m.category}
          ${m.notes ? `<br><em>${m.notes}</em>` : ''}
        `;
        if (btn.parentNode) btn.parentNode.insertBefore(hint, btn.nextSibling);
        if (blocked) btn.disabled = true;
      }
    });

    if (anchor && anchor.parentNode) {
      anchor.parentNode.insertBefore(btn, anchor.nextSibling);
    } else {
      // Fallback: floating bottom-right
      btn.classList.add('labos-floating');
      document.body.appendChild(btn);
    }

    return btn;
  }

  function updateBadge() {
    chrome.runtime.sendMessage({ type: 'LABOS_CART_COUNT' }, (r) => {
      document.querySelectorAll('[data-labos-badge]').forEach(b => {
        if (r && typeof r.count === 'number') b.textContent = String(r.count);
      });
    });
  }

  function text(sel, root) {
    const el = (root || document).querySelector(sel);
    return el ? (el.textContent || '').trim() : '';
  }

  function attr(sel, name, root) {
    const el = (root || document).querySelector(sel);
    return el ? el.getAttribute(name) || '' : '';
  }

  function parsePrice(raw) {
    if (!raw) return null;
    const m = String(raw).replace(/,/g, '').match(/[\d.]+/);
    return m ? parseFloat(m[0]) : null;
  }

  function vendorFromHost() {
    const h = location.hostname.replace(/^www\./, '').replace(/\.(com|org|net)$/, '');
    return h.split('.').slice(-1)[0];
  }

  // Public API
  window.LabOS = {
    injectCaptureButton,
    showToast,
    text,
    attr,
    parsePrice,
    vendorFromHost,
  };
})();
