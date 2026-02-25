from dataclasses import dataclass, field
from typing import Optional, Dict, Any
import json

@dataclass
class RiskResult:
    level: str
    score: int
    reasons: list = field(default_factory=list)

ACTION_BASE_SCORES = {
    'email.send': 10,
    'email.send_bulk': 40,
    'email.delete': 5,
    'email.reply_all': 15,
    'doc.edit': 8,
    'doc.delete': 30,
    'doc.share': 20,
    'doc.comment': 2,
    'message.post': 8,
    'message.post_public': 20,
    'message.delete': 5,
    'file.delete': 35,
}

def classify_event(
    app: str,
    action_type: str,
    metadata: Dict[str, Any],
    before: Optional[Dict],
    after: Optional[Dict],
    agent=None
) -> RiskResult:
    score = 0
    reasons = []

    # Group 1: Action base score
    score += ACTION_BASE_SCORES.get(action_type, 5)

    # Group 2: Recipient breadth (Gmail only)
    if app == 'gmail':
        recipients = metadata.get('to', [])
        n = len(recipients)
        if n >= 20:
            score += 35
            reasons.append(f"Email sent to {n} recipients — mass send")
        elif n >= 10:
            score += 25
            reasons.append(f"Email sent to {n} recipients")
        elif n >= 5:
            score += 15
            reasons.append(f"Email sent to {n} recipients")
        elif n >= 2:
            score += 5

    # Group 3: External domain (Gmail only)
    if app == 'gmail':
        recipients = metadata.get('to', [])
        if recipients:
            score += 15
            reasons.append(f"Email sent to {len(recipients)} external address(es)")

    # Group 4: Document change magnitude (Docs only)
    if app == 'gdocs' and before and after:
        delta = abs(len(json.dumps(after)) - len(json.dumps(before)))
        if delta >= 10000:
            score += 30
            reasons.append(f"Very large document change (~{delta} chars)")
        elif delta >= 5000:
            score += 20
            reasons.append(f"Large document change (~{delta} chars)")
        elif delta >= 1000:
            score += 10
            reasons.append(f"Moderate document change (~{delta} chars)")

    # Group 5: Slack channel type
    if app == 'slack':
        if metadata.get('channel_type') == 'public':
            score += 20
            reasons.append("Posted to a public Slack channel")
        elif metadata.get('channel_type') == 'private':
            score += 5

    # Group 6: Timing (outside business hours)
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    if now.hour < 8 or now.hour >= 20:
        score += 5
        reasons.append("Action taken outside business hours")
    if now.weekday() >= 5:
        score += 8
        reasons.append("Action taken on a weekend")

    # Group 7: Agent trust score modifier
    if agent and hasattr(agent, 'trust_score'):
        if agent.trust_score < 0.7:
            score = int(score * 1.3)
            reasons.append(f"Agent has a low trust score ({agent.trust_score:.0%})")
        elif agent.trust_score < 0.9:
            score = int(score * 1.15)
            reasons.append("Agent has a below-average trust score")

    # Clamp score to 0-100
    score = min(100, max(0, score))

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