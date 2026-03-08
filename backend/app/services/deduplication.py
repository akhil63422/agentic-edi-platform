"""
De-duplication Service
Checks for duplicate documents before processing (per architecture Process Layer)
"""
from typing import Dict, Any, Optional
from datetime import datetime, timedelta
import hashlib
import logging
from bson import ObjectId

logger = logging.getLogger(__name__)


def compute_document_hash(raw_edi: str, partner_id: str, document_type: str) -> str:
    """Compute a hash for de-duplication check."""
    content = f"{partner_id}|{document_type}|{raw_edi.strip()}"
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


async def is_duplicate(
    db,
    raw_edi: str,
    partner_id: str,
    document_type: str,
    direction: str,
    window_hours: int = 24,
    exclude_document_id: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """
    Check if this document is a duplicate of one received within window_hours.
    Returns the existing document if duplicate, else None.
    """
    doc_hash = compute_document_hash(raw_edi, partner_id, document_type)
    cutoff = datetime.utcnow() - timedelta(hours=window_hours)

    query_hash = {
        "partner_id": partner_id,
        "document_type": document_type,
        "direction": direction,
        "metadata.dedup_hash": doc_hash,
        "received_at": {"$gte": cutoff},
    }
    if exclude_document_id and ObjectId.is_valid(exclude_document_id):
        query_hash["_id"] = {"$ne": ObjectId(exclude_document_id)}

    existing = await db.documents.find_one(query_hash)
    if existing:
        return existing

    # Fallback: same raw content (for docs created before we stored hash)
    query_raw = {
        "partner_id": partner_id,
        "document_type": document_type,
        "direction": direction,
        "raw_edi": raw_edi.strip(),
        "received_at": {"$gte": cutoff},
    }
    if exclude_document_id and ObjectId.is_valid(exclude_document_id):
        query_raw["_id"] = {"$ne": ObjectId(exclude_document_id)}
    return await db.documents.find_one(query_raw)
