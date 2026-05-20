async function loadCart() {
  return new Promise(r => chrome.runtime.sendMessage({ type: 'LABOS_CART_GET' }, res => r(res?.cart || [])));
}

async function testConnection() {
  return new Promise(r => chrome.runtime.sendMessage({ type: 'LABOS_TEST_CONNECTION' }, res => r(res || { ok: false })));
}

async function getSettings() {
  return new Promise(r => chrome.storage.sync.get(['apiBase'], s => r(s)));
}

function render(cart) {
  const list = document.getElementById('cart-list');
  document.getElementById('stat-count').textContent = String(cart.length);
  const total = cart.reduce((s, i) => s + (Number(i.unitPrice) || 0), 0);
  document.getElementById('stat-total').textContent = '$' + total.toFixed(2);
  const vendors = new Set(cart.map(i => i.vendor).filter(Boolean));
  document.getElementById('stat-vendors').textContent = String(vendors.size);

  if (cart.length === 0) {
    list.innerHTML = `<div class="empty"><div class="empty-icon">📦</div>No reagents captured yet.<br/><span style="font-size:11px;opacity:0.7;">Visit Sigma, Thermo, VWR, etc. and click the orange "Add to LabOS" button.</span></div>`;
    return;
  }
  list.innerHTML = '';
  for (const item of cart.slice().reverse()) {
    const div = document.createElement('div');
    div.className = 'item';
    div.innerHTML = `
      <img src="${item.imageUrl || ''}" onerror="this.style.display='none'" />
      <div class="item-info">
        <div class="item-name" title="${(item.name || '').replace(/"/g, '&quot;')}">${item.name || 'Untitled'}</div>
        <div class="item-meta">
          ${item.vendor ? `<span class="item-vendor">${item.vendor}</span>` : ''}
          ${item.catalog ? `<span>#${item.catalog}</span>` : ''}
          ${item.size ? `<span>${item.size}</span>` : ''}
          ${item.unitPrice != null ? `<span class="item-price">$${Number(item.unitPrice).toFixed(2)}</span>` : ''}
          <span class="sync-status ${item.synced ? 'synced' : 'pending'}">${item.synced ? '✓ synced' : '⏳ local'}</span>
        </div>
      </div>
      <button class="item-remove" data-id="${item.id}" title="Remove">×</button>
    `;
    list.appendChild(div);
  }
  list.querySelectorAll('.item-remove').forEach(b => {
    b.addEventListener('click', async () => {
      await new Promise(r => chrome.runtime.sendMessage({ type: 'LABOS_CART_REMOVE', id: b.dataset.id }, r));
      const cart = await loadCart();
      render(cart);
    });
  });
}

async function init() {
  const cart = await loadCart();
  render(cart);

  const conn = await testConnection();
  const row = document.getElementById('connection-row');
  const status = document.getElementById('connection-status');
  if (conn.ok) {
    row.textContent = '● Connected to LabOS — items auto-sync';
    row.className = 'connection ok';
    status.textContent = '● Connected to LabOS — items auto-sync';
  } else {
    row.textContent = '○ Not connected — items saved locally only. Set API URL in ⚙️';
    row.className = 'connection err';
    status.textContent = '○ Not connected — open ⚙️ to configure';
  }

  document.getElementById('open-options').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
  document.getElementById('open-labos').addEventListener('click', async () => {
    const s = await getSettings();
    const base = (s.apiBase || 'http://localhost:8000/api').replace('/api', '');
    chrome.tabs.create({ url: `${base}/?page=reagent-cart` });
  });
  document.getElementById('capture-page').addEventListener('click', async () => {
    // Works on ANY website — uses activeTab permission to grab tab metadata,
    // then runs a tiny content-script function to scrape h1 + price + image.
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url || tab.url.startsWith('chrome://')) {
      alert('Open the vendor product page in this tab first.');
      return;
    }
    let scraped = { name: tab.title || tab.url, price: null, image: '', catalog: '' };
    try {
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const text = (sel) => { const e = document.querySelector(sel); return e ? (e.textContent || '').trim() : ''; };
          // Try schema.org JSON-LD first
          for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
            try {
              const d = JSON.parse(s.textContent);
              const items = Array.isArray(d) ? d : [d];
              for (const it of items) {
                if ((it['@type'] || '').toString().includes('Product')) {
                  return {
                    name: it.name || document.title,
                    price: it.offers ? Number(String(it.offers.price || '').replace(/[^\d.]/g, '')) || null : null,
                    image: typeof it.image === 'string' ? it.image : (it.image && it.image[0]) || '',
                    catalog: it.sku || it.mpn || '',
                  };
                }
              }
            } catch (_) {}
          }
          // Fallback: guess
          const priceTxt = text('[itemprop="price"]') || text('.price') || text('.product-price') || '';
          return {
            name: text('h1') || document.title,
            price: priceTxt ? Number(priceTxt.replace(/[^\d.]/g, '')) || null : null,
            image: document.querySelector('img.product-image, img[itemprop="image"], img.product')?.src || '',
            catalog: text('[itemprop="sku"]') || text('.product-code') || text('.catalog-number') || '',
          };
        },
      });
      if (result) scraped = result;
    } catch (e) {
      // activeTab not granted (e.g. chrome:// page) — fall back to title
    }
    const product = {
      vendor: new URL(tab.url).hostname.replace(/^www\./, ''),
      name: scraped.name,
      catalog: scraped.catalog,
      unitPrice: scraped.price,
      imageUrl: scraped.image,
      currency: 'USD',
      url: tab.url,
      notes: 'Captured via "Capture this page" — review fields in LabOS',
    };
    chrome.runtime.sendMessage({ type: 'LABOS_CAPTURE', product }, async (r) => {
      if (r?.ok) {
        const cart = await loadCart();
        render(cart);
      } else {
        alert('Failed: ' + (r?.error || 'unknown'));
      }
    });
  });

  document.getElementById('voice-add').addEventListener('click', () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert('Voice capture requires Chrome / Edge / Safari.'); return; }
    const rec = new SR();
    rec.lang = 'en-US';
    rec.onresult = async (e) => {
      const t = e.results[0][0].transcript.replace(/^add\s+/i, '').trim();
      const product = {
        vendor: 'Voice capture',
        name: t,
        catalog: '',
        notes: `Voice: "${t}"`,
        currency: 'USD',
      };
      chrome.runtime.sendMessage({ type: 'LABOS_CAPTURE', product }, async () => {
        const c = await loadCart();
        render(c);
      });
    };
    rec.start();
  });
  document.getElementById('clear-all').addEventListener('click', async () => {
    if (!confirm('Clear all captured items?')) return;
    await new Promise(r => chrome.runtime.sendMessage({ type: 'LABOS_CART_CLEAR' }, r));
    const cart = await loadCart();
    render(cart);
  });
}

init();
