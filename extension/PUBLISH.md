# 📦 Publishing the LabOS Extension — Full Guide

This guide covers everything: payment, account setup, upload, listing fields,
review process, and post-approval rollout.

---

## 💳 Payment — Where & When

### Chrome Web Store ($5 one-time)

**Where to pay:**
1. Sign in at https://chrome.google.com/webstore/devconsole
2. The first time you click **"+ New item"** or **"Submit for review"**, Chrome will redirect you to a payment page
3. Pay with **Google Pay** (any card linked to your Google account)
4. Direct payment URL: https://chrome.google.com/webstore/devconsole/register

**Cost:** **$5.00 USD one-time** — covers your lifetime as a publisher,
not per-extension. After paying once you can publish unlimited extensions.

**What it pays for:** anti-spam verification + identity check.

**Receipt:** sent to `huhcc87@gmail.com` (the Google account email).

---

### Firefox AMO — FREE

**Where to pay:** ❌ Not required. Mozilla doesn't charge anything.

Sign up at https://addons.mozilla.org/developers/ — that's it.

---

### Apple Developer ($99/year) — only if you want Safari

**Where to pay:** https://developer.apple.com/programs/enroll/

**Cost:** **$99/year USD** — required for Safari + iOS extensions.
Skip this unless you specifically need Safari support.

---

### Quick comparison

| Store | Cost | Review time | Best for |
|---|---|---|---|
| **Chrome Web Store** | **$5 one-time** | 1–3 business days | Most users — works in Chrome, Edge, Brave, Opera |
| **Firefox AMO** | Free | Hours to 1 day | Firefox users |
| **Apple App Store** | $99/year | 1–7 days | Mac Safari + iOS Safari |
| **Self-host (skip stores)** | Free | Instant | Your lab only, ~5–20 users |

---

## 🟢 Chrome Web Store — Full Upload Walkthrough

### Step 1 — Account setup (one-time)

1. Open https://chrome.google.com/webstore/devconsole
2. Sign in with your Google account
3. Pay the **$5 one-time** developer fee via Google Pay
4. Wait for email confirmation (usually instant)

### Step 2 — Verify identity (if prompted)

For new accounts, Google may require identity verification:
- **Phone number** (gets SMS code)
- **Government ID upload** (driver's license, passport, etc.)
- Usually completes within 24 hours

### Step 3 — Click "+ New item"

Top-right of the dashboard.

### Step 4 — Upload the zip

Drag this file into the dialog:
```
/Users/mudasirrashid/Documents/app/1.. lab_management_system_v2/dist-extension/labos-extension-1.0.0-chrome.zip
```

Or click **Select file** and navigate to it.

Wait 5–30 seconds for upload + validation.

### Step 5 — Fill in "Store listing" tab

| Field | What to enter |
|---|---|
| **Title** | LabOS Reagent Capture |
| **Summary** (132 char max) | Capture reagents from any biomedical vendor and route them to LabOS for centralized purchasing. |
| **Detailed description** (16,000 char max) | Paste content from `extension/README.md`, expand as needed |
| **Category** | Productivity |
| **Language** | English (United States) |
| **Screenshots** (1280×800 or 640×400) | Minimum 1, recommend 3–5. Take with **⌘+Shift+4** on Mac |
| **Promo tile** (440×280) | Optional, used in search results |
| **Marquee promo** (1400×560) | Optional, used on Chrome Web Store homepage |
| **Icon** | Already bundled in zip — Chrome auto-uses `icons/icon128.png` |

#### Recommended screenshots
1. Extension popup with cart items
2. Orange "Add to LabOS" button on a Sigma product page
3. Options/settings page
4. LabOS Reagent Cart receiving items
5. Procurement Hub showing approvals

### Step 6 — Fill in "Privacy practices" tab

#### Single-purpose statement
> Captures reagent product information from biomedical vendor websites and forwards it to the user's configured LabOS instance for centralized purchasing.

#### Permission justifications

| Permission | Justification |
|---|---|
| `activeTab` | Read the current tab's product page when user clicks "Capture this page" |
| `scripting` | Inject the "Add to LabOS" button into vendor product pages |
| `storage` | Save the user's LabOS API URL, token, and offline cart copy |
| `contextMenus` | Right-click → "Send page to LabOS" menu item |
| `notifications` | Confirm successful captures with a small notification |
| `host_permissions` | Read product info from the 20+ pre-supported vendor sites (Sigma, Thermo, VWR, etc.) listed in manifest |

#### Data usage disclosure

Toggle ON the boxes for:
- ✓ **Authentication information** — "User's LabOS API bearer token is stored locally and sent only to the user-configured LabOS server"
- ✓ **Website content** — "Reads product name, catalog #, price, and image from vendor product pages"
- ✗ Personally identifiable info (only if your LabOS captures phone numbers)
- ✗ Health info, Financial info, Location, etc.

#### Privacy policy URL (REQUIRED)

Even for unlisted extensions, Chrome requires a privacy policy URL.

**Quick way to create one:**
1. Go to https://gist.github.com
2. New gist named `labos-extension-privacy-policy.md`
3. Paste this template:

```markdown
# LabOS Reagent Capture — Privacy Policy

The LabOS Reagent Capture extension stores captured product information
locally in the browser and sends it to the user-configured LabOS API
endpoint. No data is sold to or shared with third parties.

## What we collect
- Product details (name, catalog number, price, image URL) you choose to
  capture from vendor product pages
- Your LabOS API endpoint URL and bearer token (stored locally in
  chrome.storage)

## What we don't collect
- Browsing history, search history, or any data from non-vendor pages
- Personal information beyond what's already in your LabOS account
- Payment card numbers (payments are processed entirely by Stripe inside
  your LabOS instance)

## Storage
- Cart items: chrome.storage.local (encrypted by Chrome at-rest)
- API token: chrome.storage.sync (synced across your devices if signed
  into Chrome)
- All data stays on your machine or your LabOS server. Nothing flows to
  the extension developer.

## Contact
huhcc87@gmail.com
```

4. Click **Create public gist**
5. Click **Raw** button to get the URL
6. Paste that URL into Chrome Web Store's Privacy policy field

### Step 7 — Fill in "Distribution" tab

| Field | Recommended |
|---|---|
| **Visibility** | **Unlisted** (only people with link install, not in search) — best for lab-only use. Choose **Public** if you want anyone in the world to find it. |
| **Geographic distribution** | All regions (or limit to specific countries) |
| **Mature content** | No |

### Step 8 — Submit for review

Click **"Submit for review"** (top-right).

You'll see: *"Your item is pending review."*

### Step 9 — Wait

- **1–3 business days** typical
- Email arrives at `huhcc87@gmail.com` with status:
  - ✅ **Approved** → install URL becomes active
  - ❌ **Rejected** → email lists exact reason, fix and resubmit

### Step 10 — Share the install URL

After approval, your extension URL looks like:
```
https://chrome.google.com/webstore/detail/labos-reagent-capture/<extension-id>
```

Share that with your lab. One click → installed.

---

## 🦊 Firefox AMO — Full Upload Walkthrough

### Step 1 — Create Mozilla account (free)

1. Sign up at https://accounts.firefox.com
2. Verify your email
3. Go to https://addons.mozilla.org/developers/

### Step 2 — Click "Submit a New Add-on"

### Step 3 — Choose distribution path

- **"On this site"** — Listed on AMO, anyone can find and install
- **"On your own"** — Self-hosted, you get a signed `.xpi` file to distribute

For lab-only use, pick **"On your own"**.

### Step 4 — Upload zip

```
/Users/mudasirrashid/Documents/app/1.. lab_management_system_v2/dist-extension/labos-extension-1.0.0-firefox.zip
```

Mozilla auto-validates and shows any warnings.

### Step 5 — Fill in metadata

| Field | What to enter |
|---|---|
| **Name** | LabOS Reagent Capture |
| **Summary** (250 char max) | Capture reagents from biomedical vendor websites — Sigma, Thermo, VWR, Abcam, NEB and more — and route them to LabOS for centralized purchasing |
| **Description** | Paste from README.md, expand |
| **Categories** | Productivity, Search Tools |
| **License** | MIT (or "All Rights Reserved" if proprietary) |
| **Privacy policy** | Paste the same policy from Chrome step |
| **Screenshots** | Same as Chrome |
| **Tags** | reagents, lab, biomedical, procurement |

### Step 6 — Submit

Mozilla review is **usually hours, sometimes minutes**.

### Step 7 — Distribute

If "On this site": share AMO URL
If "On your own": Mozilla gives you a signed `.xpi` to host wherever you want

---

## 🏢 Org-Wide Rollout (After Chrome Approval)

For automatic install across your lab's machines via Google Workspace:

### Setup
1. Sign in to **admin.google.com** (Google Workspace admin)
2. Go to **Devices** → **Chrome** → **Apps & Extensions**
3. Click **+** → **Add Chrome app or extension by ID**
4. Paste your extension's ID (visible after upload, in URL of dev console)

### Configure
| Setting | Value |
|---|---|
| Installation policy | **Force install** (or "Allow install" for opt-in) |
| Update URL | Default (Chrome Web Store) |
| Permissions | Auto-approved from manifest |

### Apply
- Choose organizational unit (lab group, department, etc.)
- Save
- Within ~30 min, all devices in that OU receive the extension

---

## 🚫 Skipping All Stores (Internal-Only Distribution)

Don't want to deal with reviews or fees? Just share the unzipped folder:

### Step 1 — Bundle for distribution
```bash
cd "/Users/mudasirrashid/Documents/app/1.. lab_management_system_v2"
# Zip already exists at dist-extension/labos-extension-1.0.0-chrome.zip
```

### Step 2 — Share via Google Drive / Dropbox / Slack

Upload `labos-extension-1.0.0-chrome.zip` and send the download link to your team.

### Step 3 — Each user installs manually

1. Download and unzip the file
2. Open `chrome://extensions`
3. Toggle **Developer mode** (top-right)
4. Click **Load unpacked**
5. Select the unzipped `extension/` folder
6. Pin to toolbar

### Pros
- ✅ Free, no review
- ✅ Instant rollout
- ✅ Full control over the build

### Cons
- ❌ Each user does 6 manual steps
- ❌ Chrome shows "Developer mode" warning every browser launch
- ❌ No auto-updates — push new versions manually
- ❌ Doesn't work on managed corporate machines that block unpacked extensions

---

## 🐛 Troubleshooting Upload Errors

| Error | Cause | Fix |
|---|---|---|
| "Description field too long: 134" | manifest description > 132 chars | Already fixed in current build — verify with `unzip -p dist-extension/labos-extension-1.0.0-chrome.zip manifest.json` |
| "Invalid value for 'permissions'" | Permission name typo in manifest | Check manifest.json against Chrome MV3 spec |
| Same error after re-upload | Stale dialog state | Hard refresh (**⌘+Shift+R**), then click "+ New item" again |
| "Failed to upload" | Network timeout | Try again — zip is small (28 KB), shouldn't timeout |
| "Verification required" | Google requires identity check | Complete the verification flow (24h) |
| Review rejected: "purposeless permissions" | Permissions look broader than function | Trim host_permissions to only the vendors your extension actually scrapes |
| Review rejected: "missing single purpose" | No single-purpose statement | Add one (see Step 6 above) |

---

## ✅ Final Pre-Flight Checklist

Before clicking Submit:

- [ ] **$5 paid** to Chrome dev account (or Mozilla free)
- [ ] **Zip uploaded** from `dist-extension/labos-extension-1.0.0-chrome.zip` (not from random Downloads folder)
- [ ] **Description ≤132 chars** verified
- [ ] **Privacy policy URL** hosted somewhere (GitHub Gist works)
- [ ] **Single-purpose statement** entered
- [ ] **Each permission justified** in 1 sentence
- [ ] **At least 1 screenshot** uploaded (1280×800)
- [ ] **Category** = Productivity
- [ ] **Visibility** = Unlisted (for lab-only) or Public (for everyone)

---

## 📞 Help

| Issue | Where to ask |
|---|---|
| Chrome Web Store specific | https://groups.google.com/g/chromium-extensions |
| Mozilla AMO specific | https://discourse.mozilla.org/c/add-ons/ |
| LabOS extension code | Issues tab on your LabOS repo |
| Payment problems | payments-noreply@google.com |
