# 🚀 LabOS v3 — Production Deployment Guide

End-to-end recipe for deploying LabOS at **$0** with truly-free tiers, or
**pay-as-you-go** (no monthly subscription) at scale.

---

## ⚡ QUICK PATH: Neon DB + Railway + Vercel (recommended)

This is the fastest path to a production LabOS. Do these 5 steps in order.

### A. Push to GitHub (one-time)

```bash
cd /Users/mudasirrashid/Documents/app/lab_management_system_v2
git init && git add . && git commit -m "v3 production release"
# Create repo at github.com → New repository → name: labos
git remote add origin https://github.com/huhcc87/labos.git
git push -u origin main
```

---

### B. Neon database (5 min)

1. Go to **https://neon.tech** → Sign up with GitHub (`huhcc87@gmail.com`)
2. **New Project** → name `labos`, region `US East`
3. Dashboard → **Connection Details** → enable **Pooled connection** → copy the string:
   ```
   postgresql://labos_owner:PASS@ep-xxx.us-east-2.aws.neon.tech/labos?sslmode=require
   ```
   Keep this — you paste it into Railway next.

---

### C. Railway backend (10 min)

1. Go to **https://railway.app** → Login with GitHub
2. **New Project** → **Deploy from GitHub repo** → pick `labos`
3. Railway asks for **Root Directory** → type `backend`
4. It auto-detects the Dockerfile ✓
5. Go to **Variables** tab → Add ALL of these:

| Variable | Value |
|---|---|
| `DATABASE_URL` | Neon connection string from step B |
| `SECRET_KEY` | `FlSqBHNoEwQEFIZe57aQL23le1XItn_jTq-jY2cEq2mOvsNxTo8ugWLI_hVmCt2B` |
| `ENVIRONMENT` | `production` |
| `CORS_ORIGINS` | `https://YOUR_APP.vercel.app` ← update after step D |
| `DEEPSEEK_API_KEY` | `sk-c2b1420edb304c53aedfea0e25be3986` |
| `ANTHROPIC_API_KEY` | your Claude key (optional) |
| `OPENAI_API_KEY` | your OpenAI key (optional) |
| `UPLOAD_DIR` | `/data/uploads` |

6. **Volumes** tab → Add Volume → mount path `/data` → 1 GB
7. Click **Deploy** — Railway runs `alembic upgrade head` then starts uvicorn
8. Wait for green healthcheck ✓ on `/api/health`
9. Copy your Railway URL e.g. `https://labos-backend-production.up.railway.app`

---

### D. Update vercel.json with Railway URL

Open `frontend/vercel.json` and replace both occurrences of `RAILWAY_BACKEND_URL` with your actual Railway URL (no trailing slash):

```bash
# Example — replace with your real Railway URL:
sed -i '' 's|RAILWAY_BACKEND_URL|labos-backend-production.up.railway.app|g' \
  /Users/mudasirrashid/Documents/app/lab_management_system_v2/frontend/vercel.json
git add frontend/vercel.json && git commit -m "chore: wire Railway URL" && git push
```

---

### E. Vercel frontend (5 min)

1. Go to **https://vercel.com** → Login with GitHub → **New Project**
2. Import your `labos` repo
3. **Framework**: Vite | **Root Directory**: `frontend`
4. **Environment Variables** — leave `VITE_API_BASE_URL` **blank** (Vercel proxy handles /api)
5. Click **Deploy** (~30 sec)
6. Copy your Vercel URL e.g. `https://labos-xyz.vercel.app`

---

### F. Final wiring (2 min)

```bash
# 1. Update CORS on Railway → Variables → change CORS_ORIGINS to your Vercel URL
#    Railway auto-redeploys on env var save.

# 2. Seed first admin (Railway → your service → Connect → Railway Shell):
cd /app && python seed.py
# OR via curl:
curl -X POST https://YOUR_RAILWAY_URL/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"huhcc87@gmail.com","password":"LabOS2024!","full_name":"Admin","role":"admin"}'
```

### G. Smoke test

- ✅ `https://YOUR_RAILWAY_URL/api/health` → `{"status":"ok"}`
- ✅ Vercel URL loads login page
- ✅ Login with admin credentials
- ✅ Create a sample, confirm it persists after refresh (Neon working)

---

---

## 0️⃣ Pick your hosting style — no monthly subscriptions

You said you want pay-as-you-use (like Convex), not flat monthly subscriptions.
Here are the **three tiers** of options. All are zero-subscription:

### 🟢 Tier 1 — Truly free forever (zero credit card needed)

For 1–20 users, you never pay a cent.

| Layer | Service | Free forever limits |
|---|---|---|
| **Frontend** | **Cloudflare Pages** | Unlimited bandwidth, unlimited requests, 500 builds/mo |
| **Backend** | **Google Cloud Run** | 2M requests/mo, 360k GB-seconds compute, 180k vCPU-seconds — well above lab usage |
| **Database** | **Turso (SQLite-on-edge)** | 9 GB storage, 1B row reads/mo, 25M writes/mo |
| **File storage** | **Cloudflare R2** | 10 GB storage, 10M reads/mo, 1M writes/mo |
| **Email** | **Resend** | 3,000 emails/mo, 100/day |
| **SMS** | **Twilio (verify trial)** | Free $15 credit ≈ 2,000 SMS in test mode |
| **Analytics** | **Cloudflare Web Analytics** | Unlimited, privacy-first, no cookie banner needed |

**Total cost: $0/mo for as long as you stay within free limits.** Most single labs never exceed these.

### 🟡 Tier 2 — Pay-as-you-go (only pay for what you use)

For 20–500 users. No flat monthly fee, no credit card minimum.

| Layer | Service | Pricing model |
|---|---|---|
| **Frontend** | **Cloudflare Pages** | Still free at any scale (unlimited bandwidth) |
| **Backend** | **Fly.io** | Per-second compute billing. ~$0.0000022/sec for shared 256 MB. **Idle lab = $0.** Active 24/7 ≈ $2/mo. |
| **Backend (alt)** | **Google Cloud Run** | $0.00002400 per vCPU-second. **Idle = $0.** Pay only when a request fires. |
| **Database** | **Neon Postgres** | $0.16/GB-month + $0.16/compute-hour, autoscale to zero when idle |
| **Database (alt)** | **Supabase** | $0/mo base, $0.0125/GB egress + $0.125/GB-month after free tier |
| **File storage** | **Cloudflare R2** | $0.015/GB-month storage. **No egress fees** (vs S3's $0.09/GB) |
| **Email** | **AWS SES** | $0.10 per 1,000 emails. **No minimum.** |
| **SMS** | **Twilio** | $0.0079 per SMS (US). Pay-per-message. No subscription. |
| **Payments** | **Stripe** | 2.9% + $0.30 per transaction. No subscription. |
| **AI** | **OpenAI / Anthropic API** | Per-token pricing. ~$0.003 per 1K tokens. Pay only when you call it. |

**Realistic monthly cost for a 30-person research lab: $3–8/mo total.**

### 🟠 Tier 3 — Subscription services (avoid if you want pure usage)

These are flat monthly fees regardless of usage — included only for comparison:

| Service | Fee | Why people pick it |
|---|---|---|
| Render starter | $7/mo | No cold starts (Fly.io achieves same, pay-per-second) |
| Vercel Pro | $20/mo | Team features (Cloudflare Pages is free at same scale) |
| Neon Launch | $19/mo | Higher autoscaling cap (only matters above ~500 users) |
| Supabase Pro | $25/mo | Daily backups (Neon free already has 24h history) |

**Skip these.** The pay-as-you-go services above are cheaper for labs.

---

## 🎯 Recommended LabOS stack (zero subscription)

For your single research lab, I'd go with **all-Cloudflare + Fly.io + Neon**:

```
GitHub (huhcc87) → push code
   ↓
Frontend: Cloudflare Pages (free, instant deploy on push)
   ↓
Backend: Fly.io (pay-per-second, $0 when idle)
   ↓
Database: Neon Postgres (autoscale-to-zero, ~$1/mo per active hour)
   ↓
File uploads: Cloudflare R2 (10 GB free, no egress fees)
   ↓
Payments: Stripe (you already have this — pay-per-transaction)
   ↓
Email: Resend free tier (3k/mo, plenty for a lab)
```

**Expected first-year cost: $0–60 total** (most labs land closer to $0–15).

Step-by-step instructions for this stack are below. The Render+Vercel+Neon recipe further down still works if you prefer it.

---

## 1️⃣ Push code to GitHub

If your repo isn't on GitHub yet:

```bash
cd "/Users/mudasirrashid/Documents/app/1.. lab_management_system_v2"
git init  # if needed
git add .
git commit -m "v3 production release"
gh repo create labos-v3 --private --source=. --push
```

If `gh` (GitHub CLI) isn't installed: install via Homebrew `brew install gh`, then `gh auth login` (uses `huhcc87@gmail.com`).

Now your code is at `https://github.com/huhcc87/labos-v3` (private).

---

## 2️⃣ Set up Neon Postgres (5 min, free)

1. Open https://console.neon.tech and sign in with GitHub (`huhcc87@gmail.com`)
2. Click **Create Project**
   - **Project name**: `labos`
   - **Postgres version**: 16 (default)
   - **Region**: nearest to your users (e.g. `us-east-2`)
3. After creation, go to **Dashboard → Connection Details**
4. Copy the **Connection string** — it looks like:
   ```
   postgresql://neondb_owner:abc123XYZ@ep-cool-mountain-123.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
5. **Change the prefix** from `postgresql://` to `postgresql+psycopg://` for SQLAlchemy:
   ```
   postgresql+psycopg://neondb_owner:abc123XYZ@ep-cool-mountain-123.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```

This is your `DATABASE_URL`. Save it — you'll paste it into the backend env vars in Step 4.

### Optional: enable Neon branching
- Neon supports git-like branches of your database. Create a `staging` branch for testing migrations without touching prod.
- Branches show under the Neon project → **Branches** tab.

---

## 3️⃣ Set up Stripe (5 min, you already have keys)

You already have Stripe set up. To verify:

1. Open https://dashboard.stripe.com/apikeys
2. **Test mode** (top-right toggle should be on for safety)
3. Copy these two values:
   - **Publishable key** (starts with `pk_test_`) — safe to expose in frontend
   - **Secret key** (starts with `sk_test_`) — backend ONLY, never commit

You'll paste:
- `STRIPE_SECRET_KEY=sk_test_…` → backend env
- `VITE_STRIPE_PUBLISHABLE_KEY=pk_test_…` → Vercel env

When you're ready for real payments, switch to **Live mode** in Stripe and swap the keys for `sk_live_…` / `pk_live_…`.

> ⚠️ Note: the keys you showed in your screenshot were `sk_live_…` from the "Halal Food Checker" Stripe account. You'll want a separate Stripe account for LabOS so finances don't mix. Click the account name (top-left in Stripe) → **+ New account**.

---

## 4️⃣ Deploy the backend — pay-as-you-go path (Fly.io)

Best pure pay-per-second backend host. **Idle costs $0.** No subscription.

### Setup (one-time)

```bash
# Install Fly CLI
brew install flyctl   # macOS

# Sign up / log in (uses GitHub auth — works with huhcc87@gmail.com)
fly auth signup       # or `fly auth login` if you already have an account

# From the LabOS repo root
cd "/Users/mudasirrashid/Documents/app/1.. lab_management_system_v2/backend"

# Launch — Fly auto-detects Python, asks a few questions
fly launch --no-deploy
```

When `fly launch` prompts you:
- **App name**: `labos-api` (must be globally unique — pick `labos-api-yourname` if taken)
- **Region**: pick nearest to your users (e.g. `ord` Chicago, `iad` Virginia, `lhr` London)
- **Postgres database**: choose **No** (we're using Neon)
- **Upstash Redis**: No
- **Deploy now**: No (we need to set secrets first)

This creates `backend/fly.toml`. Edit it to ensure these settings:

```toml
app = "labos-api"
primary_region = "iad"   # your chosen region

[build]
  builder = "paketobuildpacks/builder:base"

[env]
  PORT = "8000"
  ENVIRONMENT = "production"

[http_service]
  internal_port = 8000
  force_https = true
  auto_stop_machines = "stop"     # ← scales to ZERO when no traffic
  auto_start_machines = true       # ← wakes on first request
  min_machines_running = 0         # ← billing = $0 when idle

[[vm]]
  cpu_kind = "shared"
  cpus = 1
  memory_mb = 512
```

### Set secrets (these never touch git):

```bash
# Generate a secure secret key
SECRET=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")

# Set all secrets at once
fly secrets set \
  SECRET_KEY="$SECRET" \
  DATABASE_URL="postgresql+psycopg://USER:PASSWORD@ep-xxx.neon.tech/neondb?sslmode=require" \
  STRIPE_SECRET_KEY="sk_test_..." \
  CORS_ORIGINS="https://labos.pages.dev,https://your-custom-domain.com" \
  ENVIRONMENT="production"
```

### Deploy:

```bash
fly deploy
```

First deploy takes ~3 min. Once done:
```
✓ Deployed to https://labos-api.fly.dev
```

Your API base URL is `https://labos-api.fly.dev/api`. Save it for the frontend step.

### Verify pay-per-second is working

```bash
fly status
# Look for: "auto_stop_machines = stop" — confirms billing pauses when idle
```

After 5 min of no traffic, the machine stops. Next request wakes it in ~2 seconds. You only pay for the seconds it ran.

**Typical monthly cost: $0–2** for a single research lab with ≤100 requests/day.

---

## 4️⃣b Deploy the frontend — Cloudflare Pages (pure free, unlimited bandwidth)

Better than Vercel for our use case because:
- No bandwidth caps (Vercel free has 100 GB/mo)
- Unlimited site builds
- Free SSL
- Faster global CDN (200+ POPs)
- Free analytics (no cookie banner needed)

### Setup

1. Open https://dash.cloudflare.com/sign-up (free account, use `huhcc87@gmail.com`)
2. Click **Workers & Pages** in the left sidebar
3. **Create application** → **Pages** → **Connect to Git**
4. Authorize Cloudflare to read your GitHub
5. Pick your `labos-v3` repo
6. **Set up builds and deployments**:
   - **Production branch**: `main`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - **Root directory**: `frontend`
7. **Environment variables**:

   | Key | Value |
   |---|---|
   | `VITE_API_BASE_URL` | `https://labos-api.fly.dev/api` |
   | `VITE_STRIPE_PUBLISHABLE_KEY` | `pk_test_...` from Stripe |
   | `VITE_APP_NAME` | `LabOS` |
   | `NODE_VERSION` | `20` |

8. Click **Save and Deploy**. Build takes ~2 min.
9. Your app is live at `https://labos-v3.pages.dev`

### Custom domain (optional, free SSL):

1. Cloudflare Pages → your project → **Custom domains** → **Set up a custom domain**
2. Enter your domain (e.g. `app.yourdomain.com`)
3. Add the CNAME record Cloudflare shows you at your registrar
4. SSL auto-provisions in ~30 seconds

### Update backend CORS:

```bash
cd backend
fly secrets set CORS_ORIGINS="https://labos-v3.pages.dev,https://app.yourdomain.com"
# Fly auto-redeploys
```

---

## 4️⃣c Set up Cloudflare R2 for file uploads (free 10 GB, no egress fees)

LabOS lets users upload SDS PDFs, gel images, notebook attachments. Storing these on Cloudflare R2 saves money long-term because R2 has **zero egress charges** (vs AWS S3's $0.09/GB which gets expensive when users view files).

### Setup

1. Cloudflare dashboard → **R2 Object Storage** → **Create bucket**
2. Name: `labos-uploads`
3. **R2.dev subdomain**: enable (gives you a public URL)
4. **Manage R2 API Tokens** → **Create API token** → scope: read+write to this bucket
5. Save the **Access Key ID** + **Secret Access Key**

### Add to backend secrets:

```bash
fly secrets set \
  R2_ACCESS_KEY_ID="..." \
  R2_SECRET_ACCESS_KEY="..." \
  R2_BUCKET="labos-uploads" \
  R2_ENDPOINT="https://<account-id>.r2.cloudflarestorage.com"
```

(Wire-up in code: LabOS will need a small refactor to upload to R2 instead of local disk — that's a separate piece of work, not done in this drop.)

---

## 4️⃣ Deploy the backend (Render — easiest, 10 min)

LabOS backend is FastAPI + SQLAlchemy. Cheapest 100% free option that supports persistent processes: **Render** (free tier sleeps after 15 min idle but auto-wakes on request).

### 4a. Render setup

1. Open https://dashboard.render.com → sign in with GitHub (`huhcc87@gmail.com`)
2. Click **+ New** → **Web Service**
3. Connect your `labos-v3` GitHub repo
4. Fill in:
   - **Name**: `labos-api`
   - **Region**: same as Neon (e.g. `Oregon`)
   - **Branch**: `main`
   - **Root directory**: `backend`
   - **Runtime**: Python 3
   - **Build command**: `pip install -r requirements.txt`
   - **Start command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
5. **Instance type**: Free
6. **Environment variables** → click **Advanced** → add these:

   | Key | Value |
   |---|---|
   | `SECRET_KEY` | run `python -c "import secrets; print(secrets.token_urlsafe(32))"` and paste output |
   | `ENVIRONMENT` | `production` |
   | `DATABASE_URL` | paste the Neon URL from Step 2 |
   | `CORS_ORIGINS` | `https://labos-v3.vercel.app,https://your-custom-domain.com` (replace after Vercel deploy) |
   | `STRIPE_SECRET_KEY` | from Step 3 |
   | `ACCESS_TOKEN_EXPIRE_MINUTES` | `120` |
   | `SMTP_HOST` / `SMTP_USER` / `SMTP_PASSWORD` | optional, fill if you want email |

7. Click **Create Web Service**. First build takes ~5 min.
8. Once deployed, your API base URL is `https://labos-api.onrender.com/api`

### 4b. Alternative — Fly.io (no cold starts, $0–5/mo)

```bash
brew install flyctl
cd backend
fly launch  # follow prompts, pick a region
fly secrets set SECRET_KEY=... DATABASE_URL=... STRIPE_SECRET_KEY=...
fly deploy
```

Fly's machines start instantly (no Render-style cold start). Free tier covers ~3 VMs at 256 MB each.

---

## 5️⃣ Deploy the frontend to Vercel (3 min)

1. Open https://vercel.com → sign in with GitHub (`huhcc87@gmail.com`)
2. Click **Add New → Project**
3. Pick your `labos-v3` repo
4. Fill in:
   - **Framework Preset**: Vite (auto-detected)
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build` (auto-filled)
   - **Output Directory**: `dist` (auto-filled)
5. **Environment Variables** → add:

   | Key | Value |
   |---|---|
   | `VITE_API_BASE_URL` | `https://labos-api.onrender.com/api` (or your Fly URL) |
   | `VITE_STRIPE_PUBLISHABLE_KEY` | `pk_test_…` from Step 3 |
   | `VITE_APP_NAME` | `LabOS` |

6. Click **Deploy**. Build takes ~2 min.
7. Your app is live at `https://labos-v3-xxx.vercel.app`

### 5b. Add custom domain (optional)
1. Vercel dashboard → your project → **Settings → Domains**
2. Add your domain (e.g. `app.yourdomain.com`)
3. Vercel shows you DNS records to add at your registrar (CNAME or A record)
4. SSL is automatic

### 5c. Update backend CORS
Once Vercel gives you the live URL, go back to **Render → Environment** and update:
```
CORS_ORIGINS=https://labos-v3-xxx.vercel.app,https://app.yourdomain.com
```
Render auto-redeploys when you save env vars.

---

## 6️⃣ Configure Stripe webhooks (optional, for charge confirmations)

1. Stripe Dashboard → **Developers → Webhooks** → **+ Add endpoint**
2. **Endpoint URL**: `https://labos-api.onrender.com/api/payments/webhook` (you may need to add this endpoint to your backend later)
3. **Events**: `payment_intent.succeeded`, `payment_intent.payment_failed`, `setup_intent.succeeded`
4. Copy the **Signing secret** (starts with `whsec_…`) → paste into Render env as `STRIPE_WEBHOOK_SECRET`

---

## 7️⃣ Update the browser extension for production

The extension currently defaults to `http://localhost:8000/api`. Users can change it via the Options page, but you can also bake your production URL in.

### Option A — users set it themselves (recommended)
Users click the extension → ⚙ Options → paste `https://labos-api.onrender.com/api`. Already supported.

### Option B — change the default
Edit `extension/background.js`:
```js
const DEFAULT_API_BASE = 'https://labos-api.onrender.com/api';
```
Then re-package:
```bash
cd extension && ./package.sh chrome
```
Upload the new zip to Chrome Web Store (Package tab) and submit for re-review.

---

## 8️⃣ Initial superadmin user (one-time)

After backend is deployed, you need to create the first admin account. SSH into your Render instance or use the Render shell:

```bash
# Render dashboard → your service → Shell tab
python -c "
from app.core.database import SessionLocal
from app.models.models import User, UserRole
from passlib.hash import bcrypt
db = SessionLocal()
u = User(
    email='huhcc87@gmail.com',
    full_name='You',
    hashed_password=bcrypt.hash('change-me-now'),
    role=UserRole.superadmin,
)
db.add(u); db.commit()
print('superadmin created')
"
```

Now log into your Vercel app with `huhcc87@gmail.com` / `change-me-now` and immediately change the password in **Profile → Change password**.

---

## 9️⃣ Lab Members (PI access control)

In LabOS → **Admin → Lab Members (PI)**:

1. As superadmin/admin, go to **Org & Sites** and create a **Site** + **LabUnit**
2. Edit the LabUnit and set `pi_user_id` to the PI's user ID
3. The PI now sees **Lab Members** in their sidebar and can:
   - Invite new members by email
   - Approve users who request to join
   - Set per-lab roles (member, manager, observer)
   - Revoke access

Users can also self-request access via the same page — PI sees them in **"Pending PI approval"** banner.

---

## 🔟 Optional Convex integration

Convex (https://convex.dev) is a real-time backend-as-a-service. LabOS doesn't depend on it, but if you want to add real-time features (live cart sync across users, live IoT sensor updates, etc.), you'd:

1. `npm install convex` in `frontend/`
2. `npx convex dev` → creates a `convex/` folder
3. Add Convex schemas for the real-time stuff
4. The frontend subscribes to Convex queries via `useQuery()` hooks

For now this isn't wired in — LabOS uses polling (5-second refresh) for cart sync, which is simpler and works fine at lab scale. Tell me if you want Convex added.

---

## 1️⃣1️⃣ Monitoring + alerts

| Service | Purpose | Free tier |
|---|---|---|
| **Sentry** | Error tracking (catches uncaught exceptions in frontend + backend) | 5k events/mo |
| **Uptime Robot** | Pings your API every 5 min, emails if down | Yes |
| **Vercel Analytics** | Page views + Core Web Vitals | Yes |
| **Render metrics** | CPU/memory of backend | Built in |

Sign-up takes 2 min each.

---

## 1️⃣2️⃣ Final smoke test (before sharing the URL)

1. ✅ Open Vercel URL → login page renders
2. ✅ Create your superadmin account (Step 8)
3. ✅ Log in → Dashboard loads with real data from Neon
4. ✅ Create a sample lab, set a PI, invite a member
5. ✅ Add a few inventory items → confirm they persist after refresh (proves Neon is working)
6. ✅ Open LabHuddle → "Start Video Call" → confirm WebSocket connects
7. ✅ Open Reagent Cart → confirm it loads (will be empty)
8. ✅ Install the extension → set API URL to your Render backend → test capture on Sigma
9. ✅ Trigger a Stripe test payment from Reagent Cart → confirm it appears in Stripe Dashboard

---

## 🧾 Cost estimate at different scales

### Pay-as-you-go stack (Cloudflare Pages + Fly.io + Neon) — RECOMMENDED

| Stage | Users | Frontend | Backend | Database | File storage | **Total** |
|---|---|---|---|---|---|---|
| **Personal lab** | 1–5 | $0 (CF Pages) | $0 (Fly idle) | $0 (Neon free) | $0 (R2 free) | **$0/mo** |
| **Single research lab** | 10–30 | $0 (CF Pages) | $1–3 (Fly per-sec) | $1–4 (Neon usage) | $0 (R2 free) | **$2–7/mo** |
| **Multi-lab institute** | 50–200 | $0 (CF Pages) | $4–10 (Fly) | $8–15 (Neon) | $0–3 (R2) | **$12–28/mo** |
| **Heavy use w/ AI** | 200+ | $0 | $15–30 | $20–40 | $5–10 | **$40–80/mo** |

### Subscription stack (Vercel + Render + Neon) — comparison only

| Stage | Users | Hosting | Database | **Total** |
|---|---|---|---|---|
| **Personal lab** | 1–5 | Vercel free + Render free | Neon free | **$0/mo** |
| **Single research lab** | 10–30 | Vercel free + Render starter ($7) | Neon Launch ($19) | **$26/mo** |
| **Multi-lab institute** | 50–200 | Vercel Pro ($20) + Render pro ($25) | Neon Scale ($69) | **$114/mo** |

### Per-usage costs that scale with activity (any stack)

| Service | What you pay for | Rate |
|---|---|---|
| **Stripe** | Payment processing | 2.9% + $0.30 per transaction |
| **Twilio** | SMS alerts | $0.0079 per SMS (US) |
| **Resend** | Emails after 3k/mo free | $0.0001 per email (~$1 per 10k) |
| **OpenAI / Anthropic** | AI assistant calls | $0.003 per 1K tokens (~$0.03 per protocol draft) |

A 30-person lab firing 5 protocols/day through AI + 100 emails/day pays about **$3/mo extra** for those services on top of hosting.

---

## 🆘 Troubleshooting

| Problem | Fix |
|---|---|
| Vercel build fails: "Cannot find module" | Make sure `Root Directory` is set to `frontend` |
| Render build fails: pip errors | Check `backend/requirements.txt` is committed |
| Frontend loads but API calls fail with CORS error | Add Vercel URL to `CORS_ORIGINS` on Render |
| Frontend loads but login fails: "Network Error" | `VITE_API_BASE_URL` is wrong; check it on Vercel |
| Render service keeps restarting | Check Render logs; usually missing env var |
| Database connection error | Make sure URL uses `postgresql+psycopg://` not `postgresql://` |
| Stripe 401 | Wrong key or test/live mismatch — both keys must be same mode |
| Extension can't reach API | CORS — add `chrome-extension://<your-extension-id>` to `CORS_ORIGINS` |

---

## 📞 Per-service support

- **Neon**: discord.gg/neondatabase
- **Vercel**: vercel.com/help
- **Render**: render.com/docs
- **Stripe**: support@stripe.com
- **Fly.io**: community.fly.io
