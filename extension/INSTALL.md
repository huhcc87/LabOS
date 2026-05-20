# 🧪 Install the LabOS Reagent Capture extension

Capture reagents from **Sigma-Aldrich, Thermo Fisher, VWR, Fisher Scientific,
Bio-Rad, Abcam, NEB, IDT, R&D Systems, Cell Signaling, Qiagen, Santa Cruz,
Miltenyi, Eppendorf, Beckman, Promega, Takara** — and any other vendor you
configure — and route them straight to LabOS for centralized purchasing.

---

## 📦 Folder you'll need

The extension lives at **`<your-labos-folder>/extension/`** and contains:

```
extension/
├── manifest.json              ← Chrome / Edge / Brave / Opera (MV3)
├── manifest.firefox.json      ← Firefox 121+ (rename to manifest.json before loading)
├── background.js              ← service worker
├── popup.html / popup.js      ← toolbar popup (cart preview)
├── options.html / options.js  ← settings (API URL, token, custom vendors)
├── content/                   ← 12 per-vendor adapters + shared helpers
└── icons/                     ← 16 / 48 / 128 px branding
```

---

## 🟢 Google Chrome (also Edge, Brave, Arc, Opera, Vivaldi)

All Chromium browsers use the same loading mechanism.

### Step-by-step

1. **Open the extensions page**
   - Chrome / Edge / Brave: paste `chrome://extensions` into the address bar
   - Edge alternative: `edge://extensions`
   - Brave alternative: `brave://extensions`
   - Opera: `opera://extensions`
   - Arc: ⚙ Settings → Extensions

2. **Toggle "Developer mode"** — switch at the top-right.

3. **Click "Load unpacked"** (top-left).

4. **Select the `extension/` folder** from your LabOS repo.
   On macOS, the path looks like:
   ```
   /Users/<you>/Documents/app/.../lab_management_system_v2/extension
   ```

5. **The 🧪 LabOS icon appears.** Click the puzzle 🧩 icon in the toolbar and
   pin "LabOS Reagent Capture" so it's always visible.

6. **First click** opens the popup. The empty state says
   *"No reagents captured yet"* — that's expected.

7. **Click the ⚙ gear** → opens Settings in a new tab.

### Configure the connection

In the Settings tab:

| Field | What to enter |
|---|---|
| **LabOS API base URL** | `http://localhost:8000/api` for local dev, or your deployed URL `https://api.labos.example.com/api` |
| **API token** | From LabOS → Settings → Tokens. Copy the bearer token. |

Click **Save**, then **Test connection** — green ✓ means good.

### Use it

Visit any product page on the supported vendors. The orange
**🧪 Add to LabOS** button appears next to the "Add to cart" button.
Click it → product flows into your LabOS Reagent Cart → ready for in-app
purchase.

---

## 🦊 Firefox (version 121+)

Firefox supports Manifest V3 but loads it slightly differently.

1. **Rename the manifest** (Firefox can't pick the right file by itself):
   ```bash
   cd extension/
   mv manifest.json manifest.chrome.json
   mv manifest.firefox.json manifest.json
   ```

2. **Open** `about:debugging#/runtime/this-firefox`

3. Click **"Load Temporary Add-on…"**

4. Pick **any file inside `extension/`** (e.g. `manifest.json`).

5. The extension loads. Pin it from the puzzle icon.

> ⚠️ Firefox unloads temporary extensions when you close the browser. For
> permanent install you'd publish to AMO (addons.mozilla.org). See below.

To switch back to Chrome later:
```bash
mv manifest.json manifest.firefox.json
mv manifest.chrome.json manifest.json
```

---

## 🍎 Safari

Safari needs the extension converted with Apple's tooling (one-time):

```bash
xcrun safari-web-extension-converter extension/
```

This creates an Xcode project. Open it, sign with your Apple Developer ID,
and run on macOS. Safari for iOS / iPadOS also supports the result.

---

## 📲 Mobile

- **Android — Kiwi Browser, Yandex, Edge**: support Chrome extensions. Open
  `chrome://extensions`, enable Developer mode, "Load" → select a `.zip`
  of the extension folder.
- **iOS / iPadOS**: only Safari extensions. Use the Safari conversion above.

---

## 📦 Distribute to your lab (Chrome Web Store)

For permanent install across your team's machines:

1. **Package the extension** — run `./package.sh` from the extension folder.
   Produces `labos-extension-1.0.0.zip` in the parent directory.

2. **Create a Chrome Web Store dev account** — one-time $5 fee at
   https://chrome.google.com/webstore/devconsole

3. **Upload the zip**, fill in screenshots and descriptions, submit for
   review. Reviews take 1–3 days.

4. **Use "Private — unlisted"** if you only want your lab to install it.

5. **Roll out via Google Workspace** — Admin → Devices → Chrome → Apps &
   Extensions → Force-install your extension org-wide.

---

## 🔍 Troubleshooting

| Problem | Fix |
|---|---|
| Orange button doesn't appear | Refresh the vendor page. If still missing, the vendor changed their HTML — open the extension Options → add a custom selector |
| "Failed to send to LabOS" toast | Open ⚙ → click "Test connection". If red, verify the API URL and that LabOS backend is running. CORS errors? Add the extension origin to `CORS_ORIGINS` in `backend/.env` |
| Extension keeps reloading | Chrome auto-reloads after file changes. Disable in `chrome://extensions` → Details if it's distracting |
| Popup shows old data | The popup polls every open. Click 🚀 Open LabOS Cart to see the source of truth |
| Items show "⏳ local" forever | Connection broken — check ⚙ Settings → Test connection |
| Voice add doesn't work | Browser must support Web Speech API (Chrome / Edge / Safari yes; Firefox no) |
| `Permission denied: cas-number` | Site changed selector — file an issue or add via Options → Custom vendors |

---

## 🔐 Security notes

- The extension **never** stores credit card numbers. Payment goes through
  Stripe in LabOS (PCI Level 1).
- Captured items are stored locally in `chrome.storage.local` (encrypted
  by the browser at-rest) and mirrored to your LabOS backend.
- API token is stored in `chrome.storage.sync` (synced across devices if
  you're signed into your browser).
- The extension only injects scripts on the 21 host_permissions listed in
  manifest.json — it does not read any other website.

---

## 🆘 Need help?

- Open the LabOS dashboard → 🛒 Reagent Cart — the install banner there has
  inline instructions.
- Check the extension Options page for connection diagnostics.
- File issues at your LabOS repo's Issues tab.
