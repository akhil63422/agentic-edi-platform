"""
Ingestion Worker
Polls SFTP/S3 for new EDI files per partner transport_config.schedule.
Creates documents and triggers process_document for each file found.
"""
import asyncio
import logging
import re
import tempfile
import os
from datetime import datetime
from typing import Dict, Any, Optional
from bson import ObjectId

from app.core.database import get_database
from app.services.transport_service import transport_service
from app.workers.document_processor import processor

logger = logging.getLogger(__name__)

# Map frontend schedule values to cron expressions
SCHEDULE_MAP = {
    "hourly": "0 * * * *",   # Every hour
    "daily": "0 0 * * *",    # Midnight UTC
    "weekly": "0 0 * * 0",   # Sunday midnight
}


def _partner_to_transport_config(partner: dict) -> Optional[Dict[str, Any]]:
    """Convert partner transport_config (from frontend format) to transport_service format."""
    tc = partner.get("transport_config") or {}
    transport_type = tc.get("type") or partner.get("transportType") or tc.get("transport_type")

    if not transport_type or transport_type not in ("SFTP", "S3"):
        return None

    schedule = tc.get("schedule")
    if schedule in ("event", "manual", None):
        return None

    if transport_type == "SFTP":
        host = tc.get("host")
        port = int(tc.get("port") or 22)
        username = tc.get("username")
        password = tc.get("password")
        remote_path = tc.get("path") or tc.get("remote_path") or "/"
        if not host or not username:
            return None
        return {
            "type": "SFTP",
            "endpoint": {"host": host, "port": port},
            "credentials": {"username": username, "password": password},
            "remote_path": remote_path.rstrip("/") or "/",
            "schedule": SCHEDULE_MAP.get(schedule, schedule),
        }
    elif transport_type == "S3":
        bucket = tc.get("bucket")
        prefix = tc.get("prefix", "")
        if not bucket:
            return None
        return {
            "type": "S3",
            "bucket": bucket,
            "prefix": prefix,
            "schedule": SCHEDULE_MAP.get(schedule, schedule),
        }
    return None


def _detect_document_type(content: str) -> str:
    """Best-effort detection of EDI transaction set from raw content."""
    stripped = content.lstrip()
    if stripped.startswith("ISA"):
        m = re.search(r"ST\*(\d{3})\*", content)
        if m:
            return f"X12 {m.group(1)}"
        gs_map = {"PO": "850", "IN": "810", "SH": "856", "PR": "855", "FA": "997"}
        gm = re.search(r"GS\*([A-Z]{2})\*", content)
        if gm:
            code = gs_map.get(gm.group(1), "850")
            return f"X12 {code}"
        return "X12 850"
    if stripped.startswith("UNB") or stripped.startswith("UNA"):
        m = re.search(r"UNH\+[^+]+\+([A-Z]{6})", content)
        if m:
            return f"EDIFACT {m.group(1)}"
        return "EDIFACT ORDERS"
    return "X12 850"


async def _download_file_content(
    transport_config: Dict[str, Any],
    file_info: Dict[str, Any],
) -> Optional[str]:
    """Download file from SFTP or S3 and return content as string."""
    transport_type = transport_config.get("type")
    try:
        if transport_type == "SFTP":
            host = transport_config.get("endpoint", {}).get("host")
            port = transport_config.get("endpoint", {}).get("port", 22)
            username = transport_config.get("credentials", {}).get("username")
            password = transport_config.get("credentials", {}).get("password")
            remote_path = transport_config.get("remote_path", "/")
            file_path = file_info.get("path") or f"{remote_path}/{file_info.get('name', '')}"

            with tempfile.NamedTemporaryFile(mode="wb", suffix=".edi", delete=False) as tmp:
                tmp_path = tmp.name
            try:
                result = await transport_service.receive_file_sftp(
                    host=host,
                    port=port,
                    username=username,
                    password=password,
                    remote_path=file_path,
                    local_path=tmp_path,
                )
                if result.get("success"):
                    with open(tmp_path, "r", encoding="utf-8", errors="replace") as f:
                        return f.read()
            finally:
                if os.path.exists(tmp_path):
                    os.unlink(tmp_path)
        elif transport_type == "S3":
            bucket = transport_config.get("bucket")
            key = file_info.get("path") or file_info.get("name")

            with tempfile.NamedTemporaryFile(mode="wb", suffix=".edi", delete=False) as tmp:
                tmp_path = tmp.name
            try:
                result = await transport_service.receive_file_s3(
                    bucket=bucket,
                    key=key,
                    local_path=tmp_path,
                )
                if result.get("success"):
                    with open(tmp_path, "r", encoding="utf-8", errors="replace") as f:
                        return f.read()
            finally:
                if os.path.exists(tmp_path):
                    os.unlink(tmp_path)
    except Exception as e:
        logger.error(f"Error downloading file {file_info.get('name')}: {e}")
    return None


async def poll_for_partner(partner_id: str, partner: dict) -> int:
    """
    Poll transport for one partner. Create documents and trigger processing.
    Returns count of documents created.
    """
    transport_config = _partner_to_transport_config(partner)
    if not transport_config:
        return 0

    created = 0
    partner_id_str = str(partner_id)

    async def on_file(file_info: Dict[str, Any]):
        nonlocal created
        content = await _download_file_content(transport_config, file_info)
        if not content:
            return

        db = get_database()
        doc = {
            "partner_id": partner_id_str,
            "partner_code": partner.get("partner_code", "UNKNOWN"),
            "document_type": _detect_document_type(content),
            "direction": "Inbound",
            "flow_type": "inbound",
            "status": "Received",
            "raw_edi": content,
            "file_name": file_info.get("name", "unknown.edi"),
            "file_size": len(content),
            "received_at": datetime.utcnow(),
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "metadata": {
                "ingestion_source": "poll",
                "transport_type": transport_config.get("type"),
                "upload_source": "ingestion",
            },
        }
        result = await db.documents.insert_one(doc)
        doc_id = str(result.inserted_id)
        created += 1
        logger.info(f"Created document {doc_id} from poll for partner {partner_id_str}")

        # Trigger processing
        asyncio.create_task(processor.process_document(doc_id))

    # Run list_files in thread to avoid blocking (paramiko is sync)
    config_for_poll = {k: v for k, v in transport_config.items() if k != "schedule"}
    files_found = await asyncio.to_thread(
        transport_service.list_files,
        config_for_poll,
    )
    for file_info in files_found:
        await on_file(file_info)


async def run_ingestion_cycle():
    """Run one ingestion cycle for all partners with schedule."""
    db = get_database()
    cursor = db.trading_partners.find({"status": "Active"})
    partners = await cursor.to_list(length=500)

    total = 0
    for partner in partners:
        pid = partner.get("_id")
        if not pid:
            continue
        transport_config = _partner_to_transport_config(partner)
        if not transport_config:
            continue
        try:
            n = await poll_for_partner(str(pid), partner)
            total += n
        except Exception as e:
            logger.error(f"Error polling partner {pid}: {e}")

    if total > 0:
        logger.info(f"Ingestion cycle: created {total} documents")
    return total
