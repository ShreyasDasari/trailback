# 11 — Environment & DevOps
**Project:** Trailback
**Last Updated:** February 2026

---

## 1. Environment Overview

| Environment | Frontend | Backend | Database | Purpose |
|-------------|----------|---------|----------|---------|
| **Local** | `localhost:3000` | `localhost:8000` | Supabase cloud (free project) | Daily development |
| **Preview** | Vercel PR preview URL | Render (same service, branch deploy) | Supabase cloud (same project) | PR review, QA |
| **Production** | `app.trailback.ai` (Vercel) | `api.trailback.ai` (Render) | Supabase cloud (free project) | Live users |

> Note: At MVP scale, local, preview, and production all use the **same Supabase project** to avoid needing a second free-tier instance. Staging isolation is handled by separate `test_` prefixed tables during automated tests (see doc-12).

---

## 2. Required Accounts & Setup

| Service | Action | URL |
|---------|--------|-----|
| GitHub | Create repo `trailback`, set to public (for free Actions) | github.com |
| Supabase | Create project, copy URL + anon key + service key | supabase.com |
| Google Cloud Console | Enable Gmail API, Google Docs API, Drive API; create OAuth 2.0 credentials | console.cloud.google.com |
| Slack API | Create Slack App, add scopes: `chat:write`, `chat:delete`, `channels:history` | api.slack.com/apps |
| Upstash | Create Redis database, copy REST URL + token | upstash.com |
| Vercel | Connect GitHub repo, configure env vars | vercel.com |
| Render | Create Web Service from GitHub repo, configure env vars | render.com |
| Sentry | Create two projects: `trailback-backend`, `trailback-frontend` | sentry.io |

---

## 3. Environment Variables

### 3.1 Backend (`apps/backend/.env`)

```bash
# ── Supabase ───────────────────────────────────────────────
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...          # For client-side operations
SUPABASE_SERVICE_KEY=eyJhbGc...       # For server-side RLS bypass (NEVER expose)

# ── Redis (Upstash) ────────────────────────────────────────
UPSTASH_REDIS_URL=redis://default:xxx@xxx.upstash.io:6379

# ── Google OAuth ───────────────────────────────────────────
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxx

# ── Slack OAuth ────────────────────────────────────────────
SLACK_CLIENT_ID=xxx
SLACK_CLIENT_SECRET=xxx
SLACK_BOT_TOKEN=xoxb-xxx               # For rollback operations

# ── Application ────────────────────────────────────────────
ENVIRONMENT=development               # development | production
JWT_SECRET=your-supabase-jwt-secret   # From Supabase project settings
ALLOWED_ORIGINS=http://localhost:3000,https://app.trailback.ai

# ── Sentry ─────────────────────────────────────────────────
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
```

### 3.2 Frontend (`apps/web/.env.local`)

```bash
# ── Supabase (public — safe to expose) ────────────────────
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...

# ── Backend API ────────────────────────────────────────────
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1  # dev
# NEXT_PUBLIC_API_URL=https://api.trailback.ai/api/v1  # prod

# ── Sentry (public) ────────────────────────────────────────
NEXT_PUBLIC_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx

# ── Feature Flags ──────────────────────────────────────────
NEXT_PUBLIC_FEATURE_LLM_SUMMARY=false
NEXT_PUBLIC_FEATURE_TEAMS=false
```

### 3.3 Chrome Extension (`apps/extension/.env`)

```bash
# ── Backend ────────────────────────────────────────────────
VITE_API_URL=http://localhost:8000/api/v1   # dev
# VITE_API_URL=https://api.trailback.ai/api/v1  # prod

# ── Google OAuth (Extension Identity) ─────────────────────
VITE_GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
```

### 3.4 `.env.example` (committed to repo)

```bash
# Copy this file to .env and fill in your values.
# Never commit .env files with real secrets.

SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=
UPSTASH_REDIS_URL=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
SLACK_CLIENT_ID=
SLACK_CLIENT_SECRET=
SLACK_BOT_TOKEN=
SENTRY_DSN=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_API_URL=
```

---

## 4. GitHub Actions CI/CD

### 4.1 CI Pipeline (`.github/workflows/ci.yml`)

Runs on every PR and push to `main`. Blocks merge on failure.

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  backend-tests:
    name: Backend — pytest
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: apps/backend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
          cache: 'pip'
      - run: pip install -r requirements.txt -r requirements-dev.txt
      - run: pytest tests/ --cov=. --cov-report=xml -v
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
          UPSTASH_REDIS_URL: ${{ secrets.UPSTASH_REDIS_URL }}
          ENVIRONMENT: test
      - uses: codecov/codecov-action@v4

  frontend-lint:
    name: Frontend — lint + type-check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter web lint
      - run: pnpm --filter web type-check
      - run: pnpm --filter types build
```

### 4.2 Frontend Deploy (`.github/workflows/deploy-web.yml`)

Triggers on push to `main`. Deploys Next.js to Vercel production.

```yaml
name: Deploy — Web (Vercel)

on:
  push:
    branches: [main]
    paths:
      - 'apps/web/**'
      - 'packages/**'

env:
  VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
  VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with:
          version: 9
      - run: npm install -g vercel@latest
      - run: vercel pull --yes --environment=production --token=${{ secrets.VERCEL_TOKEN }}
      - run: vercel build --prod --token=${{ secrets.VERCEL_TOKEN }}
      - run: vercel deploy --prebuilt --prod --token=${{ secrets.VERCEL_TOKEN }}
```

### 4.3 Backend Deploy (`.github/workflows/deploy-backend.yml`)

Triggers on push to `main`. Triggers Render deploy via webhook.

```yaml
name: Deploy — Backend (Render)

on:
  push:
    branches: [main]
    paths:
      - 'apps/backend/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Render Deploy
        run: |
          curl -X POST "${{ secrets.RENDER_DEPLOY_HOOK_URL }}"
```

### 4.4 Keep-Alive Cron (`.github/workflows/keepalive.yml`)

Pings the backend health endpoint every 14 minutes to prevent Render free tier cold starts.

```yaml
name: Keep Backend Alive

on:
  schedule:
    - cron: '*/14 * * * *'   # Every 14 minutes

jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - name: Ping health endpoint
        run: curl --fail https://api.trailback.ai/api/v1/health
```

---

## 5. Vercel Configuration

### `apps/web/vercel.json`
```json
{
  "framework": "nextjs",
  "buildCommand": "pnpm build",
  "outputDirectory": ".next",
  "installCommand": "pnpm install",
  "regions": ["iad1"]
}
```

### Required Vercel Secrets
Set these in the Vercel project dashboard under Settings → Environment Variables:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_API_URL         = https://api.trailback.ai/api/v1
NEXT_PUBLIC_SENTRY_DSN
NEXT_PUBLIC_FEATURE_LLM_SUMMARY = false
NEXT_PUBLIC_FEATURE_TEAMS   = false
```

---

## 6. Render Configuration

### `apps/backend/render.yaml`
```yaml
services:
  - type: web
    name: trailback-backend
    runtime: python
    buildCommand: pip install -r requirements.txt
    startCommand: uvicorn main:app --host 0.0.0.0 --port $PORT
    envVars:
      - key: ENVIRONMENT
        value: production
      - key: SUPABASE_URL
        sync: false
      - key: SUPABASE_SERVICE_KEY
        sync: false
      - key: UPSTASH_REDIS_URL
        sync: false
      - key: GOOGLE_CLIENT_ID
        sync: false
      - key: GOOGLE_CLIENT_SECRET
        sync: false
      - key: SLACK_CLIENT_ID
        sync: false
      - key: SLACK_CLIENT_SECRET
        sync: false
      - key: SLACK_BOT_TOKEN
        sync: false
      - key: SENTRY_DSN
        sync: false
      - key: ALLOWED_ORIGINS
        value: https://app.trailback.ai
    healthCheckPath: /api/v1/health
```

### `apps/backend/Procfile`
```
web: uvicorn main:app --host 0.0.0.0 --port $PORT
worker: celery -A workers.celery_app worker --loglevel=info
```

---

## 7. Secrets Management

| Secret | Where Stored | Who Can Access |
|--------|-------------|----------------|
| Supabase service key | GitHub Secrets + Render Env Vars | Backend only |
| Google OAuth credentials | GitHub Secrets + Render Env Vars | Backend only |
| Slack bot token | GitHub Secrets + Render Env Vars | Backend only |
| Vercel token | GitHub Secrets | CI/CD only |
| Render deploy hook | GitHub Secrets | CI/CD only |
| Supabase anon key | Vercel Env Vars + `.env.local` | Frontend (public) |

**Rules:**
- Never commit `.env` files. `.env.example` only.
- Never log secrets in application code or CI outputs.
- Never expose `SUPABASE_SERVICE_KEY` to the frontend.
- Rotate all secrets quarterly.

---

## 8. Observability

### Sentry (Error Monitoring)

**Backend setup:**
```python
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration

sentry_sdk.init(
    dsn=os.environ["SENTRY_DSN"],
    integrations=[FastApiIntegration()],
    environment=os.environ.get("ENVIRONMENT", "development"),
    traces_sample_rate=0.1,
)
```

**Frontend setup:**
```typescript
// app/layout.tsx
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
});
```

### Key Alerts to Configure in Sentry
- Error rate > 5% on `POST /events` (5-minute window) → email alert
- Error rate > 20% on `POST /rollback/*` → email alert
- Any new error type in production → email alert

### Logs (Render)
Render provides built-in log streaming. No additional log service needed.
Access: Render Dashboard → Service → Logs.

---

## 9. Database Maintenance

All automated via Supabase:

| Task | Mechanism | Schedule |
|------|-----------|----------|
| 7-day event retention cleanup | Supabase Edge Function | Daily at 02:00 UTC |
| Database backups | Supabase automatic (free tier: 1 backup/day, 1 day retention) | Daily |
| Realtime log pruning | Supabase internal | Automatic |

**Retention cron (Supabase Edge Function):**
```typescript
// supabase/functions/cleanup-events/index.ts
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const RETENTION_DAYS = 7

Deno.serve(async () => {
  const { error } = await supabase
    .from('events')
    .delete()
    .lt('created_at', new Date(Date.now() - RETENTION_DAYS * 86400000).toISOString())

  if (error) return new Response(error.message, { status: 500 })
  return new Response('Cleanup complete', { status: 200 })
})
```
