# Firefox Add-ons Listing — Paste-Ready Kit

Everything needed to submit to addons.mozilla.org (AMO). Follow in order.

---

## Where the asset files are

```
lab_management_system_v2/dist-extension/
├── labos-extension-1.0.0-firefox.zip    ← upload this as the Add-on package
└── store-assets/
    ├── screenshot-1-hero.png            1280×800
    ├── screenshot-2-button.png          1280×800
    ├── screenshot-3-cart.png            1280×800
    ├── screenshot-4-procurement.png     1280×800
    ├── screenshot-5-settings.png        1280×800
    ├── promo-small-440x280.png          440×280
    └── promo-marquee-1400x560.png       1400×560

lab_management_system_v2/extension/icons/
└── icon128.png    128×128  ← used as Add-on icon
```

---

## Step-by-step submission

1. Go to https://addons.mozilla.org/developers/
2. Click **Submit a New Add-on**
3. Choose **On this site** (hosted on AMO, recommended)
4. Upload `labos-extension-1.0.0-firefox.zip`
5. AMO validates the package — fix any lint warnings flagged
6. Fill in the listing details below

---

## Section 1 — Basic information

### Name
```
LabOS Reagent Capture
```

### Add-on URL slug (auto-suggested — accept or set to)
```
labos-reagent-capture
```

### Summary (max 250 chars)
```
Capture reagents from any biomedical vendor and route them to LabOS for centralized lab purchasing — one click, any supplier.
```

### Description (paste into the rich-text field)

```
LabOS Reagent Capture turns any biomedical vendor website into a one-click extension of your LabOS account. Browse Sigma-Aldrich, Thermo Fisher, VWR, Bio-Rad, Abcam, NEB, IDT, QIAGEN, and 15+ other suppliers — then click the orange "Add to LabOS" button to capture reagents directly into your Reagent Cart.

━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHAT IT DOES
━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Detects product pages on 20+ major biomedical vendors automatically
• One-click capture: name, catalog number, size, price, vendor, and image
• Local cart — items are saved even when LabOS is offline
• Syncs to LabOS Reagent Cart when connected — no copy-paste
• Real-time connection status indicator in the popup
• Configurable LabOS server URL (self-hosted or cloud)

━━━━━━━━━━━━━━━━━━━━━━━━━━━
SUPPORTED VENDORS
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Sigma-Aldrich / Merck · Thermo Fisher / Invitrogen · Fisher Scientific · VWR · Bio-Rad · Abcam · New England Biolabs · IDT · R&D Systems · Cell Signaling Technology · QIAGEN · Santa Cruz Biotechnology · Miltenyi Biotec · Eppendorf · Beckman Coulter · Promega · Takara Bio

━━━━━━━━━━━━━━━━━━━━━━━━━━━
REQUIRES LABOS
━━━━━━━━━━━━━━━━━━━━━━━━━━━
This extension requires LabOS v3 (self-hosted or LabOS Cloud). See labos.app for details.

━━━━━━━━━━━━━━━━━━━━━━━━━━━
PRIVACY
━━━━━━━━━━━━━━━━━━━━━━━━━━━
No data is sent to third parties. All captured product data goes only to your configured LabOS instance. See the Privacy Policy for full details.
```

---

## Section 2 — Categories & tags

| Field | Value |
|---|---|
| Category | Productivity |
| Tags | `lab`, `reagent`, `science`, `procurement`, `research`, `biomedical`, `chemistry` |

---

## Section 3 — License

Select: **All Rights Reserved** (or MIT if you wish to open-source)

---

## Section 4 — Privacy Policy URL

```
https://labos.app/privacy
```

*(Update this URL once you have a live domain. AMO requires a privacy policy for extensions that access browsing data.)*

---

## Section 5 — Screenshots (upload in order)

| Slot | File | Caption |
|---|---|---|
| 1 | `screenshot-1-hero.png` | LabOS Reagent Capture — popup overview |
| 2 | `screenshot-2-button.png` | One-click "Add to LabOS" button on product pages |
| 3 | `screenshot-3-cart.png` | Captured reagent cart with sync status |
| 4 | `screenshot-4-procurement.png` | Synced items appear in LabOS Procurement Hub |
| 5 | `screenshot-5-settings.png` | Easy server configuration |

---

## Section 6 — Version notes (for reviewers)

```
Initial release (v1.0.0). This extension captures product metadata from biomedical supplier 
websites and stores it locally (using browser.storage.local) before optionally syncing to the 
user's self-hosted LabOS server. No data is transmitted to any third-party service. 
The host_permissions are limited to the 20 supported supplier domains plus localhost for 
self-hosted instances.
```

---

## AMO-specific requirements checklist

- [ ] No eval() or remote code execution
- [ ] No obfuscated code
- [ ] host_permissions limited to specific vendor domains (already done in manifest.firefox.json)
- [ ] Uses `browser.*` APIs (already done — background.js uses `chrome.*` which Firefox supports via polyfill)
- [ ] Privacy policy URL filled in
- [ ] Source code submitted if minified (not needed — extension uses plain JS)

---

## After submission

AMO typically reviews within **1–5 business days**. You will receive an email when approved or if changes are required. Expedited review is available for security fixes.
