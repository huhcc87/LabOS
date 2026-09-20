async function load() {
  const s = await chrome.storage.sync.get(['apiBase', 'apiToken', 'customVendors', 'crowdsource']);
  document.getElementById('apiBase').value = s.apiBase || 'http://localhost:8000/api';
  document.getElementById('apiToken').value = s.apiToken || '';
  const cs = document.getElementById('crowdsource');
  if (cs) {
    cs.checked = !!s.crowdsource;
    cs.addEventListener('change', () => chrome.storage.sync.set({ crowdsource: cs.checked }));
  }
  renderVendors(s.customVendors || []);
}

function renderVendors(list) {
  const el = document.getElementById('custom-vendor-list');
  el.innerHTML = '';
  if (list.length === 0) {
    el.innerHTML = '<div style="color:#64748b;font-size:12px;padding:8px;">No custom vendors yet — add one below.</div>';
    return;
  }
  for (const v of list) {
    const div = document.createElement('div');
    div.className = 'vendor-item';
    div.innerHTML = `
      <div style="font-weight:600;">${v.vendor || v.host}</div>
      <div style="font-size:11px;color:#94a3b8;">${v.host}</div>
      <button class="btn btn-ghost" data-host="${v.host}">Remove</button>
    `;
    el.appendChild(div);
  }
  el.querySelectorAll('button[data-host]').forEach(b => {
    b.addEventListener('click', async () => {
      const s = await chrome.storage.sync.get('customVendors');
      const next = (s.customVendors || []).filter(v => v.host !== b.dataset.host);
      await chrome.storage.sync.set({ customVendors: next });
      renderVendors(next);
    });
  });
}

document.getElementById('save-connection').addEventListener('click', async () => {
  const apiBase = document.getElementById('apiBase').value.trim();
  const apiToken = document.getElementById('apiToken').value.trim();
  await chrome.storage.sync.set({ apiBase, apiToken });
  const msg = document.getElementById('saved-msg');
  msg.textContent = '✓ Saved';
  setTimeout(() => msg.textContent = '', 1500);
});

document.getElementById('test-connection').addEventListener('click', async () => {
  const status = document.getElementById('connection-status');
  status.style.display = 'block';
  status.textContent = 'Testing…';
  status.className = 'status';
  chrome.runtime.sendMessage({ type: 'LABOS_TEST_CONNECTION' }, (r) => {
    if (r?.ok) {
      status.textContent = '✓ Connected — your LabOS API is reachable';
      status.className = 'status ok';
    } else {
      status.textContent = `✗ Could not reach LabOS API. ${r?.error || ('Status ' + (r?.status || 'unknown'))}. Check that LabOS is running and the URL is correct.`;
      status.className = 'status err';
    }
  });
});

document.getElementById('add-vendor').addEventListener('click', async () => {
  const host = document.getElementById('cv-host').value.trim().toLowerCase();
  const vendor = document.getElementById('cv-vendor').value.trim();
  if (!host) { alert('Hostname is required'); return; }
  const cfg = {
    host,
    vendor: vendor || host,
    nameSelector: document.getElementById('cv-name-sel').value.trim() || undefined,
    catalogSelector: document.getElementById('cv-catalog-sel').value.trim() || undefined,
    priceSelector: document.getElementById('cv-price-sel').value.trim() || undefined,
    sizeSelector: document.getElementById('cv-size-sel').value.trim() || undefined,
  };
  const s = await chrome.storage.sync.get('customVendors');
  const list = (s.customVendors || []).filter(v => v.host !== host);
  list.push(cfg);
  await chrome.storage.sync.set({ customVendors: list });
  renderVendors(list);
  // Clear form
  ['cv-host', 'cv-vendor', 'cv-name-sel', 'cv-catalog-sel', 'cv-price-sel', 'cv-size-sel'].forEach(id => {
    document.getElementById(id).value = '';
  });
  alert(`Added ${host}. NOTE: you'll need to grant permission for this site — Chrome will prompt the first time you visit it, or you can add the host to "host_permissions" in the manifest for a permanent grant.`);
});

load();
