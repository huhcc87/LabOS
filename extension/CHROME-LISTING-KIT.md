# 📋 Chrome Web Store Listing — Paste-Ready Kit

Everything you need to fill in the listing form, in the exact order Chrome
asks for it. Copy each block, paste into the matching field, save draft.

---

## 📁 Where the asset files are

```
/Users/mudasirrashid/Documents/app/lab_management_system_v2/dist-extension/store-assets/
├── screenshot-1-hero.png            1280×800   ← Screenshots section, slot 1
├── screenshot-2-button.png          1280×800   ← Screenshots section, slot 2
├── screenshot-3-cart.png            1280×800   ← Screenshots section, slot 3
├── screenshot-4-procurement.png     1280×800   ← Screenshots section, slot 4
├── screenshot-5-settings.png        1280×800   ← Screenshots section, slot 5
├── promo-small-440x280.png          440×280    ← Small promo tile
└── promo-marquee-1400x560.png       1400×560   ← Marquee promo tile

/Users/mudasirrashid/Documents/app/lab_management_system_v2/extension/icons/
└── icon128.png                      128×128    ← Store icon
```

---

## 🟦 Section 1 — Product details

### Title (from package — already set)
> LabOS Reagent Capture

### Summary (from package — already set, 95/132 chars)
> Capture reagents from any biomedical vendor and route them to LabOS for centralized purchasing.

### Description (paste this — 16,000 char field)

```
LabOS Reagent Capture turns any biomedical vendor's website into a one-click extension of your LabOS account. Capture reagents, chemicals, antibodies, kits, and consumables with the orange "Add to LabOS" button — they flow straight into your Reagent Cart for in-app purchasing.

━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHAT IT DOES

✓ Inject an "Add to LabOS" button on every product page across 20+ biomedical vendors
✓ Auto-detect product name, catalog number, CAS, price, image, and pack size
✓ Cross-check against your existing LabOS inventory — warn before duplicate orders
✓ Pull Safety Data Sheet (SDS) links and GHS hazard codes automatically
✓ Scan against your institution's restricted-chemicals list — warn or block
✓ Send everything to your configured LabOS instance for review and approval
✓ Works offline too — items sync to LabOS once you're back online

━━━━━━━━━━━━━━━━━━━━━━━━━━━
PRE-SUPPORTED VENDORS (work out of the box, zero config)

• Sigma-Aldrich
• MilliporeSigma
• Thermo Fisher Scientific
• Invitrogen
• Life Technologies
• Fisher Scientific
• VWR
• Bio-Rad Laboratories
• Abcam
• New England Biolabs (NEB)
• Integrated DNA Technologies (IDT)
• R&D Systems
• Cell Signaling Technology
• Qiagen
• Santa Cruz Biotechnology
• Miltenyi Biotec
• Eppendorf
• Beckman Coulter
• Promega
• Takara Bio

━━━━━━━━━━━━━━━━━━━━━━━━━━━
WORKS ON ANY OTHER VENDOR TOO

Three ways to capture from a vendor that isn't pre-tuned:

1. Schema.org auto-detection — most modern catalogs publish Product microdata that the extension reads automatically. Just visit the page and click Add to LabOS.

2. Custom vendor configuration — Options page lets you add any hostname plus optional CSS selectors. Takes ~30 seconds per vendor.

3. "Capture this page" button — works on literally any URL. Opens the extension popup, click the button, and the page's title + price + image are sent to LabOS for manual review.

━━━━━━━━━━━━━━━━━━━━━━━━━━━
ADVANCED PROCUREMENT (when paired with a LabOS instance)

The extension is the capture endpoint for a complete procurement workflow inside LabOS:

• Cross-vendor price comparison — see who sells the same CAS cheapest
• Approval workflow — junior staff capture, PIs approve before checkout
• Budget guardrails — block orders that exceed your grant balance
• Group-buy detection — combine orders with neighboring labs for volume discounts
• Quote requests (RFQ) — auto-email vendor sales reps for high-value items
• Recurring orders — auto-reorder consumables every N days
• Lab-to-lab borrow — check whether another lab in your org has the reagent
• Receive-on-arrival — barcode-scan the delivery box, update inventory
• PunchOut OCI export — for institutions on SAP / Ariba / Workday Procurement
• Stripe checkout — pay with saved cards, never store CC numbers in LabOS

━━━━━━━━━━━━━━━━━━━━━━━━━━━
COMPLIANCE & SAFETY

• GHS hazard codes auto-extracted from product pages
• Cross-checked against your institution's restricted-chemicals list (DEA, biohazard, radioactive)
• SDS/MSDS links saved with every capture for audit trails
• Inventory cross-check prevents duplicate orders of hazardous materials
• Right-click "Send page to LabOS" for quotes or PDFs

━━━━━━━━━━━━━━━━━━━━━━━━━━━
PRIVACY

• Captured items stored locally (chrome.storage.local) and only synced to your configured LabOS endpoint
• API token stored in chrome.storage.sync (encrypted at rest by Chrome)
• Never collects browsing history, search history, or data from non-vendor pages
• Never sells or shares data with third parties
• Card payments are processed entirely by Stripe inside your LabOS instance — the extension never sees card numbers
• Open source — review every line at github.com/labos (replace with your actual URL)

━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHO IT'S FOR

• Academic research labs running multiple grants
• Biotech R&D teams ordering from 5+ vendors
• Core facilities consolidating purchasing across multiple PIs
• Pharma labs requiring approval workflows and hazard control
• Anyone tired of copy-pasting catalog numbers into 4 different procurement systems

━━━━━━━━━━━━━━━━━━━━━━━━━━━
REQUIREMENTS

• A running LabOS instance (cloud or self-hosted)
• Your LabOS API token (Settings → Tokens in LabOS)
• Chrome 96+ / Edge 96+ / Brave 1.32+ / Opera 82+

━━━━━━━━━━━━━━━━━━━━━━━━━━━
HOW TO USE

1. Install this extension
2. Click the puzzle icon in your toolbar, pin "LabOS Reagent Capture"
3. Click the extension icon, then the gear ⚙ for Options
4. Paste your LabOS API URL and bearer token, click Save
5. Visit any product page on Sigma, Thermo, VWR, etc.
6. Click the orange "Add to LabOS" button next to the vendor's Add to cart
7. Open LabOS → Reagent Cart to review and check out

━━━━━━━━━━━━━━━━━━━━━━━━━━━
SUPPORT

Issues, feature requests, vendor support requests: huhcc87@gmail.com
LabOS documentation: refer to your LabOS instance's built-in help

LabOS Reagent Capture is the official browser extension companion for the LabOS lab management platform. Not affiliated with any vendor (Sigma-Aldrich, Thermo Fisher, etc.) — those names are trademarks of their respective owners and are used here only to describe site compatibility.
```

### Category
> **Productivity**

### Language
> **English (United States)**

---

## 🟦 Section 2 — Graphic assets

### Store icon (128×128)
Upload: `extension/icons/icon128.png`

(Already in the extension folder.)

### Global promo video (optional — skip)

Leave blank for now. You can add a YouTube demo URL later.

### Screenshots (at least 1, up to 5 — all 1280×800)

Upload in this order:

1. `dist-extension/store-assets/screenshot-1-hero.png` — Hero / popup overview
2. `dist-extension/store-assets/screenshot-2-button.png` — Orange button on Sigma product page
3. `dist-extension/store-assets/screenshot-3-cart.png` — LabOS Reagent Cart with captured items
4. `dist-extension/store-assets/screenshot-4-procurement.png` — Procurement Hub Budgets tab
5. `dist-extension/store-assets/screenshot-5-settings.png` — Settings + custom vendors

### Small promo tile (440×280)
Upload: `dist-extension/store-assets/promo-small-440x280.png`

### Marquee promo tile (1400×560)
Upload: `dist-extension/store-assets/promo-marquee-1400x560.png`

---

## 🟦 Section 3 — Additional fields

### Official URL
> **None** (leave default — unless you have a homepage you've verified via Google Search Console)

### Homepage URL
Leave blank, OR paste your LabOS demo URL if you have one. Example:
> `https://github.com/<your-org>/labos`

### Support URL
> `mailto:huhcc87@gmail.com`

Or paste a Google Form / GitHub Issues URL if you have one.

### Mature content
> **Off** (toggle stays off — extension is general-audience)

---

## 🟦 Section 4 — Privacy (in the left sidebar)

### Single purpose
Paste exactly:

```
The LabOS Reagent Capture extension has a single purpose: capture product information from biomedical vendor websites (Sigma-Aldrich, Thermo Fisher, VWR, and others listed in host_permissions) and forward that information to the user's configured LabOS instance for centralized purchasing and inventory management.
```

### Permission justifications

For each permission in your manifest, paste the matching line:

| Permission | Justification |
|---|---|
| `activeTab` | Required so the user can click the "Capture this page" button in the extension popup. The extension reads only the current tab the user explicitly opens. |
| `scripting` | Required to inject the "Add to LabOS" button onto recognized vendor product pages so the user can capture a product with one click. |
| `storage` | Required to save the user's LabOS API endpoint and bearer token, plus an offline mirror of captured items so the popup works without network. |
| `contextMenus` | Adds a right-click "Send page to LabOS reagent cart" menu item so users can capture vendor quote PDFs or non-product pages. |
| `notifications` | Shows a small system notification when a capture succeeds via the right-click menu, so the user has confirmation. |
| `host_permissions` (the 20+ vendor domains) | Required for the per-vendor content scripts to read product details (name, catalog number, price) from those specific vendor product pages only. The extension does NOT access any other website. |

### Data usage disclosure

Toggle ON and justify:

| Data type | Why we collect |
|---|---|
| **Authentication information** | The user's LabOS API bearer token is stored in chrome.storage.sync so the extension can authenticate with the user's LabOS instance. Never sent anywhere else. |
| **Website content** | The extension reads product name, catalog number, price, image URL, and pack size from vendor product pages (host_permissions only) — only when the user clicks "Add to LabOS". |

Toggle OFF:
- ✗ Personally identifiable information
- ✗ Health information
- ✗ Financial / payment information
- ✗ Location
- ✗ Web history
- ✗ Communication
- ✗ Personal communications

### Certifications (toggle these on)
- ✓ I do not sell or transfer user data to third parties, outside of the approved use cases
- ✓ I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- ✓ I do not use or transfer user data to determine creditworthiness or for lending purposes

### Privacy policy URL (REQUIRED)

You need a public URL. Easiest path:

1. Open https://gist.github.com (sign in with your GitHub account, or create one — free)
2. Click **New gist**
3. Name: `labos-extension-privacy-policy.md`
4. Paste the entire block below
5. Click **Create public gist**
6. Click **Raw** button (top-right of the file)
7. Copy that URL — paste it into Chrome's Privacy policy field

#### Privacy policy text to paste in the gist:

```markdown
# LabOS Reagent Capture — Privacy Policy

Last updated: 2026-05-18

## What LabOS Reagent Capture does

LabOS Reagent Capture is a browser extension that captures product
information from biomedical vendor websites and forwards it to the
user's configured LabOS instance for centralized purchasing.

## What data is collected

When you click "Add to LabOS" on a vendor product page, the extension
reads only the following from that page:

- Product name
- Catalog number / SKU
- CAS number (chemicals)
- Price and currency
- Pack size
- Product image URL
- Safety Data Sheet (SDS) URL if linked on the page
- GHS hazard codes if shown on the page

It does NOT collect:

- Browsing history or search history
- Cookies, login credentials, or session tokens of any third-party site
- Personal information beyond what you choose to store in your LabOS
  account (which the extension never sees)
- Credit card numbers (payment is processed entirely by Stripe inside
  the user's LabOS instance)
- Data from any website not listed in host_permissions

## Where data is stored

- Captured products: chrome.storage.local (the user's browser, encrypted
  at rest by Chrome). Never leaves the device except to be sent to the
  user's configured LabOS API endpoint.
- LabOS API URL and bearer token: chrome.storage.sync (synced across
  the user's signed-in Chrome devices, encrypted by Google).

No data is sent to the extension developer, the Chrome Web Store, or
any third-party server other than the user-configured LabOS endpoint.

## Third-party services

The extension communicates only with the LabOS API endpoint that the
user configures in its Options page. It does not communicate with
analytics services, ad networks, or any other third party.

## User control

Users can:

- Clear all captured items at any time from the extension popup
- Change or remove the configured LabOS API endpoint at any time
- Uninstall the extension to remove all stored data
- Configure which event types trigger notifications

## Children's privacy

LabOS Reagent Capture is not intended for children under 13. It is a
professional research tool used by laboratory researchers.

## Changes

We will update this policy as the extension changes. The Last updated
date at the top reflects the most recent revision.

## Contact

huhcc87@gmail.com
```

---

## 🟦 Section 5 — Distribution

### Visibility

Choose **Unlisted** if this is for your lab only:
- Extension is NOT shown in Chrome Web Store search
- Only people with the direct install URL can find it
- Still goes through Google's review

Choose **Public** if you want anyone to discover and install it:
- Listed in search results
- Discoverable in Productivity category

Choose **Private** with specific accounts if you want tighter control:
- Only specific Google accounts you whitelist can install
- Best for internal corporate distribution

### Geographic distribution
> **All regions** (or pick specific countries — for a lab tool, all regions is fine)

---

## 🟦 Section 6 — Pricing

> **Free** (default — no in-app payments through Chrome Web Store)

---

## ✅ Final checklist before clicking "Submit for review"

- [ ] Title and Summary filled in
- [ ] Description pasted (will be ~3,500 chars)
- [ ] Category set to **Productivity**
- [ ] Language set to **English (United States)**
- [ ] Store icon uploaded (128×128)
- [ ] **At least 1 screenshot** uploaded (recommend all 5)
- [ ] Small promo tile uploaded (optional but improves listing)
- [ ] Marquee promo tile uploaded (optional)
- [ ] Support URL = `mailto:huhcc87@gmail.com`
- [ ] Single purpose statement pasted (left sidebar → Privacy)
- [ ] All 6 permission justifications pasted
- [ ] Data usage disclosure: Authentication info + Website content toggled ON
- [ ] Three certifications toggled ON
- [ ] Privacy policy URL pasted (your Gist Raw URL)
- [ ] Visibility set (Unlisted recommended for lab use)

When all green, click **Submit for review** (top-right).

---

## 📨 What happens next

1. Status changes from "Draft" → "Pending review"
2. You'll get email at `huhcc87@gmail.com` within 1–3 business days
3. If approved: install URL becomes active — share with your lab
4. If rejected: email tells you exactly what to fix — usually a tweak to justifications or screenshots

After approval, the URL pattern is:
```
https://chrome.google.com/webstore/detail/labos-reagent-capture/<extension-id>
```

The `<extension-id>` is already visible in your dev console (the ID
`plmbihhgajefchkkbekmfifhheamdpij` from your screenshot).

So your actual install URL will be:
```
https://chrome.google.com/webstore/detail/labos-reagent-capture/plmbihhgajefchkkbekmfifhheamdpij
```

Bookmark that — share with your lab once Google approves.

---

## 🔁 If you need to update later

1. Bump version in `extension/manifest.json` (`1.0.0` → `1.0.1`)
2. Run `./package.sh chrome` to rebuild the zip
3. In dev console → your item → **Package** tab → **Upload new package**
4. Submit for re-review (1–3 days)

Updates auto-deploy to all installed users via Chrome's update mechanism.
