# 07 — Monorepo Structure
**Project:** Trailback
**Tooling:** Turborepo + pnpm workspaces (JS) + Python venv (backend)
**Last Updated:** February 2026

---

## 1. Why a Monorepo

Trailback has three distinct apps that share types, utilities, and config:
- **`apps/web`** — Next.js dashboard
- **`apps/extension`** — Chrome MV3 extension
- **`apps/backend`** — FastAPI Python API

A monorepo gives us:
- **Shared TypeScript types** between the extension and the dashboard (event shapes, risk levels)
- **Single source of truth** for API contracts (`packages/types`)
- **Unified CI/CD** — one GitHub Actions workflow, one repo, one PR process
- **Atomic commits** — a feature touching extension + backend + dashboard is one PR

---

## 2. Top-Level Directory Tree

```
trailback/                          ← Git root
│
├── apps/
│   ├── web/                        ← Next.js 14 dashboard
│   ├── extension/                  ← Chrome MV3 extension
│   └── backend/                    ← FastAPI Python API
│
├── packages/
│   ├── types/                      ← Shared TypeScript types
│   ├── ui/                         ← Shared React components
│   └── config/                     ← Shared ESLint / TSConfig
│
├── docs/                           ← All 12 markdown documentation files
│   ├── 01-product-requirements.md
│   ├── 02-user-stories-and-acceptance-criteria.md
│   ├── 03-information-architecture.md
│   ├── 04-system-architecture.md
│   ├── 05-database-schema.md
│   ├── 06-api-contracts.md
│   ├── 07-monorepo-structure.md
│   ├── 08-scoring-engine-spec.md
│   ├── 09-engineering-scope-definition.md
│   ├── 10-development-phases.md
│   ├── 11-environment-and-devops.md
│   └── 12-testing-strategy.md
│
├── .github/
│   └── workflows/
│       ├── ci.yml                  ← Run tests on PR
│       ├── deploy-web.yml          ← Deploy Next.js to Vercel
│       └── deploy-backend.yml      ← Deploy FastAPI to Render
│
├── turbo.json                      ← Turborepo pipeline config
├── package.json                    ← Root workspace definition (pnpm)
├── pnpm-workspace.yaml             ← pnpm workspace declaration
├── .env.example                    ← All required env vars documented
├── .gitignore
└── README.md
```

---

## 3. `apps/web` — Next.js Dashboard

```
apps/web/
├── app/                            ← Next.js App Router
│   ├── layout.tsx                  ← Root layout + auth guard
│   ├── page.tsx                    ← Root redirect (/ → /timeline)
│   ├── (auth)/
│   │   └── login/
│   │       └── page.tsx            ← Google OAuth login page
│   ├── timeline/
│   │   └── page.tsx                ← Main timeline feed
│   ├── event/
│   │   └── [id]/
│   │       ├── page.tsx            ← Event detail (metadata)
│   │       ├── diff/
│   │       │   └── page.tsx        ← Before/after diff view
│   │       └── rollback/
│   │           └── page.tsx        ← Rollback confirmation
│   ├── audit/
│   │   └── page.tsx                ← Audit trail + CSV export
│   └── settings/
│       ├── connectors/
│       │   └── page.tsx            ← Connect Gmail/Docs/Slack
│       ├── agents/
│       │   └── page.tsx            ← Register + manage agents
│       └── account/
│           └── page.tsx            ← Profile + sign out
│
├── components/
│   ├── timeline/
│   │   ├── EventCard.tsx
│   │   ├── EventFeed.tsx
│   │   ├── FilterBar.tsx
│   │   └── RiskBadge.tsx
│   ├── diff/
│   │   ├── DiffViewer.tsx
│   │   └── SnapshotPanel.tsx
│   ├── rollback/
│   │   ├── RollbackButton.tsx
│   │   ├── RollbackModal.tsx
│   │   └── RollbackStatus.tsx
│   ├── settings/
│   │   ├── ConnectorCard.tsx
│   │   └── AgentCard.tsx
│   └── shared/
│       ├── AppIcon.tsx             ← Gmail/Docs/Slack icon switcher
│       ├── TimeAgo.tsx             ← Relative time display
│       └── EmptyState.tsx
│
├── hooks/
│   ├── useTimeline.ts              ← Realtime event subscription
│   ├── useRollback.ts              ← Rollback mutation + status poll
│   └── useConnectors.ts            ← Connector state management
│
├── lib/
│   ├── supabase.ts                 ← Supabase browser client
│   ├── supabase-server.ts          ← Supabase server client (SSR)
│   └── api.ts                      ← Backend API client (typed)
│
├── public/
│   └── icons/
│       ├── gmail.svg
│       ├── gdocs.svg
│       └── slack.svg
│
├── package.json
├── next.config.js
├── tailwind.config.ts
└── tsconfig.json                   ← Extends @trailback/config/tsconfig
```

---

## 4. `apps/extension` — Chrome Extension (MV3)

```
apps/extension/
├── manifest.json                   ← MV3 manifest
│
├── background/
│   └── service-worker.js           ← Event queue, alarm flush, auth
│
├── content-scripts/
│   ├── gmail-interceptor.js        ← Wraps window.fetch on mail.google.com
│   ├── docs-interceptor.js         ← Detects Drive save calls
│   └── slack-interceptor.js        ← Detects chat.postMessage
│
├── injected/
│   └── fetch-hook.js               ← Injected into MAIN world for fetch interception
│
├── popup/
│   ├── popup.html
│   ├── popup.css
│   └── popup.js                    ← Status display, dashboard link
│
├── utils/
│   ├── auth.js                     ← Chrome identity API, token cache
│   ├── queue.js                    ← chrome.storage event queue
│   ├── serializer.js               ← Snapshot serialisation helpers
│   └── diff.js                     ← Client-side diff for extension use
│
├── icons/
│   ├── 16.png
│   ├── 48.png
│   └── 128.png
│
└── package.json                    ← Minimal; build via webpack/esbuild
```

---

## 5. `apps/backend` — FastAPI

```
apps/backend/
├── main.py                         ← FastAPI app entry point
│
├── api/
│   ├── __init__.py
│   ├── deps.py                     ← JWT auth dependency injection
│   ├── events.py                   ← POST /events, GET /timeline, GET /events/:id
│   ├── diff.py                     ← GET /events/:id/diff
│   ├── rollback.py                 ← POST /rollback/:id, GET /rollback/:id/status
│   ├── connectors.py               ← GET/DELETE /connectors
│   ├── agents.py                   ← GET/POST /agents
│   ├── audit.py                    ← GET /audit (CSV)
│   └── health.py                   ← GET /health
│
├── core/
│   ├── event_engine.py             ← Ingest pipeline: validate, diff, classify, persist
│   ├── rollback_engine.py          ← Eligibility check, Celery dispatch
│   ├── risk_classifier.py          ← Rule-based scoring engine
│   └── snapshot.py                 ← Before/after state management
│
├── connectors/
│   ├── __init__.py
│   ├── gmail.py                    ← gmail.trash(message_id)
│   ├── gdocs.py                    ← drive.revisions.restore(file_id, revision_id)
│   └── slack.py                    ← slack.chat.delete(channel, ts)
│
├── workers/
│   ├── __init__.py
│   ├── celery_app.py               ← Celery config + Upstash Redis broker
│   └── tasks.py                    ← execute_rollback task
│
├── models/
│   ├── event.py                    ← Pydantic event schemas
│   ├── rollback.py                 ← Pydantic rollback schemas
│   ├── connector.py                ← Pydantic connector schemas
│   └── agent.py                    ← Pydantic agent schemas
│
├── db/
│   ├── __init__.py
│   └── supabase_client.py          ← Supabase Python client wrapper
│
├── tests/                          ← All test files (see doc-12)
│   ├── conftest.py
│   ├── unit/
│   ├── integration/
│   └── fixtures/
│
├── requirements.txt
├── requirements-dev.txt
├── .env.example
├── Procfile                        ← For Render deployment
└── render.yaml                     ← Render service config
```

---

## 6. `packages/types` — Shared TypeScript Types

```
packages/types/
├── src/
│   ├── events.ts                   ← Event, EventCard, RiskLevel, RollbackStatus
│   ├── connectors.ts               ← ConnectorStatus, AppName
│   ├── agents.ts                   ← Agent, TrustScore
│   └── index.ts                    ← Re-exports all
├── package.json
└── tsconfig.json
```

**Example (`events.ts`):**
```typescript
export type AppName = 'gmail' | 'gdocs' | 'slack';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type RollbackStatus = 'available' | 'executed' | 'unavailable' | 'failed';

export interface TrailbackEvent {
  id: string;
  agent_id: string;
  app: AppName;
  action_type: string;
  intent?: string;
  status: 'completed' | 'rolled_back' | 'partial' | 'failed';
  risk_level: RiskLevel;
  risk_score: number;
  risk_reasons: string[];
  rollback_status: RollbackStatus;
  metadata: Record<string, unknown>;
  created_at: string;
}
```

---

## 7. `packages/ui` — Shared React Components

```
packages/ui/
├── src/
│   ├── RiskBadge.tsx               ← Used in both web app and extension popup
│   ├── AppIcon.tsx                 ← Gmail / Docs / Slack icon switcher
│   ├── TimeAgo.tsx                 ← Relative time display
│   └── index.ts
├── package.json
└── tsconfig.json
```

---

## 8. Root Config Files

### `turbo.json`
```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**", "build/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "outputs": []
    },
    "test": {
      "outputs": ["coverage/**"],
      "dependsOn": ["^build"]
    },
    "type-check": {
      "outputs": []
    }
  }
}
```

### `pnpm-workspace.yaml`
```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

### Root `package.json`
```json
{
  "name": "trailback",
  "private": true,
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "test": "turbo run test",
    "type-check": "turbo run type-check"
  },
  "devDependencies": {
    "turbo": "^2.5.0"
  },
  "packageManager": "pnpm@9.0.0"
}
```

---

## 9. Backend — Python Package Management

The Python backend is **not** part of the pnpm workspace (different language). It uses a standard `venv`:

```bash
cd apps/backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

The Turborepo `dev` task for the backend is defined as:
```json
"dev:backend": "cd apps/backend && uvicorn main:app --reload --port 8000"
```

---

## 10. Local Development — All Services

```bash
# From repo root
pnpm install                    # Install all JS dependencies

# Terminal 1: Start Next.js dashboard (localhost:3000)
pnpm --filter web dev

# Terminal 2: Start FastAPI backend (localhost:8000)
cd apps/backend && source venv/bin/activate && uvicorn main:app --reload

# Terminal 3: Start Celery worker
cd apps/backend && celery -A workers.celery_app worker --loglevel=info

# Extension: Load apps/extension as unpacked in chrome://extensions
```

Or using Turborepo (JS apps only):
```bash
pnpm dev   # Starts web + extension build watchers in parallel
```
