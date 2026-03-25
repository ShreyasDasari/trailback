# ─────────────────────────────────────────────────────────────
# Trailback — Celery Application
# Broker: Upstash Redis (REST-compatible via redis:// URL)
# Serializer: JSON (safe, language-agnostic)
# Timezone: UTC
# ─────────────────────────────────────────────────────────────

import os
from celery import Celery

UPSTASH_REDIS_URL = os.environ.get("UPSTASH_REDIS_URL")

if not UPSTASH_REDIS_URL:
    raise RuntimeError(
        "UPSTASH_REDIS_URL is not set. "
        "Set it in Render's environment variables or your local .env file. "
        "Get it from: https://console.upstash.com → your Redis database → REST URL "
        "(use the redis:// connection string, not the HTTPS REST URL)."
    )

celery_app = Celery(
    "trailback",
    broker=UPSTASH_REDIS_URL,
    backend=UPSTASH_REDIS_URL,
    include=["workers.tasks"],
)

celery_app.conf.update(
    # ── Serialization ─────────────────────────────────────────
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],

    # ── Timezone ──────────────────────────────────────────────
    timezone="UTC",
    enable_utc=True,

    # ── Reliability ───────────────────────────────────────────
    task_acks_late=True,            # Re-queue if worker crashes mid-task
    task_reject_on_worker_lost=True,
    task_track_started=True,

    # ── Result TTL ────────────────────────────────────────────
    result_expires=86400,           # Keep results for 24 hours

    # ── Retry defaults ────────────────────────────────────────
    task_max_retries=3,
)
