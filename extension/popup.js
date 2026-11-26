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

async function loadCart() {
  return new Promise(r => chrome.runtime.sendMessage({ type: 'LABOS_CART_GET' }, res => r(res?.cart || [])));
}

async function testConnection() {
  return new Promise(r => chrome.runtime.sendMessage({ type: 'LABOS_TEST_CONNECTION' }, res => r(res || { ok: false })));
}

// The hosted LabOS web app. A lab running its own copy sets its address in ⚙️ Settings.
const DEFAULT_APP_URL = 'https://lab-os-eight.vercel.app';

async function getSettings() {
  return new Promise(r => chrome.storage.sync.get(['apiBase', 'appUrl'], s => r(s)));
}

const appUrlOf = (s) => (s && /^https?:\/\//.test(s.appUrl || '') ? s.appUrl.replace(/\/+$/, '') : DEFAULT_APP_URL);

// Sanitize text to prevent XSS when inserting into DOM
function esc(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
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

    // Build image safely — only allow http/https URLs
    const imgSrc = (item.imageUrl && /^https?:\/\//.test(item.imageUrl)) ? esc(item.imageUrl) : '';

    div.innerHTML = `
      ${imgSrc ? `<img src="${imgSrc}" onerror="this.style.display='none'" />` : ''}
      <div class="item-info">
        <div class="item-name" title="${esc(item.name)}">${esc(item.name) || 'Untitled'}</div>
        <div class="item-meta">
          ${item.vendor ? `<span class="item-vendor">${esc(item.vendor)}</span>` : ''}
          ${item.catalog ? `<span>#${esc(item.catalog)}</span>` : ''}
          ${item.size ? `<span>${esc(item.size)}</span>` : ''}
          ${item.unitPrice != null ? `<span class="item-price">$${Number(item.unitPrice).toFixed(2)}</span>` : ''}
          <span class="sync-status ${item.synced ? 'synced' : 'pending'}">${item.synced ? '✓ synced' : '⏳ local'}</span>
        </div>
      </div>
      <button class="item-remove" data-id="${esc(item.id)}" title="Remove">×</button>
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
  // The link at the bottom always points at the app this extension is set up for.
  const settings = await getSettings();
  const appLink = document.getElementById('app-link');
  appLink.href = `${appUrlOf(settings)}/`;
  document.getElementById('app-link-host').textContent = new URL(appUrlOf(settings)).host;

  document.getElementById('open-labos').addEventListener('click', async () => {
    const s = await getSettings();
    chrome.tabs.create({ url: `${appUrlOf(s)}/?page=reagent-cart` });
  });
  document.getElementById('capture-page').addEventListener('click', async () => {
    // Works on ANY website — uses activeTab permission to grab tab metadata,
    // then runs a tiny content-script function to scrape h1 + price + image.
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url || !/^https?:/.test(tab.url)) {
      alert('Open the vendor product page in this tab first.');
      return;
    }
    let scraped = { name: tab.title || tab.url, price: null, image: '', catalog: '', size: '', cas: '' };
    try {
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: scrapePage,
      });
      if (result) scraped = result;
    } catch (e) {
      // activeTab not granted (e.g. chrome:// page) — fall back to title
    }
    const product = {
      vendor: new URL(tab.url).hostname.replace(/^www\./, ''),
      name: scraped.name,
      catalog: scraped.catalog,
      size: scraped.size,
      cas: scraped.cas,
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
