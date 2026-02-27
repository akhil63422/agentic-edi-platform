"""
Slack Notification Service
Sends alerts and notifications to Slack via Incoming Webhooks
"""
import logging
from typing import Optional
import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


class SlackService:
    """Send notifications to Slack via webhook"""

    def __init__(self):
        self._webhook_url: Optional[str] = getattr(settings, "SLACK_WEBHOOK_URL", None) or ""

    def set_webhook(self, url: Optional[str]) -> None:
        """Set webhook URL (from settings API or env)"""
        self._webhook_url = (url or "").strip() or getattr(settings, "SLACK_WEBHOOK_URL", None) or ""

    def get_webhook(self) -> Optional[str]:
        """Get current webhook URL (masked for security)"""
        if not self._webhook_url:
            return None
        # Show only last part for UI display
        parts = self._webhook_url.split("/")
        return f"...{parts[-1]}" if len(parts) > 1 else "***"

    def is_configured(self) -> bool:
        """Check if Slack webhook is configured"""
        url = self._webhook_url or getattr(settings, "SLACK_WEBHOOK_URL", None)
        return bool(url and url.startswith("https://hooks.slack.com/"))

    async def send_message(
        self,
        text: str,
        blocks: Optional[list] = None,
        username: str = "EDI Platform",
        icon_emoji: str = ":inbox_tray:",
    ) -> bool:
        """Send a message to Slack. Returns True if sent, False otherwise."""
        webhook_url = self._webhook_url or getattr(settings, "SLACK_WEBHOOK_URL", None)
        if not webhook_url or not webhook_url.startswith("https://hooks.slack.com/"):
            logger.debug("Slack webhook not configured, skipping notification")
            return False

        payload = {
            "text": text,
            "username": username,
            "icon_emoji": icon_emoji,
        }
        if blocks:
            payload["blocks"] = blocks

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(webhook_url, json=payload)
                if resp.status_code == 200:
                    return True
                logger.warning(f"Slack webhook returned {resp.status_code}: {resp.text[:200]}")
                return False
        except Exception as e:
            logger.error(f"Failed to send Slack notification: {e}")
            return False

    async def notify_exception(
        self,
        exception_type: str,
        severity: str,
        description: str,
        document_id: Optional[str] = None,
        partner_id: Optional[str] = None,
    ) -> bool:
        """Send exception alert to Slack"""
        emoji = ":rotating_light:" if severity in ("Critical", "High") else ":warning:"
        text = f"{emoji} *{severity} Exception*: {exception_type}\n{description}"
        if document_id:
            text += f"\nDocument: `{document_id}`"
        if partner_id:
            text += f" | Partner: `{partner_id}`"
        return await self.send_message(text, icon_emoji=emoji)

    async def notify_document_status(
        self,
        document_id: str,
        status: str,
        partner_code: Optional[str] = None,
        doc_type: Optional[str] = None,
    ) -> bool:
        """Send document processing status to Slack"""
        emoji = ":white_check_mark:" if status == "Completed" else ":x:" if status == "Failed" else ":hourglass_flowing_sand:"
        text = f"{emoji} Document *{status}*: `{document_id}`"
        if partner_code:
            text += f" | Partner: {partner_code}"
        if doc_type:
            text += f" | Type: {doc_type}"
        return await self.send_message(text, icon_emoji=emoji)

    async def notify_sla_violation(
        self,
        exception_id: str,
        severity: str,
        hours_overdue: float,
    ) -> bool:
        """Send SLA violation alert to Slack"""
        text = f":sos: *SLA Violation*: Exception `{exception_id}` ({severity}) is {hours_overdue:.1f}h overdue"
        return await self.send_message(text, icon_emoji=":sos:")


slack_service = SlackService()
