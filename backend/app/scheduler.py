"""
Background Scheduler
Runs ingestion polling per partner transport_config.schedule.
Uses APScheduler; starts with FastAPI lifespan.
"""
import asyncio
import logging
from typing import Optional

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.workers.ingestion_worker import run_ingestion_cycle

logger = logging.getLogger(__name__)

_scheduler: Optional[AsyncIOScheduler] = None


def get_scheduler() -> AsyncIOScheduler:
    global _scheduler
    if _scheduler is None:
        _scheduler = AsyncIOScheduler()
    return _scheduler


async def _run_ingestion_job():
    """Job wrapper for APScheduler."""
    try:
        await run_ingestion_cycle()
    except Exception as e:
        logger.error(f"Ingestion job failed: {e}")


def start_scheduler():
    """Start the scheduler with default ingestion job (hourly)."""
    sched = get_scheduler()
    if not sched.running:
        sched.add_job(
            _run_ingestion_job,
            CronTrigger.from_crontab("0 * * * *"),  # Every hour
            id="ingestion_poll",
            replace_existing=True,
        )
        sched.start()
        logger.info("Scheduler started: ingestion poll every hour")


def stop_scheduler():
    """Stop the scheduler."""
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info("Scheduler stopped")
