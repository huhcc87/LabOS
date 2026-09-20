# Extension Store Submission Guide

Complete checklist to publish LabOS Reagent Capture to Chrome Web Store and Firefox Add-ons.

---

## Pre-submission checklist

- [ ] Extension tested end-to-end in Chrome and Firefox
- [ ] `dist-extension/labos-extension-1.0.0-chrome.zip` built and verified
- [ ] `dist-extension/labos-extension-1.0.0-firefox.zip` built and verified
- [ ] All store screenshots exist in `dist-extension/store-assets/`
- [ ] Privacy policy live at a public URL
- [ ] Developer accounts created (see below)

---

## Rebuild the packages

```bash
cd extension
bash package.sh
# Outputs:
#   ../dist-extension/labos-extension-1.0.0-chrome.zip
#   ../dist-extension/labos-extension-1.0.0-firefox.zip
```

---

## 1. Chrome Web Store

**Developer account:** https://chrome.google.com/webstore/devconsole  
**One-time registration fee:** $5 USD  
**Listing kit:** `extension/CHROME-LISTING-KIT.md`

### Steps

1. Sign in at https://chrome.google.com/webstore/devconsole
2. Click **New Item** → upload `labos-extension-1.0.0-chrome.zip`
3. Fill in all fields from `CHROME-LISTING-KIT.md`
4. Upload screenshots from `dist-extension/store-assets/`
5. Set **Distribution** → All regions
6. Set **Visibility** → Public (or Unlisted for internal testing first)
7. Click **Submit for Review**

**Review time:** Typically 1–3 business days (new extensions may take up to 7 days).

---

## 2. Firefox Add-ons (AMO)

**Developer hub:** https://addons.mozilla.org/developers/  
**Registration fee:** Free  
**Listing kit:** `extension/FIREFOX-LISTING-KIT.md`

### Steps

1. Sign in at https://addons.mozilla.org/developers/
2. Click **Submit a New Add-on** → **On this site**
3. Upload `labos-extension-1.0.0-firefox.zip`
4. Fill in all fields from `FIREFOX-LISTING-KIT.md`
5. Upload screenshots from `dist-extension/store-assets/`
6. Submit for review

**Review time:** 1–5 business days.

---

## 3. Edge Add-ons (optional)

Edge accepts Chrome extensions with minimal changes.

1. Go to https://partner.microsoft.com/dashboard/microsoftedge/overview
2. Create a developer account (free)
3. Upload the **same** `labos-extension-1.0.0-chrome.zip`
4. Fill in listing details (reuse Chrome kit descriptions)

---

## Version bumping (future releases)

```bash
# 1. Update version in extension/manifest.json and extension/manifest.firefox.json
# 2. Rebuild packages
cd extension && bash package.sh
# 3. In Chrome Web Store → your listing → Package → Upload new package
# 4. In AMO → your listing → New Version → Upload
```

---

## Store asset dimensions

| Asset | Size | Used in |
|---|---|---|
| Icon | 128×128 | Both stores |
| Screenshots | 1280×800 | Both stores |
| Small promo tile | 440×280 | Chrome only |
| Marquee promo tile | 1400×560 | Chrome only |
| Promotional video | YouTube link | Optional |
