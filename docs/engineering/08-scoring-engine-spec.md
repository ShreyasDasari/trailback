# 08 — Scoring Engine Specification
**Project:** Trailback
**Module:** `apps/backend/core/risk_classifier.py`
**Version:** 1.0
**Last Updated:** February 2026

---

## 1. Purpose

The Scoring Engine classifies every agent action with a **risk level** (LOW / MEDIUM / HIGH / CRITICAL) and a **numeric score** (0–100) based on deterministic, rule-based analysis. It runs synchronously during event ingestion (< 5ms target) and produces a human-readable list of reasons for every score.

It is intentionally **not LLM-based**. The classifier is a pure Python function — no external calls, no non-determinism, no cost.

---

## 2. Output Contract

```python
@dataclass
class RiskResult:
    level: str          # "low" | "medium" | "high" | "critical"
    score: int          # 0–100 inclusive
    reasons: list[str]  # Human-readable explanation strings
```

### Level Thresholds

| Score | Level | Badge Colour |
|-------|-------|-------------|
| 0–19 | `low` | Grey |
| 20–39 | `medium` | Yellow |
| 40–69 | `high` | Orange |
| 70–100 | `critical` | Red |

---

## 3. Rule Groups

### Group 1 — Action Type Base Score

Applied to every event based on the action type. This is the floor score.

| Action Type | Base Score | Rationale |
|-------------|-----------|-----------|
| `email.send` | 10 | Normal operation, but has external impact |
| `email.send_bulk` | 40 | Mass outreach risk |
| `email.delete` | 5 | Low risk, recoverable |
| `email.reply_all` | 15 | Reply-all can unintentionally broadcast |
| `doc.edit` | 8 | Normal, reversible |
| `doc.delete` | 30 | Hard to recover from without rollback |
| `doc.share` | 20 | Permissions change, external exposure |
| `doc.comment` | 2 | Low risk |
| `message.post` | 8 | Normal Slack operation |
| `message.post_public` | 20 | Public channel broadcast |
| `message.delete` | 5 | Low risk |
| `file.delete` | 35 | High risk, potential data loss |
| `calendar.create` | 8 | Creates external commitment |
| `calendar.delete` | 12 | Removes commitment others may depend on |
| *(unknown)* | 5 | Default for unrecognised types |

### Group 2 — Recipient Breadth (Gmail only)

Applied on top of Group 1 for email actions.

| Condition | Additional Score | Reason String |
|-----------|-----------------|---------------|
| `len(to) >= 20` | +35 | `"Email sent to {n} recipients — mass send"` |
| `10 ≤ len(to) < 20` | +25 | `"Email sent to {n} recipients"` |
| `5 ≤ len(to) < 10` | +15 | `"Email sent to {n} recipients"` |
| `2 ≤ len(to) < 5` | +5 | `"Email sent to {n} recipients"` |
| `len(to) == 1` | +0 | *(no reason added)* |

### Group 3 — External Domain (Gmail only)

| Condition | Additional Score | Reason String |
|-----------|-----------------|---------------|
| Any recipient on external domain | +15 | `"Email sent to {n} external address(es)"` |
| Recipient on known competitor domain (configurable list) | +10 | `"Email sent to competitor domain"` |

Internal domain is derived from the authenticated user's email address. Any `@domain.com` different from the user's own is treated as external.

### Group 4 — Document Change Magnitude (Docs only)

Computed from `abs(len(after_content) - len(before_content))`.

| Delta (characters) | Additional Score | Reason String |
|-------------------|-----------------|---------------|
| `>= 10,000` | +30 | `"Very large document change (~{delta} chars)"` |
| `5,000–9,999` | +20 | `"Large document change (~{delta} chars)"` |
| `1,000–4,999` | +10 | `"Moderate document change (~{delta} chars)"` |
| `< 1,000` | +0 | *(no reason added)* |

### Group 5 — Slack Channel Type

| Condition | Additional Score | Reason String |
|-----------|-----------------|---------------|
| `channel_type == "public"` | +20 | `"Posted to a public Slack channel"` |
| `channel_type == "private"` | +5 | *(no reason added)* |
| `channel_type == "dm"` | +0 | *(no reason added)* |

### Group 6 — Night/Weekend Timing

Actions taken outside business hours (before 08:00 or after 20:00 local time, or on weekends) receive a small additional score, as they are more likely to be unattended autonomous agent activity.

| Condition | Additional Score | Reason String |
|-----------|-----------------|---------------|
| Outside business hours (08:00–20:00) | +5 | `"Action taken outside business hours"` |
| Weekend | +8 | `"Action taken on a weekend"` |

> Note: This group is applied only when the user's timezone is available. Defaults to UTC.

### Group 7 — Agent History Modifier

If the agent has a trust score below 0.9 (meaning > 10% of its previous actions were rolled back), the final score is multiplied by a factor.

| Agent Trust Score | Multiplier | Reason String |
|------------------|-----------|---------------|
| `< 0.7` | × 1.3 | `"Agent has a low trust score ({score:.0%})"` |
| `0.7–0.89` | × 1.15 | `"Agent has a below-average trust score"` |
| `>= 0.9` | × 1.0 | *(no modifier)* |

**Important:** The multiplier is applied after all additive rules. The final score is clamped to `[0, 100]`.

---

## 4. Scoring Algorithm (Pseudocode)

```
function classify_event(app, action_type, metadata, before, after, agent):

    score = 0
    reasons = []

    # Group 1: Action type base score
    score += ACTION_BASE_SCORES.get(action_type, 5)

    # Group 2: Recipient breadth (Gmail only)
    if app == "gmail":
        n = len(metadata.get("to", []))
        if n >= 20:   score += 35; reasons.append(f"Email sent to {n} recipients — mass send")
        elif n >= 10: score += 25; reasons.append(f"Email sent to {n} recipients")
        elif n >= 5:  score += 15; reasons.append(f"Email sent to {n} recipients")
        elif n >= 2:  score += 5

    # Group 3: External domain (Gmail only)
    if app == "gmail":
        external = [e for e in metadata.get("to", []) if not is_internal(e)]
        if external:
            score += 15
            reasons.append(f"Email sent to {len(external)} external address(es)")

    # Group 4: Document change magnitude (Docs only)
    if app == "gdocs" and before and after:
        delta = abs(len(str(after)) - len(str(before)))
        if delta >= 10000:  score += 30; reasons.append(f"Very large document change (~{delta} chars)")
        elif delta >= 5000: score += 20; reasons.append(f"Large document change (~{delta} chars)")
        elif delta >= 1000: score += 10; reasons.append(f"Moderate document change (~{delta} chars)")

    # Group 5: Slack channel type
    if app == "slack":
        if metadata.get("channel_type") == "public":
            score += 20; reasons.append("Posted to a public Slack channel")
        elif metadata.get("channel_type") == "private":
            score += 5

    # Group 6: Timing
    hour = utcnow().hour
    weekday = utcnow().weekday()
    if hour < 8 or hour >= 20:
        score += 5; reasons.append("Action taken outside business hours")
    if weekday >= 5:
        score += 8; reasons.append("Action taken on a weekend")

    # Group 7: Agent history modifier (after all additive rules)
    if agent and agent.trust_score < 0.7:
        score = int(score * 1.3)
        reasons.append(f"Agent has a low trust score ({agent.trust_score:.0%})")
    elif agent and agent.trust_score < 0.9:
        score = int(score * 1.15)
        reasons.append("Agent has a below-average trust score")

    # Clamp to [0, 100]
    score = min(100, max(0, score))

    # Determine level
    if score >= 70:   level = "critical"
    elif score >= 40: level = "high"
    elif score >= 20: level = "medium"
    else:             level = "low"

    return RiskResult(level=level, score=score, reasons=reasons)
```

---

## 5. Example Scorings

### Example 1 — Single internal email (expected: LOW)
```
action_type: email.send          → +10
to: [alice@mycompany.com]        → +0 (1 recipient, internal)
Timing: Tuesday 14:30            → +0
Agent trust: 1.0                 → ×1.0

Score: 10 → LOW
Reasons: []
```

### Example 2 — Mass external email blast (expected: CRITICAL)
```
action_type: email.send          → +10
to: 25 external addresses        → +35 (>=20 recipients)
External domain                  → +15
Timing: Saturday 23:00           → +5 (outside hours) + +8 (weekend)
Agent trust: 0.65                → ×1.3

Score: (10+35+15+5+8) × 1.3 = 73 × 1.3 = 94.9 → clamped to 94 → CRITICAL
Reasons: ["Email sent to 25 recipients — mass send",
          "Email sent to 25 external address(es)",
          "Action taken outside business hours",
          "Action taken on a weekend",
          "Agent has a low trust score (65%)"]
```

### Example 3 — Large doc edit (expected: HIGH)
```
action_type: doc.edit            → +8
delta: 7,200 characters          → +20 (5,000–9,999)
Timing: Monday 10:15             → +0
Agent trust: 0.97                → ×1.0

Score: 28 → MEDIUM (just under HIGH threshold)
```

### Example 4 — Public Slack message (expected: MEDIUM)
```
action_type: message.post_public → +20
channel_type: public             → +20 (double-scored intentionally — public action type + public channel)
Timing: Wednesday 15:00          → +0

Score: 40 → HIGH
Reasons: ["Posted to a public Slack channel"]
```

---

## 6. Extension Points (Post-MVP)

The scoring engine is designed to be extended without breaking existing logic. New rule groups can be added as pluggable functions:

```python
RULE_GROUPS = [
    rule_action_base,
    rule_recipient_breadth,
    rule_external_domain,
    rule_document_magnitude,
    rule_slack_channel_type,
    rule_timing,
    rule_agent_history,
    # v2: rule_sensitive_keywords(content),
    # v2: rule_permission_escalation(metadata),
    # v3: rule_llm_anomaly_detection(event),  ← optional AI layer
]
```

Future rules under consideration:
- Sensitive keyword detection in email subject/body (configurable word lists)
- Permission escalation detection (doc.share to external domain)
- Unusual action sequence detection (5+ high-risk actions in 60 seconds)
- LLM-powered anomaly detection (async, non-blocking, opt-in)
