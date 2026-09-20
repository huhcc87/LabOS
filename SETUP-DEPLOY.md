# 🚀 LabOS — Sequential Production Setup

**Follow these 7 steps in order.** Total time: ~45 min. Total cost: $0–2/mo.

```
GitHub → Cloudflare Pages → Neon → Fly.io → R2 → Resend → Stripe
```

Before you start, you'll need: a credit card on file at Fly.io (they bill
per-second, often $0/mo). Everything else is sign-up only.

---

## ⛔ PREREQUISITE — rotate exposed secrets first

I found a live OpenAI API key in your `backend/.env` file. **Before pushing
to GitHub:**

1. Open https://platform.openai.com/api-keys
2. Find the key starting with `sk-proj-zlfhWn1SC6qb4aKBwmt...` and click **Revoke**
3. Generate a new key — save it somewhere safe (you'll use it in Fly.io secrets, not in code)

Your `.gitignore` (just created) keeps `.env` out of git, but the old key
should still be rotated since it was visible during our session.

---

## ✅ Step 1 — Push code to GitHub (5 min)

```bash
cd "/Users/mudasirrashid/Documents/app/1.. lab_management_system_v2"

# Install GitHub CLI if you don't have it
brew install gh
gh auth login   # follow prompts, use huhcc87@gmail.com

# Verify what would be committed (should NOT include .env or lab.db)
git status

# First commit
git add .
git commit -m "Initial LabOS v3 production-ready commit"

# Create the private repo and push
gh repo create labos-v3 --private --source=. --push
```

✅ **Verification:** Open https://github.com/huhcc87/labos-v3 — you should see your code.
Open `backend/.env` in the GitHub UI — it should say **"not found"** (because `.gitignore` excludes it).

---

## ✅ Step 2 — Set up Neon Postgres (5 min, free)

1. Open https://console.neon.tech and sign up with GitHub (`huhcc87@gmail.com`)
2. Click **Create Project**:
   - **Project name**: `labos`
   - **Database name**: `labos`
   - **Region**: pick nearest to you (e.g. `US East (Virginia)`)
3. After it's created, click **Connection Details**
4. Copy the **Connection string**. It looks like:
   ```
   postgresql://neondb_owner:abc123XYZ@ep-cool-mountain-123.us-east-2.aws.neon.tech/labos?sslmode=require
   ```
5. **Change `postgresql://` to `postgresql+psycopg://`** (SQLAlchemy needs this prefix):
   ```
   postgresql+psycopg://neondb_owner:abc123XYZ@ep-cool-mountain-123.us-east-2.aws.neon.tech/labos?sslmode=require
   ```
6. **Save this string somewhere safe.** You'll paste it into Fly.io in Step 4.

✅ **Verification:** Click **SQL Editor** in Neon → run `SELECT 1;` → should return `1`.

---

## ✅ Step 3 — Set up Resend for emails (3 min, free)

1. Open https://resend.com/signup → sign in with GitHub
2. Click **API Keys** in the sidebar → **Create API Key**
3. Name: `labos-production`
4. Permission: **Full access**
5. Copy the key (starts with `re_...`) — **save it, you can't view it again**
6. **Domain setup** (optional, for nicer "from" address):
   - Click **Domains** → **Add Domain** → enter your domain
   - Add the DNS records they show you (MX + TXT) at your domain registrar
   - Verifies in ~5 minutes
   - If you skip this, emails will send from `onboarding@resend.dev` (works fine for testing)

✅ **Verification:** Resend dashboard → **Logs** tab is empty (will fill once Fly.io is deployed).

---

## ✅ Step 4 — Deploy backend to Fly.io (10 min)

### 4a. Install Fly CLI

```bash
brew install flyctl
fly auth signup   # sign up with GitHub (huhcc87@gmail.com)
                  # OR `fly auth login` if you already have an account
```

### 4b. Launch the app (don't deploy yet)

```bash
cd "/Users/mudasirrashid/Documents/app/1.. lab_management_system_v2/backend"

# This reads fly.toml (already created) and registers your app
fly launch --no-deploy --copy-config --name labos-api
```

When prompted:
- **"Would you like to set up a Postgresql database?"** → **No**
- **"Would you like to set up an Upstash Redis database?"** → **No**

If `labos-api` is taken, try `labos-api-huhcc87`.

### 4c. Set secrets (one command — paste your actual values)

```bash
# Generate a fresh SECRET_KEY
SECRET=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")

fly secrets set \
  SECRET_KEY="$SECRET" \
  ENVIRONMENT="production" \
  DATABASE_URL="postgresql+psycopg://neondb_owner:YOUR_NEON_PASSWORD@ep-xxx.neon.tech/labos?sslmode=require" \
  RESEND_API_KEY="re_YOUR_RESEND_KEY" \
  STRIPE_SECRET_KEY="sk_test_YOUR_STRIPE_TEST_KEY" \
  CORS_ORIGINS="https://labos-v3.pages.dev"
```

> Use Stripe **test** keys (`sk_test_...`) until you're done testing the checkout flow, then swap to live keys later.

### 4d. Deploy

```bash
fly deploy
```

First deploy takes ~3-5 min. Wait for:
```
✓ Machine ... is now running
✓ Deployed to https://labos-api.fly.dev
```

### 4e. Verify it works

```bash
curl https://labos-api.fly.dev/api/health
# Should print: {"status":"ok","version":"v3"}
```

Also check that the machine auto-stops when idle:
```bash
fly status
# Look for "auto_stop_machines = stop" — that confirms pay-per-second is enabled
```

---

## ✅ Step 5 — Set up Cloudflare R2 for file uploads (5 min, free)

1. Open https://dash.cloudflare.com/sign-up — sign up if you don't have an account
2. Once signed in, click **R2 Object Storage** in left sidebar
3. Click **Create bucket**
4. Bucket name: `labos-uploads`
5. Region: **Automatic**
6. Click **Create**

7. Now **create an API token**:
   - Top right → **Manage R2 API tokens** → **Create API token**
   - Name: `labos-backend`
   - Permissions: **Object Read & Write**
   - Specify bucket: `labos-uploads`
   - **Create API Token**
   - **Copy** both `Access Key ID` and `Secret Access Key` — you won't see them again

8. Note the **endpoint URL** shown — it looks like:
   ```
   https://abc123def456.r2.cloudflarestorage.com
   ```

9. (Optional) Enable public access for the bucket:
   - Bucket → **Settings** → **Public R2.dev Bucket** → **Allow Access**
   - Note the public URL: `https://pub-XXX.r2.dev`

10. **Add R2 secrets to Fly.io:**
    ```bash
    cd "/Users/mudasirrashid/Documents/app/1.. lab_management_system_v2/backend"
    fly secrets set \
      R2_ACCESS_KEY_ID="your_access_key" \
      R2_SECRET_ACCESS_KEY="your_secret" \
      R2_BUCKET="labos-uploads" \
      R2_ENDPOINT="https://abc123def456.r2.cloudflarestorage.com" \
      R2_PUBLIC_URL="https://pub-XXX.r2.dev"
    ```

Fly auto-redeploys when you set secrets.

✅ **Verification:** New uploads through LabOS will now route to R2 instead of local disk (the `storage.py` module checks `R2_ACCESS_KEY_ID` and falls back to local if unset).

---

## ✅ Step 6 — Deploy frontend to Cloudflare Pages (5 min, free forever)

1. https://dash.cloudflare.com → **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**
2. Authorize Cloudflare to read your GitHub
3. Select **labos-v3** repo
4. Build configuration:
   | Field | Value |
   |---|---|
   | **Project name** | `labos-v3` |
   | **Production branch** | `main` |
   | **Framework preset** | None (Vite) |
   | **Build command** | `npm run build` |
   | **Build output directory** | `dist` |
   | **Root directory** | `frontend` |

5. **Environment variables** → add:
   | Variable name | Value |
   |---|---|
   | `VITE_API_BASE_URL` | `https://labos-api.fly.dev/api` |
   | `VITE_STRIPE_PUBLISHABLE_KEY` | `pk_test_...` (from Stripe dashboard) |
   | `VITE_APP_NAME` | `LabOS` |
   | `NODE_VERSION` | `20` |

6. Click **Save and Deploy**. Build takes ~2 min.

7. Once deployed, your URL is `https://labos-v3.pages.dev`

8. **Update the backend CORS** to include this URL:
    ```bash
    cd backend
    fly secrets set CORS_ORIGINS="https://labos-v3.pages.dev,https://labos-v3-preview.pages.dev"
    ```
    (The second one allows preview deployments from feature branches.)

✅ **Verification:** Open `https://labos-v3.pages.dev` — you should see the LabOS login page.

---

## ✅ Step 7 — Create your superadmin account (2 min)

The database is empty. Create the first admin user via Fly's SSH:

```bash
fly ssh console
```

Once inside the container:

```bash
python << 'EOF'
from app.core.database import SessionLocal
from app.models.models import User, UserRole
from passlib.hash import bcrypt
from datetime import datetime

db = SessionLocal()
u = User(
    email='huhcc87@gmail.com',
    full_name='Mudasir Rashid',
    hashed_password=bcrypt.hash('CHANGE-ME-NOW-2026'),
    role=UserRole.superadmin,
    is_active=True,
    must_change_password=True,
    created_at=datetime.utcnow(),
)
db.add(u)
db.commit()
print(f'✓ Superadmin created: {u.email}')
EOF

exit
```

Now log into your live app:
1. Open `https://labos-v3.pages.dev`
2. Login: `huhcc87@gmail.com` / `CHANGE-ME-NOW-2026`
3. You'll be prompted to change the password — set a strong one
4. You're now the superadmin of the live LabOS

---

## 🎉 You're live

```
Frontend:    https://labos-v3.pages.dev
Backend:     https://labos-api.fly.dev
Database:    Neon Postgres (autoscales to zero)
File store:  Cloudflare R2
Email:       Resend
Payments:    Stripe (your existing account)
```

**Expected monthly cost for 1 hour/day usage: under $1.**

---

## 🔁 Updating the live app

After making any code change locally:

```bash
git add .
git commit -m "what changed"
git push
```

Both Cloudflare Pages AND Fly.io watch your GitHub repo and auto-deploy on push.

- Cloudflare Pages: triggers automatically (~2 min build)
- Fly.io: doesn't auto-deploy by default. Add this once:

```bash
cd backend
# Generate a Fly deploy token
fly tokens create deploy
# Copy the output (starts with "FlyV1 fm2_lJ...")
```

Then in GitHub → your repo → **Settings → Secrets and variables → Actions** → add a secret:
- Name: `FLY_API_TOKEN`
- Value: the token you just generated

Create `.github/workflows/fly-deploy.yml` in your repo:
```yaml
name: Fly Deploy
on:
  push:
    branches: [main]
    paths: ['backend/**']
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: superfly/flyctl-actions/setup-flyctl@master
      - run: flyctl deploy --remote-only
        working-directory: ./backend
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
```

Now every push to `main` that changes anything under `backend/` auto-deploys to Fly.

---

## 🆘 If something breaks

| Symptom | Quick fix |
|---|---|
| `fly deploy` fails on `pip install` | Add `psycopg[binary]` to requirements.txt (already done in v3) |
| Frontend loads, login fails with "Network Error" | Run `fly secrets list` — check `CORS_ORIGINS` includes your Pages URL |
| 500 error on every API call | Check `fly logs` — usually `DATABASE_URL` typo or wrong prefix |
| Login works but data doesn't save | DB is read-only? Confirm Neon database accepts your credentials |
| File upload fails | `fly logs` will show R2 errors — usually wrong endpoint URL |
| Stripe checkout fails | Test mode key in backend but live key in frontend (or vice versa) — they must match modes |
| Emails don't arrive | Check Resend logs at https://resend.com/logs — verify domain is verified |

For everything else, share the `fly logs` output and I'll diagnose.

---

## 📊 What you'll see in your bills

- **Cloudflare**: $0 (always)
- **Neon**: $0 in free tier, ~$0.50/mo at usage
- **Fly.io**: $0.10–0.50/mo for 1hr/day backend use
- **Resend**: $0 (3k free emails/mo)
- **R2**: $0 (10 GB free)
- **Stripe**: only per-transaction fees (2.9% + $0.30)

Total: **expect $0.50–2/mo** for steady single-lab usage.
