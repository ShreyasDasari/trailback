import pytest
from core.risk_classifier import classify_event, RiskResult


class TestActionBaseScore:
    def test_email_send_base_score(self):
        result = classify_event("gmail", "email.send", {"to": []}, None, None, None)
        assert result.score >= 10

    def test_doc_delete_base_score(self):
        result = classify_event("gdocs", "doc.delete", {}, None, None, None)
        assert result.score >= 30

    def test_unknown_action_gets_default(self):
        result = classify_event("gmail", "unknown.action", {}, None, None, None)
        assert result.score >= 5


class TestRecipientBreadth:
    def test_single_recipient_low_score(self):
        result = classify_event("gmail", "email.send", {"to": ["a@b.com"]}, None, None, None)
        assert result.score < 40

    def test_25_recipients_is_high_or_critical(self):
        to = [f"user{i}@ext.com" for i in range(25)]
        result = classify_event("gmail", "email.send", {"to": to}, None, None, None)
        assert result.level in ("high", "critical")
        assert result.score >= 40

    def test_10_recipients_high_or_critical(self):
        to = [f"user{i}@ext.com" for i in range(10)]
        result = classify_event("gmail", "email.send", {"to": to}, None, None, None)
        assert result.level in ("high", "critical")

    def test_mass_send_reason_in_reasons(self):
        to = [f"user{i}@ext.com" for i in range(25)]
        result = classify_event("gmail", "email.send", {"to": to}, None, None, None)
        assert any("25 recipients" in r for r in result.reasons)


class TestDocumentMagnitude:
    def test_large_change_adds_reason(self):
        before = {"content": "a" * 100}
        after = {"content": "a" * 6000}
        result = classify_event("gdocs", "doc.edit", {}, before, after, None)
        assert any("large" in r.lower() for r in result.reasons)

    def test_small_change_no_magnitude_reason(self):
        before = {"content": "Hello world"}
        after = {"content": "Hello World!"}
        result = classify_event("gdocs", "doc.edit", {}, before, after, None)
        assert not any("change" in r.lower() for r in result.reasons)


class TestSlackChannel:
    def test_public_channel_is_high_or_critical(self):
        result = classify_event(
            "slack", "message.post_public",
            {"channel_type": "public"}, None, None, None
        )
        assert result.level in ("high", "critical")
        assert any("public" in r.lower() for r in result.reasons)

    def test_dm_stays_low(self):
        result = classify_event(
            "slack", "message.post",
            {"channel_type": "dm"}, None, None, None
        )
        assert result.level == "low"


class TestScoreValidity:
    def test_score_never_exceeds_100(self):
        to = [f"u{i}@ext.com" for i in range(100)]
        result = classify_event("gmail", "email.send_bulk", {"to": to}, None, None, None)
        assert result.score <= 100

    def test_score_never_below_0(self):
        result = classify_event("gdocs", "doc.comment", {}, None, None, None)
        assert result.score >= 0

    def test_returns_correct_type(self):
        result = classify_event("gmail", "email.send", {"to": []}, None, None, None)
        assert isinstance(result, RiskResult)
        assert result.level in ("low", "medium", "high", "critical")
        assert isinstance(result.reasons, list)