# Flight Recorder
## MVP Technical Specification
**Version:** 1.0.0
**Status:** Active Development
**Sprint Scope:** 4–6 Weeks
**Last Updated:** February 2026

---

## Table of Contents

1. [MVP Scope Definition](#1-mvp-scope-definition)
2. [Tech Stack Specification](#2-tech-stack-specification)
3. [Environment Setup](#3-environment-setup)
4. [Database Schema & Migrations](#4-database-schema--migrations)
5. [API Specification](#5-api-specification)
6. [Chrome Extension Technical Spec](#6-chrome-extension-technical-spec)
7. [Frontend Technical Spec](#7-frontend-technical-spec)
8. [Rollback Implementation](#8-rollback-implementation)
9. [Risk Classification Engine](#9-risk-classification-engine)
10. [Testing Strategy](#10-testing-strategy)
11. [Build & Deployment Runbook](#11-build--deployment-runbook)
12. [Sprint Plan](#12-sprint-plan)

---

## 1. MVP Scope Definition

### In Scope (Must Ship)

| Feature | Description | Priority |
|---------|-------------|----------|
| Gmail event logging | Capture outgoing email sends with full metadata and body | P0 |
| Google Docs event logging | Capture document edits with before/after revision diff | P0 |
| Timeline view | Chronological feed of all agent actions in the dashboard | P0 |
| Diff view | Side-by-side before/after comparison for any logged event | P0 |
| Gmail rollback | Move sent email to trash via Gmail API | P0 |
| Google Docs rollback | Restore prior document revision via Drive API | P0 |
| Google OAuth authentication | Sign in with Google, acquire Gmail + Docs scopes | P0 |
| Slack event logging | Capture posted messages | P1 |
| Slack rollback | Delete message via `chat.delete` (within window) | P1 |
| Risk badge | LOW / MEDIUM / HIGH / CRITICAL classification per event | P1 |
| Connector status page | Show which apps are connected and authorization state | P1 |
| Rollback confirmation modal | Require user confirmation before executing rollback | P1 |

### Out of Scope (Deferred)

- Multi-user team accounts and shared audit trails
- LLM-powered intent summarization
- Notion, Jira, HubSpot connectors
- Mobile browser support
- Firefox / Safari extension
- Automated rollback policies (auto-undo above risk threshold)
- Stripe billing and paid plans

---

## 2. Tech Stack Specification

### 2.1 Full Stack Overview

```
Layer               Technology                  Version     Free Tier
─────────────────────────────────────────────────────────────────────
Browser Extension   Chrome MV3 (Vanilla JS)     MV3         Free
Frontend Framework  Next.js                     14.x        Free (Vercel)
UI Styling          Tailwind CSS                3.x         Free
Component Library   shadcn/ui                   Latest      Free (OSS)
Diff Rendering      react-diff-viewer-continued 4.x         Free (npm)
State Management    Zustand                     4.x         Free (npm)
Backend Framework   FastAPI (Python)            0.115.x     Free
Task Queue          Celery                      5.x         Free (OSS)
Message Broker      Upstash Redis               Latest      Free (10K/day)
Database            Supabase (PostgreSQL 15)    Latest      Free (500MB)
Authentication      Supabase Auth               Latest      Free (50K MAU)
Realtime            Supabase Realtime           Latest      Free
File Storage        Supabase Storage            Latest      Free (1GB)
Frontend Hosting    Vercel                      Latest      Free (hobby)
Backend Hosting     Render                      Latest      Free
Version Control     GitHub                      Latest      Free
CI/CD               GitHub Actions              Latest      Free (2K min/mo)
Error Monitoring    Sentry                      Latest      Free (5K errors/mo)
Email               Resend                      Latest      Free (3K/mo)
─────────────────────────────────────────────────────────────────────
```

### 2.2 Python Dependencies (`requirements.txt`)

```
fastapi==0.115.0
uvicorn[standard]==0.30.0
pydantic==2.7.0
python-jose[cryptography]==3.3.0
supabase==2.5.0
httpx==0.27.0
celery==5.4.0
redis==5.0.4
deepdiff==7.0.1
python-dotenv==1.0.0
sentry-sdk[fastapi]==2.8.0
google-auth==2.30.0
google-auth-oauthlib==1.2.0
google-api-python-client==2.135.0
slack-sdk==3.30.0
```

### 2.3 Node.js Dependencies (`package.json`)

```json
{
  "dependencies": {
    "next": "14.2.0",
    "react": "18.3.0",
    "react-dom": "18.3.0",
    "@supabase/supabase-js": "^2.43.0",
    "@supabase/ssr": "^0.3.0",
    "zustand": "^4.5.0",
    "react-diff-viewer-continued": "^4.0.0",
    "react-chrono": "^2.6.0",
    "lucide-react": "^0.400.0",
    "recharts": "^2.12.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.3.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "@types/react": "^18.3.0",
    "tailwindcss": "^3.4.0",
    "eslint": "^8.57.0"
  }
}
```

---

## 3. Environment Setup

### 3.1 Prerequisites

```bash
# Required
node >= 20.x
python >= 3.11
git

# Install Python environment
python -m venv venv
source venv/bin/activate  # Mac/Linux
pip install -r requirements.txt

# Install Node environment
npm install

# Install Chrome Extension dev tools
# Load unpacked from chrome://extensions (Developer mode)
```

### 3.2 Local Development Services

```bash
# Start backend (with hot reload)
uvicorn main:app --reload --port 8000

# Start frontend (with hot reload)
npm run dev   # Runs on localhost:3000

# Start Celery worker
celery -A workers.tasks worker --loglevel=info

# Supabase — use cloud free tier (no local setup needed for MVP)
```

### 3.3 Required External Accounts

| Service | Action Required | URL |
|---------|----------------|-----|
| Supabase | Create project, copy URL + anon key | supabase.com |
| Google Cloud | Enable Gmail API, Docs API, Drive API; create OAuth credentials | console.cloud.google.com |
| Slack | Create Slack App, add Bot Token scopes | api.slack.com/apps |
| Upstash | Create Redis database, copy REST URL | upstash.com |
| Vercel | Connect GitHub repo | vercel.com |
| Render | Create Web Service from GitHub | render.com |

---

## 4. Database Schema & Migrations

### 4.1 Supabase SQL Migrations (run in order)

**Migration 001 — Core tables**

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Events table
CREATE TABLE public.events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    agent_id        TEXT NOT NULL DEFAULT 'unknown',
    app             TEXT NOT NULL CHECK (app IN ('gmail', 'gdocs', 'slack')),
    action_type     TEXT NOT NULL,
    intent          TEXT,
    status          TEXT NOT NULL DEFAULT 'completed'
                    CHECK (status IN ('completed', 'rolled_back', 'partial', 'failed')),
    risk_level      TEXT NOT NULL DEFAULT 'low'
                    CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    rollback_status TEXT NOT NULL DEFAULT 'available'
                    CHECK (rollback_status IN ('available', 'executed', 'unavailable', 'failed')),
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Snapshots table
CREATE TABLE public.snapshots (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id        UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    snapshot_type   TEXT NOT NULL CHECK (snapshot_type IN ('before', 'after')),
    content         JSONB NOT NULL,
    content_hash    TEXT NOT NULL,
    captured_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Rollbacks table
CREATE TABLE public.rollbacks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id        UUID NOT NULL REFERENCES public.events(id),
    user_id         UUID NOT NULL REFERENCES auth.users(id),
    initiated_by    TEXT NOT NULL DEFAULT 'user',
    result          TEXT NOT NULL CHECK (result IN ('success', 'failed', 'partial')),
    failure_reason  TEXT,
    api_response    JSONB,
    executed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Connectors table
CREATE TABLE public.connectors (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    app             TEXT NOT NULL CHECK (app IN ('gmail', 'gdocs', 'slack')),
    oauth_token     TEXT,
    refresh_token   TEXT,
    scopes          TEXT[],
    is_active       BOOLEAN DEFAULT TRUE,
    connected_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at    TIMESTAMPTZ,
    UNIQUE(user_id, app)
);

-- Agents table
CREATE TABLE public.agents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    agent_key       TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(24), 'base64'),
    total_actions   INTEGER NOT NULL DEFAULT 0,
    rolled_back     INTEGER NOT NULL DEFAULT 0,
    trust_score     FLOAT NOT NULL DEFAULT 1.0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Migration 002 — Indexes**

```sql
CREATE INDEX idx_events_user_created ON public.events(user_id, created_at DESC);
CREATE INDEX idx_events_app ON public.events(app);
CREATE INDEX idx_events_risk ON public.events(risk_level);
CREATE INDEX idx_events_rollback ON public.events(rollback_status);
CREATE INDEX idx_snapshots_event ON public.snapshots(event_id);
CREATE INDEX idx_connectors_user ON public.connectors(user_id);
```

**Migration 003 — Row Level Security**

```sql
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rollbacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_events" ON public.events
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "user_snapshots" ON public.snapshots
    FOR ALL USING (event_id IN (
        SELECT id FROM public.events WHERE user_id = auth.uid()
    ));

CREATE POLICY "user_rollbacks" ON public.rollbacks
    FOR ALL USING (user_id = auth.uid());

CREATE POLICY "user_connectors" ON public.connectors
    FOR ALL USING (user_id = auth.uid());

CREATE POLICY "user_agents" ON public.agents
    FOR ALL USING (user_id = auth.uid());
```

**Migration 004 — Realtime**

```sql
-- Enable Realtime for live dashboard updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.rollbacks;
```

---

## 5. API Specification

### 5.1 Base URL
- Development: `http://localhost:8000/api/v1`
- Production: `https://flight-recorder-api.onrender.com/api/v1`

### 5.2 Authentication
All endpoints require `Authorization: Bearer <supabase_jwt>` header.

### 5.3 Endpoints

**POST /events — Ingest a new agent action**
```json
Request:
{
  "agent_id": "claude-desktop-v1",
  "app": "gmail",
  "action_type": "email.send",
  "intent": "Sending follow-up to prospect",
  "metadata": {
    "to": ["prospect@company.com"],
    "subject": "Following up on our conversation",
    "thread_id": "abc123",
    "message_id": "msg456"
  },
  "before_snapshot": {
    "draft_content": "Hi John, just wanted to follow up..."
  },
  "after_snapshot": {
    "message_id": "msg456",
    "thread_id": "abc123",
    "sent_at": "2026-02-23T14:30:00Z"
  }
}

Response 201:
{
  "event_id": "uuid-here",
  "risk_level": "low",
  "rollback_status": "available",
  "created_at": "2026-02-23T14:30:01Z"
}
```

**GET /timeline — Paginated event feed**
```
Query params: ?limit=20&offset=0&app=gmail&risk_level=high
Response 200: { "events": [...], "total": 142, "has_more": true }
```

**GET /events/{event_id}/diff — Retrieve diff for an event**
```json
Response 200:
{
  "event_id": "uuid",
  "app": "gdocs",
  "action_type": "doc.edit",
  "before": { "content": "Original paragraph text here..." },
  "after": { "content": "Modified paragraph text here..." },
  "diff": { "added": [...], "removed": [...], "changed": [...] },
  "rollback_available": true
}
```

**POST /rollback/{event_id} — Execute rollback**
```json
Request: { "confirmation": true, "reason": "Agent edited wrong document" }

Response 202:
{
  "rollback_id": "uuid",
  "status": "queued",
  "estimated_completion_ms": 2000
}
```

**GET /rollback/{rollback_id}/status — Poll rollback result**
```json
Response 200:
{
  "rollback_id": "uuid",
  "result": "success",        // "success" | "failed" | "pending"
  "executed_at": "2026-02-23T14:32:00Z",
  "api_response": { "id": "msg456" }
}
```

**GET /connectors — List user's connected apps**
```json
Response 200:
{
  "connectors": [
    { "app": "gmail", "is_active": true, "scopes": ["gmail.modify"], "connected_at": "..." },
    { "app": "gdocs", "is_active": true, "scopes": ["drive.file", "documents"], ... },
    { "app": "slack", "is_active": false, "scopes": null, ... }
  ]
}
```

---

## 6. Chrome Extension Technical Spec

### 6.1 manifest.json

```json
{
  "manifest_version": 3,
  "name": "Flight Recorder",
  "version": "1.0.0",
  "description": "Record and rollback every AI agent action across Gmail, Docs & Slack",
  "permissions": [
    "activeTab",
    "scripting",
    "storage",
    "identity",
    "alarms"
  ],
  "host_permissions": [
    "https://mail.google.com/*",
    "https://docs.google.com/*",
    "https://drive.google.com/*",
    "https://app.slack.com/*",
    "https://*.googleapis.com/*"
  ],
  "background": {
    "service_worker": "background/service-worker.js",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": ["https://mail.google.com/*"],
      "js": ["content-scripts/gmail-interceptor.js"],
      "run_at": "document_idle"
    },
    {
      "matches": ["https://docs.google.com/document/*"],
      "js": ["content-scripts/docs-interceptor.js"],
      "run_at": "document_idle"
    },
    {
      "matches": ["https://app.slack.com/*"],
      "js": ["content-scripts/slack-interceptor.js"],
      "run_at": "document_idle"
    }
  ],
  "action": {
    "default_popup": "popup/popup.html",
    "default_icon": { "16": "icons/16.png", "48": "icons/48.png" }
  },
  "icons": { "128": "icons/128.png" }
}
```

### 6.2 Gmail Interceptor Core Logic

```javascript
// content-scripts/gmail-interceptor.js
(function interceptGmailSends() {
  const originalFetch = window.fetch;

  window.fetch = async function (...args) {
    const [resource, options] = args;
    const url = typeof resource === 'string' ? resource : resource.url;

    // Detect Gmail send API call
    if (url.includes('gmail.googleapis.com/gmail/v1/users/me/messages/send')) {
      let bodySnapshot = null;

      try {
        // Capture before snapshot from request body
        if (options?.body) {
          const rawBody = JSON.parse(options.body);
          bodySnapshot = decodeEmailBody(rawBody.raw);
        }
      } catch (e) { /* non-blocking */ }

      // Execute original fetch
      const response = await originalFetch.apply(this, args);
      const responseClone = response.clone();

      // Capture after snapshot from response
      try {
        const data = await responseClone.json();
        chrome.runtime.sendMessage({
          type: 'EVENT_CAPTURED',
          payload: {
            app: 'gmail',
            action_type: 'email.send',
            metadata: { message_id: data.id, thread_id: data.threadId },
            before_snapshot: { content: bodySnapshot },
            after_snapshot: { message_id: data.id, sent_at: new Date().toISOString() }
          }
        });
      } catch (e) { /* non-blocking */ }

      return response;
    }

    return originalFetch.apply(this, args);
  };
})();
```

### 6.3 Service Worker (Event Queue)

```javascript
// background/service-worker.js
const EVENT_QUEUE_KEY = 'pending_events';
const API_BASE = 'https://flight-recorder-api.onrender.com/api/v1';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'EVENT_CAPTURED') {
    queueAndSync(message.payload);
  }
});

async function queueAndSync(event) {
  // Queue locally first (fail-safe)
  const queue = await getQueue();
  queue.push({ ...event, queued_at: Date.now() });
  await saveQueue(queue);

  // Attempt immediate sync
  await flushQueue();
}

async function flushQueue() {
  const token = await getAuthToken();
  if (!token) return; // Not authenticated yet, will retry

  const queue = await getQueue();
  const failed = [];

  for (const event of queue) {
    try {
      const res = await fetch(`${API_BASE}/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(event)
      });
      if (!res.ok) failed.push(event);
    } catch {
      failed.push(event);
    }
  }

  await saveQueue(failed); // Re-queue only failed events
}

// Retry flush every 30 seconds for resilience
chrome.alarms.create('syncFlush', { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'syncFlush') flushQueue();
});
```

---

## 7. Frontend Technical Spec

### 7.1 Key Pages & Components

**Timeline Page (`/timeline`)**
- Realtime subscription to `events` table via Supabase Realtime
- Infinite scroll with 20 events per page
- Filter bar: by app (Gmail/Docs/Slack) and risk level
- Each `EventCard` shows: app icon, action type, timestamp, risk badge, rollback button

**Diff Page (`/event/[id]/diff`)**
- Fetches `before` and `after` snapshots from API
- Renders `react-diff-viewer-continued` in split/unified view toggle
- Shows metadata panel (agent name, timestamp, intent if available)
- "Rollback this action" CTA at the bottom

**Rollback Confirmation (`/event/[id]/rollback`)**
- Two-step confirmation modal to prevent accidental rollbacks
- Shows what will be reversed in plain English: "This will trash the email sent to prospect@company.com with subject 'Following up...'"
- Polls rollback status and shows success/failure state

### 7.2 Realtime Hook

```typescript
// hooks/useTimeline.ts
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';

export function useTimeline() {
  const [events, setEvents] = useState<Event[]>([]);
  const supabase = createClient();

  useEffect(() => {
    // Initial load
    supabase
      .from('events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => setEvents(data || []));

    // Subscribe to new events
    const channel = supabase
      .channel('timeline')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'events'
      }, (payload) => {
        setEvents(prev => [payload.new as Event, ...prev]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return { events };
}
```

---

## 8. Rollback Implementation

### 8.1 Gmail Rollback Connector

```python
# connectors/gmail.py
from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials

async def rollback_email_send(message_id: str, oauth_token: str) -> dict:
    """Moves a sent email to trash — the only available Gmail 'unsend'."""
    creds = Credentials(token=oauth_token)
    service = build('gmail', 'v1', credentials=creds)

    result = service.users().messages().trash(
        userId='me',
        id=message_id
    ).execute()

    return {"success": True, "message_id": result['id'], "labels": result.get('labelIds', [])}
```

### 8.2 Google Docs Rollback Connector

```python
# connectors/gdocs.py
async def rollback_doc_edit(file_id: str, revision_id: str, oauth_token: str) -> dict:
    """Restores a Google Doc to a prior revision using Drive Revisions API."""
    creds = Credentials(token=oauth_token)
    service = build('drive', 'v2', credentials=creds)

    # Restore to the 'before' revision
    result = service.revisions().update(
        fileId=file_id,
        revisionId=revision_id,
        body={"published": False, "publishAuto": False}
    ).execute()

    # Export restored content to confirm
    content = service.files().export(
        fileId=file_id,
        mimeType='text/plain'
    ).execute()

    return {"success": True, "revision_id": result['id'], "file_id": file_id}
```

### 8.3 Celery Rollback Task

```python
# workers/tasks.py
from celery import Celery
from connectors import gmail, gdocs, slack
from db.supabase_client import supabase

app = Celery('flight_recorder', broker=os.environ['UPSTASH_REDIS_URL'])

@app.task(bind=True, max_retries=3, default_retry_delay=5)
def execute_rollback(self, rollback_id: str, event_id: str, app_name: str,
                      metadata: dict, oauth_token: str):
    try:
        if app_name == 'gmail':
            result = gmail.rollback_email_send(metadata['message_id'], oauth_token)
        elif app_name == 'gdocs':
            result = gdocs.rollback_doc_edit(
                metadata['file_id'], metadata['before_revision_id'], oauth_token
            )
        elif app_name == 'slack':
            result = slack.rollback_message_post(
                metadata['channel'], metadata['ts'], oauth_token
            )

        # Update rollback record
        supabase.table('rollbacks').update({
            'result': 'success',
            'api_response': result
        }).eq('id', rollback_id).execute()

        # Update event rollback_status
        supabase.table('events').update({
            'rollback_status': 'executed',
            'status': 'rolled_back'
        }).eq('id', event_id).execute()

    except Exception as exc:
        supabase.table('rollbacks').update({
            'result': 'failed',
            'failure_reason': str(exc)
        }).eq('id', rollback_id).execute()

        raise self.retry(exc=exc)
```

---

## 9. Risk Classification Engine

The risk classifier is a **pure Python rule engine** — no LLM, no external API calls.

```python
# core/risk_classifier.py
from dataclasses import dataclass
from typing import Optional
import json

@dataclass
class RiskResult:
    level: str          # "low" | "medium" | "high" | "critical"
    score: int          # 0-100
    reasons: list[str]  # Human-readable explanation

def classify_event(app: str, action_type: str, metadata: dict,
                   before: Optional[dict], after: Optional[dict]) -> RiskResult:
    score = 0
    reasons = []

    # Rule Group 1: Action type severity
    HIGH_RISK_ACTIONS = {
        'email.send': 10,
        'email.send_bulk': 40,
        'doc.delete': 30,
        'doc.share': 20,
        'message.post_public': 25,
        'file.delete': 35,
    }
    score += HIGH_RISK_ACTIONS.get(action_type, 5)

    # Rule Group 2: Recipient breadth (Gmail)
    if app == 'gmail' and metadata.get('to'):
        recipient_count = len(metadata['to'])
        if recipient_count > 10:
            score += 30
            reasons.append(f"Email sent to {recipient_count} recipients")
        elif recipient_count > 5:
            score += 15

    # Rule Group 3: Document change magnitude (Docs)
    if app == 'gdocs' and before and after:
        before_len = len(json.dumps(before))
        after_len = len(json.dumps(after))
        delta = abs(after_len - before_len)
        if delta > 5000:
            score += 25
            reasons.append(f"Large document change: ~{delta} characters modified")
        elif delta > 1000:
            score += 10

    # Rule Group 4: External domain check
    if app == 'gmail':
        to_addresses = metadata.get('to', [])
        external = [e for e in to_addresses if not e.endswith('@yourdomain.com')]
        if external:
            score += 15
            reasons.append(f"Sent to {len(external)} external email address(es)")

    # Rule Group 5: Slack public channel
    if app == 'slack' and metadata.get('channel_type') == 'public':
        score += 20
        reasons.append("Posted to a public Slack channel")

    # Determine level
    if score >= 70:
        level = 'critical'
    elif score >= 40:
        level = 'high'
    elif score >= 20:
        level = 'medium'
    else:
        level = 'low'

    return RiskResult(level=level, score=score, reasons=reasons)
```

---

## 10. Testing Strategy

### Unit Tests

```
tests/
├── test_risk_classifier.py    # All classification rules
├── test_event_ingestion.py    # API endpoint tests
├── test_rollback_engine.py    # Rollback logic (mocked connectors)
├── test_connectors/
│   ├── test_gmail.py          # Gmail API (mocked)
│   ├── test_gdocs.py          # Docs API (mocked)
│   └── test_slack.py          # Slack API (mocked)
```

**Sample test:**
```python
def test_bulk_email_classified_as_critical():
    result = classify_event(
        app='gmail',
        action_type='email.send',
        metadata={'to': [f'user{i}@ext.com' for i in range(15)]},
        before=None,
        after=None
    )
    assert result.level == 'critical'
    assert result.score >= 70
```

### Integration Tests
- End-to-end: Extension → Backend → Supabase → Dashboard update
- Rollback flow: POST rollback → Celery task → Connector mock → Status update

### Manual QA Checklist (Pre-Launch)
- [ ] Gmail send captured and appears in timeline within 2 seconds
- [ ] Google Docs edit diff shows correct before/after
- [ ] Gmail rollback successfully moves email to trash
- [ ] Docs rollback restores previous revision
- [ ] Risk badge shows CRITICAL for 15-recipient email
- [ ] Dashboard updates in realtime without page refresh
- [ ] Rollback button disabled after successful rollback
- [ ] Failed rollback shows error reason in UI

---

## 11. Build & Deployment Runbook

### Frontend → Vercel
```bash
# First time
vercel login
vercel --prod

# Set environment variables in Vercel dashboard:
# NEXT_PUBLIC_SUPABASE_URL
# NEXT_PUBLIC_SUPABASE_ANON_KEY
# NEXT_PUBLIC_API_URL

# Subsequent deploys — automatic via GitHub push to main
```

### Backend → Render
```
1. Connect GitHub repo to Render
2. Create new "Web Service"
   Build Command: pip install -r requirements.txt
   Start Command: uvicorn main:app --host 0.0.0.0 --port $PORT
3. Add all environment variables in Render dashboard
4. Deploy — automatic on push to main via GitHub webhook
```

### Chrome Extension
```bash
# Build for production
# Zip the extension directory
zip -r flight-recorder-extension.zip extension/

# Upload to Chrome Web Store Developer Dashboard
# https://chrome.google.com/webstore/devconsole
# ($5 one-time developer registration fee)

# For internal testing: Load unpacked in chrome://extensions
```

---

## 12. Sprint Plan

### Week 1: Foundation
- [ ] Supabase project setup, schema migrations, RLS policies
- [ ] FastAPI project scaffold, Supabase client integration
- [ ] POST /events endpoint with basic validation
- [ ] Chrome extension skeleton (manifest, service worker, storage)

### Week 2: Core Recording
- [ ] Gmail interceptor (content script + fetch hook)
- [ ] Google Docs interceptor (revision detection)
- [ ] Event ingestion pipeline end-to-end (Extension → API → DB)
- [ ] Risk classifier implementation + unit tests

### Week 3: Dashboard MVP
- [ ] Next.js project setup (Tailwind, shadcn, Supabase client)
- [ ] Google OAuth login flow (Supabase Auth)
- [ ] Timeline page with realtime updates
- [ ] EventCard component with risk badges

### Week 4: Rollback
- [ ] GET /diff endpoint + diff computation
- [ ] Diff view page in dashboard
- [ ] Gmail rollback connector
- [ ] Google Docs rollback connector
- [ ] Celery + Upstash task queue setup

### Week 5: Slack + Polish
- [ ] Slack interceptor + message logging
- [ ] Slack rollback connector
- [ ] Rollback confirmation modal
- [ ] Connector settings page
- [ ] Error states + loading skeletons

### Week 6: Launch Prep
- [ ] Sentry error monitoring integration
- [ ] GitHub Actions CI/CD pipeline
- [ ] Deploy to Vercel + Render
- [ ] Submit extension to Chrome Web Store
- [ ] End-to-end QA checklist completion
- [ ] Landing page (basic, no-code: Notion or Carrd)
