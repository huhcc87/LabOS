/**
 * LabOS Reagent Capture — background service worker.
 *
 * Maintains a local cart of captured items in chrome.storage.local AND mirrors
 * them to the configured LabOS API. The local copy makes the popup snappy
 * and works offline; the backend copy is the source of truth for checkout.
 */

const DEFAULT_API_BASE = 'http://localhost:8000/api';

async function getSettings() {
  const s = await chrome.storage.sync.get([
    'apiBase', 'apiToken', 'autoSync', 'customVendors',
  ]);
  return {
    apiBase: s.apiBase || DEFAULT_API_BASE,
    apiToken: s.apiToken || '',
    autoSync: s.autoSync !== false,
    customVendors: s.customVendors || [],
  };
}

async function getCart() {
  const { cart } = await chrome.storage.local.get('cart');
  return cart || [];
}

async function setCart(cart) {
  await chrome.storage.local.set({ cart });
  await updateBadge(cart.length);
}

async function updateBadge(count) {
  try {
    await chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' });
    await chrome.action.setBadgeBackgroundColor({ color: '#6366f1' });
  } catch (_) {}
}

async function pushToLabOS(product) {
  const { apiBase, apiToken } = await getSettings();
  if (!apiBase) return { ok: true, mode: 'local-only' };

  try {
    const res = await fetch(`${apiBase}/reagent-cart`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiToken ? { Authorization: `Bearer ${apiToken}` } : {}),
      },
      body: JSON.stringify({
        vendor: product.vendor,
        name: product.name,
        catalog: product.catalog,
        size: product.size,
        unit_price: product.unitPrice,
        currency: product.currency || 'USD',
        url: product.url,
        image_url: product.imageUrl,
        cas: product.cas,
        purity: product.purity,
        notes: product.notes,
        captured_at: new Date().toISOString(),
      }),
    });
    if (!res.ok) return { ok: false, status: res.status, error: `HTTP ${res.status}` };
    const data = await res.json().catch(() => ({}));
    return { ok: true, serverId: data.id };
  } catch (e) {
    return { ok: false, error: e.message || 'Network error' };
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    if (msg.type === 'LABOS_CAPTURE') {
      const cart = await getCart();
      const product = {
        ...msg.product,
        id: `${msg.product.vendor || 'unknown'}-${msg.product.catalog || Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        capturedAt: new Date().toISOString(),
        tabUrl: sender.tab && sender.tab.url,
        synced: false,
      };
      cart.push(product);
      await setCart(cart);

      // Try to sync to backend
      const sync = await pushToLabOS(product);
      if (sync.ok) {
        product.synced = true;
        product.serverId = sync.serverId;
        await setCart(cart);
      }

      sendResponse({ ok: true, cartSize: cart.length, synced: sync.ok });
      return;
    }

    if (msg.type === 'LABOS_CART_COUNT') {
      const cart = await getCart();
      sendResponse({ count: cart.length });
      return;
    }

    if (msg.type === 'LABOS_CART_GET') {
      const cart = await getCart();
      sendResponse({ cart });
      return;
    }

    if (msg.type === 'LABOS_CART_REMOVE') {
      const cart = await getCart();
      const next = cart.filter(c => c.id !== msg.id);
      await setCart(next);
      sendResponse({ ok: true, cartSize: next.length });
      return;
    }

    if (msg.type === 'LABOS_CART_CLEAR') {
      await setCart([]);
      sendResponse({ ok: true });
      return;
    }

    if (msg.type === 'LABOS_HAZARD_SCAN') {
      const { apiBase, apiToken } = await getSettings();
      if (!apiBase) { sendResponse({ matches: [] }); return; }
      const params = new URLSearchParams();
      if (msg.cas) params.set('cas', msg.cas);
      if (msg.name) params.set('name', msg.name);
      try {
        const r = await fetch(`${apiBase}/procurement/scan?${params}`, {
          headers: apiToken ? { Authorization: `Bearer ${apiToken}` } : {},
        });
        if (!r.ok) { sendResponse({ matches: [], blocked: false }); return; }
        const data = await r.json();
        sendResponse({ matches: data.matches || [], blocked: !!data.blocked });
      } catch { sendResponse({ matches: [], blocked: false }); }
      return;
    }

    if (msg.type === 'LABOS_INVENTORY_CHECK') {
      // Check the LabOS inventory for an existing match by CAS or catalog.
      const { apiBase, apiToken } = await getSettings();
      if (!apiBase) { sendResponse({ matches: [] }); return; }
      const q = encodeURIComponent(msg.cas || msg.catalog || msg.name || '');
      try {
        const r = await fetch(`${apiBase}/inventory?search=${q}&per_page=5`, {
          headers: apiToken ? { Authorization: `Bearer ${apiToken}` } : {},
        });
        if (!r.ok) { sendResponse({ matches: [] }); return; }
        const data = await r.json();
        const items = (data.items || []).filter((i) => {
          // Treat a match as: same CAS, OR same catalog, OR very close name
          const t = `${i.name || ''} ${i.catalog || ''} ${i.cas || ''}`.toLowerCase();
          if (msg.cas && t.includes(String(msg.cas).toLowerCase())) return true;
          if (msg.catalog && t.includes(String(msg.catalog).toLowerCase())) return true;
          return false;
        });
        sendResponse({ matches: items });
      } catch {
        sendResponse({ matches: [] });
      }
      return;
    }

    if (msg.type === 'LABOS_TEST_CONNECTION') {
      const { apiBase, apiToken } = await getSettings();
      try {
        const res = await fetch(`${apiBase}/reagent-cart/health`, {
          headers: apiToken ? { Authorization: `Bearer ${apiToken}` } : {},
        });
        sendResponse({ ok: res.ok, status: res.status });
      } catch (e) {
        sendResponse({ ok: false, error: e.message });
      }
      return;
    }
  })();
  return true; // keep channel open for async sendResponse
});

// Right-click context menu — capture current page link as a manual item
chrome.runtime.onInstalled.addListener(() => {
  try {
    chrome.contextMenus.create({
      id: 'labos-capture-page',
      title: 'Send page to LabOS reagent cart',
      contexts: ['page', 'link'],
    });
  } catch (_) {}
});

chrome.contextMenus && chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'labos-capture-page') return;
  const product = {
    vendor: new URL(info.linkUrl || tab.url).hostname.replace('www.', ''),
    name: tab.title || info.linkUrl || tab.url,
    url: info.linkUrl || tab.url,
    catalog: null,
    size: null,
    unitPrice: null,
    notes: 'Captured manually via right-click',
  };
  const cart = await getCart();
  cart.push({ ...product, id: `manual-${Date.now()}`, capturedAt: new Date().toISOString(), synced: false });
  await setCart(cart);
  await pushToLabOS(product);
  try {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'Added to LabOS',
      message: `${product.name.slice(0, 60)}\n\nOpen the LabOS extension popup to review.`,
    });
  } catch (_) {}
});
