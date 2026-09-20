# LabOS v3 — Production Deployment Guide

Step-by-step instructions for every pre-production task. Follow in order.

---

## 1. PostgreSQL Database (replace SQLite)

SQLite is fine for local development but **not for production**: Fly.io machines have an ephemeral filesystem (data is lost on restart unless you mount a volume), and SQLite has no safe concurrent write support across workers.

### Recommended: Neon (free, serverless Postgres)

1. Go to [console.neon.tech](https://console.neon.tech) → create a free project called `labos`
2. Click **Connection Details** → copy the **psycopg3** connection string:
   ```
   postgresql+psycopg://neondb_owner:PASSWORD@ep-cool-name-12345.us-east-2.aws.neon.tech/labos?sslmode=require
   ```
3. Install the Python driver (already in requirements.txt via psycopg):
   ```bash
   pip install "psycopg[binary]"
   ```
4. Run the schema migration against Neon **once** before first deploy:
   ```bash
   DATABASE_URL="postgresql+psycopg://..." python -c "
   from app.core.database import Base, engine
   Base.metadata.create_all(bind=engine)
   print('Schema created.')
   "
   ```
5. Seed demo accounts (optional):
   ```bash
   DATABASE_URL="postgresql+psycopg://..." python seed.py
   ```

### Alternative: Fly Postgres (co-located, lower latency)

```bash
fly postgres create --name labos-db --region iad --initial-cluster-size 1 --vm-size shared-cpu-1x --volume-size 1
fly postgres attach labos-db --app labos-api
# Fly automatically sets DATABASE_URL in your app's environment
```

### Alternative: Supabase

1. [app.supabase.com](https://app.supabase.com) → New project → copy **URI** from Settings → Database
2. Replace `postgresql://` with `postgresql+psycopg://` in the URL

---

## 2. CORS Origins

Your production frontend has a different domain than `localhost`. Add it to `CORS_ORIGINS`.

### If deploying frontend to Vercel

```bash
# In your Fly.io backend secrets (see section 4):
fly secrets set CORS_ORIGINS="https://your-app.vercel.app,https://yourdomain.com"
```

### If self-hosting frontend

```bash
fly secrets set CORS_ORIGINS="https://yourdomain.com"
```

Multiple domains are comma-separated. The backend's `config.py` parses both JSON arrays and comma-separated strings so either format works:

```env
# .env (local dev — both formats work)
CORS_ORIGINS=http://localhost:5173,https://yourapp.vercel.app
# or
CORS_ORIGINS=["http://localhost:5173","https://yourapp.vercel.app"]
```

---

## 3. Rotate Your OpenAI API Key

Your current key in `backend/.env` may have been stored in git history from earlier sessions. Rotate it now:

1. Go to [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Click **Revoke** on the existing key
3. Click **Create new secret key** → copy it
4. Update your local `backend/.env`:
   ```env
   OPENAI_API_KEY=sk-proj-YOUR-NEW-KEY
   ```
5. Set it as a Fly secret (do NOT put it in fly.toml):
   ```bash
   fly secrets set OPENAI_API_KEY="sk-proj-YOUR-NEW-KEY" --app labos-api
   ```

> The key stays server-side only — it is never sent to the frontend bundle.

---

## 4. Fly.io Secrets (all sensitive env vars)

**Never put secrets in `fly.toml`** — that file is committed to git. Use `fly secrets set` instead.

Set all required secrets in one go:

```bash
# Generate a fresh SECRET_KEY
python -c "import secrets; print(secrets.token_urlsafe(48))"

fly secrets set \
  SECRET_KEY="<generated-above>" \
  DATABASE_URL="postgresql+psycopg://user:pass@host/labos?sslmode=require" \
  OPENAI_API_KEY="sk-proj-..." \
  CORS_ORIGINS="https://yourapp.vercel.app" \
  ENVIRONMENT="production" \
  --app labos-api
```

Optional secrets (only set if you use them):

```bash
fly secrets set \
  SMTP_HOST="smtp.sendgrid.net" \
  SMTP_USER="apikey" \
  SMTP_PASSWORD="SG.YOUR-SENDGRID-KEY" \
  SMTP_FROM="noreply@yourdomain.com" \
  --app labos-api
```

### First deploy

```bash
cd backend
fly launch          # first time — creates the app
fly deploy          # subsequent deploys
fly logs            # tail live logs
fly status          # check machine health
```

### Verify secrets are loaded (never logs values)

```bash
fly secrets list --app labos-api
```

---

## 5. Frontend Production Build (Vercel / Netlify)

The frontend needs to know where the backend lives at **build time**, not runtime.

### Vercel (recommended)

1. Push your repo to GitHub
2. [vercel.com](https://vercel.com) → New Project → import repo → set **Root Directory** to `frontend`
3. Add environment variable in Vercel dashboard → **Settings → Environment Variables**:
   ```
   VITE_API_BASE_URL = https://labos-api.fly.dev/api
   ```
4. Vercel auto-deploys on every push to `main`

### Netlify

1. New site → import from Git → **Base directory**: `frontend`
2. **Build command**: `npm run build`
3. **Publish directory**: `frontend/dist`
4. **Environment variables** → add:
   ```
   VITE_API_BASE_URL = https://labos-api.fly.dev/api
   ```

### Manual build

```bash
cd frontend
VITE_API_BASE_URL=https://labos-api.fly.dev/api npm run build
# Upload dist/ to any static host (S3, Cloudflare Pages, etc.)
```

### Remove the Vite dev proxy for production

The `vite.config.ts` proxy (`/api → 127.0.0.1:8000`) only applies to `npm run dev`. Production builds use the `VITE_API_BASE_URL` env var directly. No config change needed — it's already set up correctly in `frontend/src/lib/api.ts`.

---

## 6. Rate Limiting — Redis for Multi-Worker Deployments

The current rate limiter uses an **in-memory Python dict** (`_rate_buckets` in `security_middleware.py`). This means:

- ✅ Works perfectly for a **single Fly.io machine** with 1 uvicorn worker
- ❌ Resets on every restart (window slides from zero after a deploy)
- ❌ Each worker has its own bucket if you run `--workers 2+`

### When you need Redis-backed rate limiting

Only upgrade if you:
- Scale to 2+ uvicorn workers, OR
- Run 2+ Fly.io machines, OR
- Need rate limits to survive rolling deploys

### How to add Redis (when ready)

**1. Add a Redis instance (Upstash — free 10k requests/day)**

```bash
# Install Upstash CLI or use their dashboard at upstash.com
# Copy the Redis URL: rediss://default:TOKEN@region.upstash.io:6379
fly secrets set REDIS_URL="rediss://default:TOKEN@region.upstash.io:6379" --app labos-api
```

**2. Install redis-py**

```bash
pip install redis
# Add to requirements.txt:  redis>=5.0
```

**3. Replace the in-memory dict in `backend/app/core/security_middleware.py`**

```python
# At top of file, replace:
from collections import defaultdict, deque
_rate_buckets: dict[str, deque] = defaultdict(deque)

# With:
import redis, os, time
_redis = redis.from_url(os.getenv("REDIS_URL", "")) if os.getenv("REDIS_URL") else None

# Then replace the bucket logic in RateLimitMiddleware.dispatch():
if _redis:
    key = f"rl:{client_ip}"
    pipe = _redis.pipeline()
    now = int(time.time())
    pipe.zadd(key, {str(now): now})
    pipe.zremrangebyscore(key, 0, now - window_seconds)
    pipe.zcard(key)
    pipe.expire(key, window_seconds)
    _, _, count, _ = pipe.execute()
    if count > max_requests:
        # return 429 response
else:
    # fall back to existing in-memory logic
    pass
```

For single-machine deployments, the current in-memory implementation is completely fine and has zero infrastructure cost.

---

## Deployment Checklist

```
[ ] Neon / Fly Postgres provisioned
[ ] DATABASE_URL set in fly secrets
[ ] Schema created against production DB (create_all or seed.py)
[ ] SECRET_KEY rotated and set in fly secrets (never in fly.toml)
[ ] OPENAI_API_KEY rotated and set in fly secrets
[ ] CORS_ORIGINS includes production frontend URL
[ ] VITE_API_BASE_URL set in Vercel/Netlify build env
[ ] fly deploy completed successfully
[ ] fly logs shows "Application startup complete" with no errors
[ ] Login works on production URL
[ ] /api/health returns {"status": "running"}
```
