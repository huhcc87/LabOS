// Runs only on the LabOS web app. Lets Settings → "Connect extension" hand the new key straight to the
// extension so nobody has to copy and paste it. The page and extension talk through window messages.
(function () {
  const post = (msg) => window.postMessage({ source: 'labos-ext', ...msg }, location.origin);

  window.addEventListener('message', (e) => {
    // Same window and same origin only: a page frame or other site can't pair the extension.
    if (e.source !== window || e.origin !== location.origin) return;
    const d = e.data || {};
    if (d.source !== 'labos-app') return;
    if (d.type === 'LABOS_EXT_PING') { post({ type: 'LABOS_EXT_READY' }); return; }
    if (d.type === 'LABOS_EXT_PAIR') {
      chrome.runtime.sendMessage({ type: 'LABOS_PAIR', apiBase: d.apiBase, apiToken: d.key }, (r) => {
        post({ type: 'LABOS_EXT_PAIRED', ok: !!(r && r.ok), error: r && r.error });
      });
    }
  });

  post({ type: 'LABOS_EXT_READY' });
})();
