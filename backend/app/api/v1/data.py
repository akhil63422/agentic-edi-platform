"""
Export/Import endpoints for MVP demo - share DB snapshot as JSON file.
"""
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from bson import ObjectId
from app.core.database import get_database
import logging
import json

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/data", tags=["data"])


def serialize_doc(doc: dict) -> dict:
    """Convert MongoDB doc for JSON export (ObjectId -> str, datetime -> ISO)."""
    if not doc:
        return doc
    out = {}
    for k, v in doc.items():
        if k == "_id":
            out["_id"] = str(v)
        elif hasattr(v, "isoformat"):
            out[k] = v.isoformat()
        elif isinstance(v, dict):
            out[k] = serialize_doc(v)
        elif isinstance(v, list):
            out[k] = [serialize_doc(x) if isinstance(x, dict) else x for x in v]
        else:
            out[k] = v
    return out


@router.get("/export/")
async def export_data(db=Depends(get_database)):
    """
    Export all collections as a single JSON snapshot.
    Download this file and share with others for import.
    """
    try:
        partners = await db.trading_partners.find({}).to_list(length=10000)
        documents = await db.documents.find({}).to_list(length=10000)
        exceptions = await db.exceptions.find({}).to_list(length=10000)
        audit_logs = await db.audit_logs.find({}).to_list(length=10000)

        payload = {
            "version": "1.0",
            "exported_at": __import__("datetime").datetime.utcnow().isoformat() + "Z",
            "trading_partners": [serialize_doc(p) for p in partners],
            "documents": [serialize_doc(d) for d in documents],
            "exceptions": [serialize_doc(e) for e in exceptions],
            "audit_logs": [serialize_doc(a) for a in audit_logs],
        }

        return JSONResponse(content=payload)
    except Exception as e:
        logger.error(f"Export error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class ImportPayload(BaseModel):
    trading_partners: List[Dict[str, Any]] = []
    documents: List[Dict[str, Any]] = []
    exceptions: List[Dict[str, Any]] = []
    audit_logs: List[Dict[str, Any]] = []


def prepare_for_import(doc: dict) -> dict:
    """Strip _id and fix datetime strings for MongoDB insert."""
    if not doc:
        return doc
    out = {}
    for k, v in doc.items():
        if k == "_id":
            continue
        if k in ("created_at", "updated_at", "received_at", "processed_at", "timestamp") and isinstance(v, str):
            try:
                out[k] = __import__("datetime").datetime.fromisoformat(v.replace("Z", "+00:00"))
            except Exception:
                out[k] = v
        elif isinstance(v, dict):
            out[k] = prepare_for_import(v)
        elif isinstance(v, list):
            out[k] = [prepare_for_import(x) if isinstance(x, dict) else x for x in v]
        else:
            out[k] = v
    return out


@router.post("/import/", status_code=200)
async def import_data(payload: ImportPayload, db=Depends(get_database)):
    """
    Replace current DB with imported data.
    Clears existing collections and inserts the provided data.
    """
    try:
        # Clear existing
        await db.trading_partners.delete_many({})
        await db.documents.delete_many({})
        await db.exceptions.delete_many({})
        await db.audit_logs.delete_many({})

        # Build partner id map: old_id -> new_id (for document/exception references)
        id_map = {}

        # Insert partners
        for p in payload.trading_partners:
            clean = prepare_for_import(p)
            old_id = p.get("_id")
            result = await db.trading_partners.insert_one(clean)
            if old_id:
                id_map[f"partner_{old_id}"] = str(result.inserted_id)

        # Insert documents (partner_id may need remapping)
        for d in payload.documents:
            clean = prepare_for_import(d)
            old_partner = clean.get("partner_id")
            if old_partner and ObjectId.is_valid(old_partner) and f"partner_{old_partner}" in id_map:
                clean["partner_id"] = id_map[f"partner_{old_partner}"]
            await db.documents.insert_one(clean)

        # Insert exceptions
        for e in payload.exceptions:
            clean = prepare_for_import(e)
            await db.exceptions.insert_one(clean)

        # Insert audit logs
        for a in payload.audit_logs:
            clean = prepare_for_import(a)
            await db.audit_logs.insert_one(clean)

        counts = {
            "trading_partners": len(payload.trading_partners),
            "documents": len(payload.documents),
            "exceptions": len(payload.exceptions),
            "audit_logs": len(payload.audit_logs),
        }

        logger.info(f"Import complete: {counts}")

        return {
            "success": True,
            "message": "Data imported successfully. Refresh the page to see the changes.",
            "counts": counts,
        }
    except Exception as e:
        logger.error(f"Import error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
