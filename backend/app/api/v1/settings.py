"""
Settings API - platform configuration including Slack webhook
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional

from app.core.database import get_database
from app.api.v1.dependencies import require_auth_if_enabled
from app.services.slack_service import slack_service

router = APIRouter(prefix="/settings", tags=["settings"], dependencies=[Depends(require_auth_if_enabled)])

SETTINGS_DOC_ID = "platform"


class SettingsUpdate(BaseModel):
    """Settings that can be updated via API"""
    slack_webhook_url: Optional[str] = Field(None, description="Slack Incoming Webhook URL")
    exception_alerts: Optional[bool] = Field(None, description="Send Slack alerts for exceptions")
    document_alerts: Optional[bool] = Field(None, description="Send Slack alerts for document status changes")
    our_company_isa_id: Optional[str] = Field(None, description="Our company ISA ID for auto-detecting Inbound/Outbound")


class SettingsResponse(BaseModel):
    """Settings response - webhook URL is masked"""
    slack_webhook_configured: bool = False
    slack_webhook_masked: Optional[str] = None
    exception_alerts: bool = True
    document_alerts: bool = True
    our_company_isa_id: Optional[str] = None


@router.get("", response_model=SettingsResponse)
async def get_settings(db=Depends(get_database)):
    """Get platform settings (Slack webhook is masked for security)"""
    doc = await db.platform_settings.find_one({"_id": SETTINGS_DOC_ID})
    if doc and doc.get("slack_webhook_url"):
        slack_service.set_webhook(doc["slack_webhook_url"])
    if not doc:
        # Check env fallback
        from app.core.config import settings
        configured = slack_service.is_configured()
        return SettingsResponse(
            slack_webhook_configured=configured,
            slack_webhook_masked=slack_service.get_webhook() if configured else None,
            exception_alerts=True,
            document_alerts=True,
            our_company_isa_id=settings.OUR_COMPANY_ISA_ID,
        )
    from app.core.config import settings
    return SettingsResponse(
        slack_webhook_configured=bool(doc.get("slack_webhook_url")),
        slack_webhook_masked=slack_service.get_webhook() if doc.get("slack_webhook_url") else None,
        exception_alerts=doc.get("exception_alerts", True),
        document_alerts=doc.get("document_alerts", True),
        our_company_isa_id=doc.get("our_company_isa_id") or settings.OUR_COMPANY_ISA_ID,
    )


@router.patch("", response_model=SettingsResponse)
async def update_settings(update: SettingsUpdate, db=Depends(get_database)):
    """Update platform settings"""
    doc = await db.platform_settings.find_one({"_id": SETTINGS_DOC_ID}) or {}
    current = doc.copy()

    if update.slack_webhook_url is not None:
        url = (update.slack_webhook_url or "").strip()
        if url and not url.startswith("https://hooks.slack.com/"):
            raise HTTPException(
                status_code=400,
                detail="Invalid Slack webhook URL. Must start with https://hooks.slack.com/"
            )
        current["slack_webhook_url"] = url or None
        slack_service.set_webhook(url or None)

    if update.exception_alerts is not None:
        current["exception_alerts"] = update.exception_alerts
    if update.document_alerts is not None:
        current["document_alerts"] = update.document_alerts
    if update.our_company_isa_id is not None:
        current["our_company_isa_id"] = (update.our_company_isa_id or "").strip() or None

    current["_id"] = SETTINGS_DOC_ID
    await db.platform_settings.update_one(
        {"_id": SETTINGS_DOC_ID},
        {"$set": current},
        upsert=True,
    )

    from app.core.config import settings
    return SettingsResponse(
        slack_webhook_configured=bool(current.get("slack_webhook_url")),
        slack_webhook_masked=slack_service.get_webhook() if current.get("slack_webhook_url") else None,
        exception_alerts=current.get("exception_alerts", True),
        document_alerts=current.get("document_alerts", True),
        our_company_isa_id=current.get("our_company_isa_id") or settings.OUR_COMPANY_ISA_ID,
    )
