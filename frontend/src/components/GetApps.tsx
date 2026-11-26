import { useEffect, useState } from 'react';
import { Modal } from './Modal';

// The extension's page in the Chrome Web Store, and the build that ships with this app (public/get).
const CHROME_STORE_URL = 'https://chromewebstore.google.com/detail/plmbihhgajefchkkbekmfifhheamdpij';
const EXTENSION_ZIP = '/get/labos-extension.zip';

type InstallPrompt = Event & { prompt: () => Promise<void> };

const card: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 10, padding: 14, marginBottom: 12 };
const btn: React.CSSProperties = { display: 'inline-block', padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: 'none', cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)' };
const primary: React.CSSProperties = { ...btn, background: 'var(--accent)', color: '#fff', border: 'none' };

/** Footer link in the sidebar that opens a small "Get the extension and the app" window. */
export default function GetApps() {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);

  useEffect(() => {
    const onPrompt = (e: Event) => { e.preventDefault(); setPrompt(e as InstallPrompt); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  const installApp = async () => {
    if (!prompt) return;
    await prompt.prompt();
    setPrompt(null);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{ margin: '8px 12px', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--sidebar-border)', background: 'transparent', color: 'var(--text-soft)', fontSize: 12, cursor: 'pointer', textAlign: 'left' }}
      >
        ⬇ Get the extension &amp; app
      </button>

      <Modal isOpen={open} onClose={() => setOpen(false)} title="Get the LabOS extension and app" size="md">
        <div style={card}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Browser extension (Chrome, Edge, Brave)</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10 }}>
            Adds an "Add to LabOS" button on reagent and chemical product pages on any website. Items go to your Reagent Cart.
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            <a style={primary} href={CHROME_STORE_URL} target="_blank" rel="noopener noreferrer">Chrome Web Store</a>
            <a style={btn} href={EXTENSION_ZIP} download>Download latest (.zip)</a>
          </div>
          <ol style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>
            <li>For the .zip: unzip it, open <code>chrome://extensions</code>, turn on Developer mode, click Load unpacked and pick the folder.</li>
            <li>Then go to Admin → Users → Settings, find Browser extension key, and click Connect extension. You only do this once per browser.</li>
          </ol>
        </div>

        <div style={card}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>LabOS as an app (phone, tablet, desktop)</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10 }}>
            Install LabOS to your home screen or dock so it opens like an app.
          </div>
          {prompt && <button type="button" style={{ ...primary, marginBottom: 10 }} onClick={installApp}>Install LabOS</button>}
          <ul style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>
            <li><strong>iPhone / iPad (Safari):</strong> Share, then Add to Home Screen.</li>
            <li><strong>Android (Chrome):</strong> menu (⋮), then Install app.</li>
            <li><strong>Mac / Windows (Chrome, Edge):</strong> click the install icon in the address bar, or menu, then Install LabOS.</li>
          </ul>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          Phone browsers can't run the extension. On a phone, add products from the Shop &amp; Vendors page instead.
        </div>
      </Modal>
    </>
  );
}
