# 12 — Testing Strategy
**Project:** Trailback
**Last Updated:** February 2026

---

## 1. Testing Philosophy

Trailback uses the **testing pyramid**:

```
        /‾‾‾‾‾‾‾‾‾‾‾‾‾\
       /   E2E Tests    \     ← Few, slow, catch full user flows
      /─────────────────\
     /  Integration Tests \   ← Moderate, test component interactions
    /─────────────────────\
   /      Unit Tests       \  ← Many, fast, test isolated logic
  /─────────────────────────\
```

**Coverage targets:**
- Unit tests: ≥ 80% line coverage on `core/`, `connectors/`, `models/`
- Integration tests: all P0 API endpoints covered
- E2E tests: 5 critical user paths covered

---

## 2. Backend Testing (Python / pytest)

### 2.1 Setup

```
apps/backend/
├── tests/
│   ├── conftest.py              ← Shared fixtures
│   ├── unit/
│   │   ├── test_risk_classifier.py
│   │   ├── test_event_engine.py
│   │   ├── test_rollback_engine.py
│   │   └── test_connectors/
│   │       ├── test_gmail.py
│   │       ├── test_gdocs.py
│   │       └── test_slack.py
│   ├── integration/
│   │   ├── test_events_api.py
│   │   ├── test_rollback_api.py
│   │   ├── test_connectors_api.py
│   │   └── test_agents_api.py
│   └── fixtures/
│       ├── events.json          ← Sample event payloads
│       └── snapshots.json
```

**`requirements-dev.txt`:**
```
pytest==8.3.0
pytest-asyncio==0.23.0
pytest-cov==5.0.0
httpx==0.27.0
pytest-mock==3.14.0
respx==0.21.0         # Mock httpx calls (for Google/Slack API mocking)
faker==25.0.0
```

### 2.2 `conftest.py`

```python
import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock
import os

os.environ["ENVIRONMENT"] = "test"
os.environ["SUPABASE_URL"] = "https://test.supabase.co"
os.environ["SUPABASE_SERVICE_KEY"] = "test-service-key"

from main import app

@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c

@pytest.fixture
def auth_headers():
    """Mock JWT for test user."""
    return {"Authorization": "Bearer test-jwt-token"}

@pytest.fixture
def mock_supabase(mocker):
    """Mock Supabase client for unit tests."""
    return mocker.patch("db.supabase_client.supabase")

@pytest.fixture
def sample_gmail_event():
    return {
        "idempotency_key": "test-idem-key-001",
        "agent_id": "test-agent",
        "app": "gmail",
        "action_type": "email.send",
        "metadata": {
            "to": ["john@external.com"],
            "subject": "Test email",
            "message_id": "msg_001"
        },
        "before_snapshot": {"content": "Hi John, this is a test email.", "content_type": "text/plain"},
        "after_snapshot": {"message_id": "msg_001", "sent_at": "2026-02-23T14:30:00Z"}
    }
```

---

### 2.3 Unit Tests — Risk Classifier

**File:** `tests/unit/test_risk_classifier.py`

```python
import pytest
from core.risk_classifier import classify_event, RiskResult

class TestActionBaseScore:
    def test_email_send_base(self):
        result = classify_event("gmail", "email.send", {"to": []}, None, None, None)
        assert result.score >= 10

    def test_doc_delete_base(self):
        result = classify_event("gdocs", "doc.delete", {}, None, None, None)
        assert result.score >= 30

class TestRecipientBreadth:
    def test_single_recipient_no_extra_score(self):
        result = classify_event("gmail", "email.send", {"to": ["a@b.com"]}, None, None, None)
        assert result.score < 20  # base only

    def test_mass_email_classified_critical(self):
        to = [f"user{i}@ext.com" for i in range(25)]
        result = classify_event("gmail", "email.send", {"to": to}, None, None, None)
        assert result.level == "critical"
        assert result.score >= 70
        assert any("25 recipients" in r for r in result.reasons)

    def test_10_recipients_classified_high(self):
        to = [f"user{i}@ext.com" for i in range(10)]
        result = classify_event("gmail", "email.send", {"to": to}, None, None, None)
        assert result.level in ("high", "critical")

class TestExternalDomain:
    def test_external_recipient_adds_score(self):
        result = classify_event("gmail", "email.send",
                                {"to": ["external@other.com"]}, None, None, None)
        assert any("external" in r.lower() for r in result.reasons)

class TestDocumentMagnitude:
    def test_large_doc_change_adds_score(self):
        before = {"content": "a" * 100}
        after  = {"content": "a" * 6000}
        result = classify_event("gdocs", "doc.edit", {}, before, after, None)
        assert any("large" in r.lower() for r in result.reasons)

    def test_small_doc_change_no_magnitude_reason(self):
        before = {"content": "Hello world"}
        after  = {"content": "Hello World"}
        result = classify_event("gdocs", "doc.edit", {}, before, after, None)
        assert not any("large" in r.lower() or "change" in r.lower() for r in result.reasons)

class TestSlackChannel:
    def test_public_channel_raises_score(self):
        result = classify_event("slack", "message.post_public",
                                {"channel_type": "public"}, None, None, None)
        assert result.level in ("high", "critical")
        assert any("public" in r.lower() for r in result.reasons)

class TestThresholds:
    def test_low_threshold(self):
        result = classify_event("gmail", "email.send", {"to": ["a@myco.com"]}, None, None, None)
        assert result.level == "low"

    def test_critical_threshold(self):
        to = [f"u{i}@ext.com" for i in range(20)]
        result = classify_event("gmail", "email.send", {"to": to}, None, None, None)
        assert result.level == "critical"

    def test_score_clamped_to_100(self):
        to = [f"u{i}@ext.com" for i in range(100)]
        result = classify_event("gmail", "email.send_bulk", {"to": to}, None, None, None)
        assert result.score <= 100
```

---

### 2.4 Unit Tests — Rollback Engine

**File:** `tests/unit/test_rollback_engine.py`

```python
import pytest
from unittest.mock import MagicMock, patch
from core.rollback_engine import validate_rollback_eligibility, RollbackError

class TestRollbackEligibility:
    def test_available_event_is_eligible(self):
        event = MagicMock()
        event.rollback_status = "available"
        connector = MagicMock()
        connector.is_active = True
        connector.oauth_token = "token"
        # Should not raise
        validate_rollback_eligibility(event, connector)

    def test_already_executed_raises(self):
        event = MagicMock()
        event.rollback_status = "executed"
        with pytest.raises(RollbackError, match="already been rolled back"):
            validate_rollback_eligibility(event, MagicMock())

    def test_inactive_connector_raises(self):
        event = MagicMock()
        event.rollback_status = "available"
        connector = MagicMock()
        connector.is_active = False
        with pytest.raises(RollbackError, match="authorisation"):
            validate_rollback_eligibility(event, connector)
```

---

### 2.5 Unit Tests — Gmail Connector

**File:** `tests/unit/test_connectors/test_gmail.py`

```python
import pytest
import respx
import httpx
from connectors.gmail import rollback_email_send

@respx.mock
async def test_gmail_trash_success():
    respx.post(
        "https://gmail.googleapis.com/gmail/v1/users/me/messages/msg_001/trash"
    ).mock(return_value=httpx.Response(200, json={"id": "msg_001", "labelIds": ["TRASH"]}))

    result = await rollback_email_send("msg_001", "fake-oauth-token")

    assert result["success"] is True
    assert "TRASH" in result["labels"]

@respx.mock
async def test_gmail_trash_401_raises():
    respx.post(
        "https://gmail.googleapis.com/gmail/v1/users/me/messages/msg_001/trash"
    ).mock(return_value=httpx.Response(401, json={"error": "invalid_token"}))

    with pytest.raises(Exception, match="401"):
        await rollback_email_send("msg_001", "expired-token")
```

---

### 2.6 Integration Tests — Events API

**File:** `tests/integration/test_events_api.py`

```python
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock

class TestPostEvents:
    def test_ingest_gmail_event_success(self, client, auth_headers, sample_gmail_event, mock_supabase):
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []
        mock_supabase.table.return_value.insert.return_value.execute.return_value.data = [
            {"id": "evt_001", "risk_level": "medium", "risk_score": 35, "rollback_status": "available"}
        ]

        response = client.post("/api/v1/events", json=sample_gmail_event, headers=auth_headers)

        assert response.status_code == 201
        body = response.json()
        assert "event_id" in body
        assert body["risk_level"] in ("low", "medium", "high", "critical")
        assert body["rollback_status"] == "available"

    def test_duplicate_idempotency_key_returns_409(self, client, auth_headers, sample_gmail_event, mock_supabase):
        # First call: no existing event
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [
            {"id": "evt_001"}  # existing event
        ]

        response = client.post("/api/v1/events", json=sample_gmail_event, headers=auth_headers)

        assert response.status_code == 409
        assert "already ingested" in response.json()["message"]

    def test_missing_app_field_returns_422(self, client, auth_headers):
        payload = {"agent_id": "test", "action_type": "email.send", "metadata": {}}
        response = client.post("/api/v1/events", json=payload, headers=auth_headers)
        assert response.status_code == 422

    def test_unauthenticated_returns_401(self, client, sample_gmail_event):
        response = client.post("/api/v1/events", json=sample_gmail_event)
        assert response.status_code == 401

class TestGetTimeline:
    def test_timeline_returns_paginated_events(self, client, auth_headers, mock_supabase):
        mock_supabase.table.return_value.select.return_value.eq.return_value.order.return_value.range.return_value.execute.return_value.data = [
            {"id": "evt_001", "app": "gmail", "risk_level": "low"}
        ]

        response = client.get("/api/v1/timeline?limit=20&offset=0", headers=auth_headers)

        assert response.status_code == 200
        assert "events" in response.json()
        assert "has_more" in response.json()

    def test_timeline_filter_by_app(self, client, auth_headers, mock_supabase):
        response = client.get("/api/v1/timeline?app=gmail", headers=auth_headers)
        assert response.status_code == 200
```

---

### 2.7 Integration Tests — Rollback API

**File:** `tests/integration/test_rollback_api.py`

```python
class TestPostRollback:
    def test_rollback_available_event_returns_202(self, client, auth_headers, mock_supabase):
        with patch("core.rollback_engine.execute_rollback_task.delay") as mock_task:
            mock_task.return_value = MagicMock(id="task_001")
            # Setup mock event with rollback_status=available
            ...
            response = client.post("/api/v1/rollback/evt_001",
                                   json={"confirmation": True},
                                   headers=auth_headers)
            assert response.status_code == 202
            assert "rollback_id" in response.json()

    def test_rollback_executed_event_returns_422(self, client, auth_headers, mock_supabase):
        # Setup mock event with rollback_status=executed
        ...
        response = client.post("/api/v1/rollback/evt_001",
                               json={"confirmation": True},
                               headers=auth_headers)
        assert response.status_code == 422
        assert response.json()["error"]["code"] == "ROLLBACK_UNAVAILABLE"

    def test_rollback_without_confirmation_returns_422(self, client, auth_headers):
        response = client.post("/api/v1/rollback/evt_001",
                               json={"confirmation": False},
                               headers=auth_headers)
        assert response.status_code == 422
```

---

### 2.8 Running Backend Tests

```bash
cd apps/backend
source venv/bin/activate

# Run all tests
pytest tests/ -v

# Run with coverage report
pytest tests/ --cov=. --cov-report=html --cov-report=term-missing

# Run only unit tests (fast)
pytest tests/unit/ -v

# Run only integration tests
pytest tests/integration/ -v

# Run a specific test file
pytest tests/unit/test_risk_classifier.py -v
```

---

## 3. Frontend Testing (TypeScript / Vitest + Playwright)

### 3.1 Unit Tests (Vitest)

```bash
# Install
pnpm --filter web add -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

**Test: `RiskBadge.test.tsx`**
```typescript
import { render, screen } from '@testing-library/react'
import { RiskBadge } from '@/components/timeline/RiskBadge'

describe('RiskBadge', () => {
  it('renders LOW in grey', () => {
    render(<RiskBadge level="low" score={10} reasons={[]} />)
    const badge = screen.getByText('LOW')
    expect(badge).toHaveClass('text-gray-500')
  })

  it('renders CRITICAL in red', () => {
    render(<RiskBadge level="critical" score={85} reasons={['Mass email send']} />)
    const badge = screen.getByText('CRITICAL')
    expect(badge).toHaveClass('text-red-600')
  })

  it('shows tooltip with reasons on hover', async () => {
    render(<RiskBadge level="high" score={55} reasons={['Email to external domain']} />)
    // hover test...
  })
})
```

**Test: `useTimeline.test.ts`**
```typescript
import { renderHook } from '@testing-library/react'
import { useTimeline } from '@/hooks/useTimeline'
import { vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({ order: () => ({ limit: () => ({ then: () => Promise.resolve({ data: [] }) }) }) })
    }),
    channel: () => ({ on: () => ({ subscribe: vi.fn() }) })
  })
}))

describe('useTimeline', () => {
  it('initialises with empty events array', () => {
    const { result } = renderHook(() => useTimeline())
    expect(result.current.events).toEqual([])
  })
})
```

### 3.2 E2E Tests (Playwright)

**File:** `apps/web/tests/e2e/timeline.spec.ts`

```typescript
import { test, expect } from '@playwright/test'

test.describe('Timeline', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication
    await page.addCookies([{ name: 'sb-access-token', value: 'test-token', url: 'http://localhost:3000' }])
  })

  test('shows empty state when no events', async ({ page }) => {
    await page.goto('/timeline')
    await expect(page.getByText('No actions recorded yet')).toBeVisible()
  })

  test('shows event cards with risk badges', async ({ page }) => {
    // Mock API response
    await page.route('/api/v1/timeline*', async route => {
      await route.fulfill({ json: {
        events: [{
          id: 'evt_001', app: 'gmail', action_type: 'email.send',
          risk_level: 'medium', rollback_status: 'available',
          metadata: { to: ['john@co.com'], subject: 'Test' },
          created_at: new Date().toISOString()
        }],
        total: 1, has_more: false
      }})
    })
    await page.goto('/timeline')
    await expect(page.locator('[data-testid="event-card"]')).toBeVisible()
    await expect(page.locator('[data-testid="risk-badge-medium"]')).toBeVisible()
  })
})
```

**File:** `apps/web/tests/e2e/rollback.spec.ts`
```typescript
test('rollback flow — confirm and see success', async ({ page }) => {
  await page.goto('/event/evt_001/diff')
  await page.click('[data-testid="rollback-button"]')
  await expect(page.getByText('Confirm Rollback')).toBeVisible()
  await page.click('[data-testid="confirm-rollback"]')
  await expect(page.getByText('✓ Rolled back')).toBeVisible({ timeout: 10000 })
})

test('rollback modal closes on cancel', async ({ page }) => {
  await page.goto('/event/evt_001/diff')
  await page.click('[data-testid="rollback-button"]')
  await page.click('[data-testid="cancel-rollback"]')
  await expect(page.getByText('Confirm Rollback')).not.toBeVisible()
})
```

### 3.3 Playwright Config

```typescript
// apps/web/playwright.config.ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
})
```

---

## 4. Manual QA Checklist (Pre-Launch)

Run this checklist on the staging environment before every release:

### Extension Recording
- [ ] Gmail send captured in timeline within 2s
- [ ] Gmail send shows correct recipients, subject, body snapshot
- [ ] Docs edit captured in timeline within 5s
- [ ] Docs edit stores correct before/after revision IDs
- [ ] Slack message captured in timeline within 2s
- [ ] If backend is down, events queue locally and sync on reconnect
- [ ] Extension popup shows status dot (green = recording)

### Dashboard — Timeline
- [ ] Timeline updates in real-time without page refresh
- [ ] Filter by Gmail narrows feed to Gmail events only
- [ ] Filter by CRITICAL shows only critical events
- [ ] Risk badge tooltip shows reasons
- [ ] Infinite scroll loads next 20 events
- [ ] Empty state shows when no events

### Dashboard — Diff View
- [ ] Docs event diff shows correct before/after
- [ ] Additions highlighted green, removals highlighted red
- [ ] Split/unified view toggle works
- [ ] Email event shows before draft + after sent metadata

### Rollback
- [ ] Gmail rollback moves email to trash within 5s ✅
- [ ] Rollback confirmation modal shows plain-English description
- [ ] Pressing Escape closes modal without rollback
- [ ] Rollback button disabled after success
- [ ] `rollback_status` updates in UI without refresh
- [ ] Docs rollback restores prior revision ✅
- [ ] Slack rollback outside window shows clear error
- [ ] Failed rollback shows reason

### Auth & Settings
- [ ] Google sign-in works on first install
- [ ] Connector status cards show correct state
- [ ] Disconnecting Gmail updates card to "Disconnected"
- [ ] Reconnecting Gmail works from Settings
- [ ] User cannot see events from other users (RLS verified)

### Accessibility
- [ ] All interactive elements reachable by keyboard
- [ ] All images have alt text
- [ ] Colour contrast passes WCAG 2.1 AA

---

## 5. Coverage Thresholds

Enforced in CI — build fails if below:

```ini
# apps/backend/setup.cfg
[tool:pytest]
addopts = --cov=. --cov-fail-under=80
```

| Module | Min Coverage |
|--------|-------------|
| `core/risk_classifier.py` | 95% |
| `core/rollback_engine.py` | 85% |
| `connectors/` | 80% |
| `api/` | 75% |
| `workers/tasks.py` | 75% |
| Overall | 80% |

---

## 6. Testing Commands Summary

```bash
# ── Backend ──────────────────────────────────────────────
cd apps/backend && source venv/bin/activate

pytest tests/unit/          # Fast unit tests only
pytest tests/integration/   # Integration tests
pytest tests/ --cov=.       # Full suite with coverage
pytest tests/ -k "risk"     # Run tests matching "risk"

# ── Frontend ─────────────────────────────────────────────
pnpm --filter web test              # Vitest unit tests
pnpm --filter web test:coverage     # With coverage report
pnpm --filter web test:e2e          # Playwright E2E
pnpm --filter web test:e2e --ui     # Playwright with UI

# ── Full suite (from root) ────────────────────────────────
pnpm test                   # Runs all JS tests via Turborepo
```
