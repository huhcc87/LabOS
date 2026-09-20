# LabOS Reagent Capture — Browser Extension

Capture reagents, chemicals, antibodies, and consumables from any biomedical
vendor and route them to LabOS for centralized purchasing.

## Install (dev mode)

1. Open Chrome / Edge / Brave → `chrome://extensions`
2. Toggle **Developer mode** (top right)
3. Click **Load unpacked**
4. Select this `extension/` folder
5. Pin the extension to your toolbar for one-click access

## Setup

1. Open LabOS in another tab and make sure it's running
2. Click the extension icon → ⚙️ Settings
3. Set **LabOS API base URL** (default: `http://localhost:8000/api`)
4. Paste your **API token** from LabOS → Settings → Tokens
5. Click **Save** then **Test connection**

## Pre-supported vendors

The extension already understands these vendors' product pages — no setup
needed. Just visit a product page and click the orange "Add to LabOS" button:

- Sigma-Aldrich / MilliporeSigma
- Thermo Fisher / Invitrogen / Life Technologies
- Fisher Scientific
- VWR
- Bio-Rad
- Abcam
- New England Biolabs (NEB)
- IDT (oligos)
- R&D Systems
- Cell Signaling Technology
- Qiagen
- Santa Cruz Biotechnology
- Miltenyi Biotec
- Eppendorf
- Beckman Coulter
- Promega
- Takara Bio

## Custom vendors

Any other vendor you order from? Open the extension → ⚙️ Settings →
**Custom vendors** and add the hostname. If their product pages use
schema.org Product microdata (most do), the extension will auto-detect
name / catalog / price. Otherwise, paste CSS selectors for the fields.

## How payment works

Items captured by the extension flow into **LabOS → Resources → Reagent Cart**.
From there you can:

1. Review and adjust quantities
2. Save your payment methods (Stripe Customer)
3. Approve and process the order in one click

All credit cards are stored in Stripe (PCI-compliant). LabOS never sees
the raw card numbers — only Stripe's reusable payment-method IDs. Delete
a card and it's gone from every future order across all vendors.

## Architecture

```
[Vendor site]  ──content_scripts──▶  [Background SW]  ──HTTP──▶  [LabOS API]
                                            │                          │
                                            └──chrome.storage.local────┘
                                              (offline mirror / popup)
```

- `manifest.json`        — MV3 declaration
- `background.js`        — message router + LabOS API client
- `content/_shared.js`   — shared "Add to LabOS" button + adapters
- `content/<vendor>.js`  — per-vendor DOM extractors
- `content/generic.js`   — schema.org + custom-vendor fallback
- `popup.html` + `popup.js`     — extension popup (cart preview)
- `options.html` + `options.js` — settings + custom vendor config
