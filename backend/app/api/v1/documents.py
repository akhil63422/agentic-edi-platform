from fastapi import APIRouter, HTTPException, Depends, Query, UploadFile, File, BackgroundTasks, Form
from typing import List, Optional, Dict, Any
from datetime import datetime
from bson import ObjectId
from pydantic import BaseModel
from app.core.database import get_database
from app.api.v1.dependencies import require_auth_if_enabled
from app.models.document import EDIDocument, DocumentCreate, DocumentUpdate
from app.models.audit import AuditLogCreate
from app.services.deduplication import compute_document_hash
from app.services.canonical_builder import rule_based_canonical
from app.services.edi_parser import parse_edi
from app.services.direction_resolver import resolve_direction
import logging
import re
import os

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Helpers: auto-detect standard and transaction set from raw EDI content
# ---------------------------------------------------------------------------

def _detect_standard(content: str) -> str:
    """Return 'X12', 'EDIFACT', 'JSON', or 'XML'."""
    stripped = content.lstrip()
    if stripped.startswith("ISA"):
        return "X12"
    if stripped.startswith("UNB") or stripped.startswith("UNA"):
        return "EDIFACT"
    if stripped.startswith("{") or stripped.startswith("["):
        return "JSON"
    if stripped.startswith("<"):
        return "XML"
    return "X12"  # safe default


def _detect_document_type(content: str, standard: str) -> str:
    """Best-effort detection of the EDI transaction set / message type."""
    if standard == "X12":
        # ST*850*… → "850", etc.
        m = re.search(r"ST\*(\d{3})\*", content)
        if m:
            return f"X12 {m.group(1)}"
        # GS*PO → 850, GS*IN → 810, GS*SH → 856, etc.
        gs_map = {"PO": "850", "IN": "810", "SH": "856", "PR": "855",
                  "FA": "997", "OW": "940", "IA": "945"}
        gm = re.search(r"GS\*([A-Z]{2})\*", content)
        if gm:
            code = gs_map.get(gm.group(1))
            if code:
                return f"X12 {code}"
    elif standard == "EDIFACT":
        m = re.search(r"UNH\+[^+]+\+([A-Z]{6})", content)
        if m:
            return f"EDIFACT {m.group(1)}"
    return f"{standard} Document"

router = APIRouter(prefix="/documents", tags=["documents"], dependencies=[Depends(require_auth_if_enabled)])


@router.post("/upload", status_code=201)
async def upload_document(
    background_tasks: BackgroundTasks,
    db=Depends(get_database),
    file: UploadFile = File(...),
    partner_id: Optional[str] = Form(None),
    direction: Optional[str] = Form(None),
):
    """
    Accept a raw EDI file upload, auto-detect standard + transaction type,
    persist it as a document, and kick off the 10-step pipeline in the background.
    Direction is auto-detected from ISA/UNB sender/receiver vs platform our_company_isa_id.
    """
    try:
        raw_bytes = await file.read()
        try:
            content = raw_bytes.decode("utf-8")
        except UnicodeDecodeError:
            content = raw_bytes.decode("latin-1")

        if not content.strip():
            raise HTTPException(status_code=400, detail="Uploaded file is empty")

        standard = _detect_standard(content)
        doc_type = _detect_document_type(content, standard)
        now = datetime.utcnow()

        # Resolve direction from ISA/UNB vs platform identity
        source_system = ""
        target_system = ""
        isa_sender_id = ""
        isa_receiver_id = ""
        if standard in ("X12", "EDIFACT"):
            try:
                parsed = parse_edi(content, standard)
                our_id = None
                settings_doc = await db.platform_settings.find_one({"_id": "platform"})
                if settings_doc and settings_doc.get("our_company_isa_id"):
                    our_id = settings_doc["our_company_isa_id"]
                else:
                    from app.core.config import settings
                    our_id = settings.OUR_COMPANY_ISA_ID
                direction_resolved, source_system, target_system = resolve_direction(
                    parsed, our_id, fallback="Inbound"
                )
                if not direction:
                    direction = direction_resolved
                # Extract ISA sender/receiver for audit
                for seg in parsed.get("segments", []):
                    if seg.get("segment_id") == "ISA" and seg.get("data"):
                        isa_sender_id = (seg["data"].get("interchange_sender_id") or "").strip()
                        isa_receiver_id = (seg["data"].get("interchange_receiver_id") or "").strip()
                        break
                    if seg.get("segment_id") == "UNB" and seg.get("elements"):
                        els = seg["elements"]
                        if len(els) >= 3:
                            isa_sender_id = (els[1] or "").strip()
                            isa_receiver_id = (els[2] or "").strip()
                        break
            except Exception as e:
                logger.warning(f"Direction parse failed, using fallback: {e}")
                if not direction:
                    direction = "Inbound"
        if not direction:
            direction = "Inbound"

        # Resolve partner: use provided ID or fall back to first partner
        if partner_id and ObjectId.is_valid(partner_id):
            partner = await db.trading_partners.find_one({"_id": ObjectId(partner_id)})
        else:
            partner = await db.trading_partners.find_one({})

        if partner:
            resolved_partner_id = str(partner["_id"])
            partner_code = partner.get("partner_code", "UNKNOWN")
        else:
            # Create minimal default partner when DB is empty (e.g. after clear_demo_data)
            default_partner = {
                "partner_code": "DEFAULT",
                "partner_name": "Default Partner",
                "edi_config": {"standard": "X12", "version": "5010"},
                "erp_context": {},
                "created_at": now,
                "updated_at": now,
            }
            result = await db.trading_partners.insert_one(default_partner)
            resolved_partner_id = str(result.inserted_id)
            partner_code = "DEFAULT"

        flow_type = "inbound" if direction == "Inbound" else "outbound"
        doc_dict = {
            "partner_id": resolved_partner_id,
            "partner_code": partner_code,
            "document_type": doc_type,
            "direction": direction,
            "flow_type": flow_type,
            "source_system": source_system,
            "target_system": target_system,
            "status": "Received",
            "processing_step": 1,
            "raw_edi": content,
            "parsed_segments": [],
            "canonical_json": None,
            "x12_output": None,
            "ai_confidence_score": 0.0,
            "ai_explanation": None,
            "validation_results": [],
            "exception_ids": [],
            "erp_posted": False,
            "erp_response": None,
            "acknowledgment_sent": False,
            "acknowledgment_type": None,
            "file_name": file.filename or f"upload_{now.strftime('%Y%m%d%H%M%S')}.edi",
            "file_size": len(raw_bytes),
            "received_at": now,
            "processed_at": None,
            "created_at": now,
            "updated_at": now,
            "metadata": {
                "detected_standard": standard,
                "detection_confidence": 1.0,
                "upload_source": "dashboard",
                "isa_sender_id": isa_sender_id or None,
                "isa_receiver_id": isa_receiver_id or None,
            },
        }
        # Each manual upload gets a unique hash (timestamp-salted) so it is
        # never blocked by the 24-hour dedup window for dashboard testing.
        import hashlib as _hashlib
        unique_salt = now.isoformat()
        doc_dict["metadata"]["dedup_hash"] = _hashlib.sha256(
            f"{resolved_partner_id}|{doc_type}|{unique_salt}|{content.strip()}".encode()
        ).hexdigest()

        result = await db.documents.insert_one(doc_dict)
        document_id = str(result.inserted_id)

        # Audit log
        await db.audit_logs.insert_one({
            "action_type": "Upload",
            "action": "Created",
            "entity_type": "Document",
            "entity_id": document_id,
            "description": f"Uploaded {direction} {doc_type} via dashboard",
            "created_at": now,
        })

        # Kick off 10-step pipeline in background
        from app.workers.document_processor import processor
        async def _run_pipeline():
            try:
                await processor.process_document(document_id)
            except Exception as e:
                import traceback
                logger.error(f"Pipeline failed for {document_id}: {e}\n{traceback.format_exc()}")
                raise
        background_tasks.add_task(_run_pipeline)

        return {
            "document_id": document_id,
            "document_type": doc_type,
            "standard": standard,
            "direction": direction,
            "partner_code": partner_code,
            "file_name": file.filename,
            "file_size": len(raw_bytes),
            "status": "Received",
            "processing_step": 1,
            "message": "File uploaded. Pipeline started.",
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Upload error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/", response_model=List[EDIDocument])
async def get_documents(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    direction: Optional[str] = None,
    status: Optional[str] = None,
    partner_id: Optional[str] = None,
    document_type: Optional[str] = None,
    db=Depends(get_database)
):
    """Get all documents"""
    try:
        query = {}
        if direction:
            query["direction"] = direction
        if status:
            query["status"] = status
        if partner_id:
            if ObjectId.is_valid(partner_id):
                query["partner_id"] = partner_id
        if document_type:
            query["document_type"] = document_type
        
        cursor = db.documents.find(query).sort("received_at", -1).skip(skip).limit(limit)
        documents = await cursor.to_list(length=limit)
        
        # Convert ObjectId to string
        for doc in documents:
            doc["_id"] = str(doc["_id"])
        
        return documents
    except Exception as e:
        logger.error(f"Error fetching documents: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{document_id}", response_model=EDIDocument)
async def get_document(document_id: str, db=Depends(get_database)):
    """Get a specific document"""
    try:
        if not ObjectId.is_valid(document_id):
            raise HTTPException(status_code=400, detail="Invalid document ID")
        
        document = await db.documents.find_one({"_id": ObjectId(document_id)})
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        
        document["_id"] = str(document["_id"])
        return document
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching document {document_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/", response_model=EDIDocument, status_code=201)
async def create_document(document_data: DocumentCreate, db=Depends(get_database)):
    """Create a new document"""
    try:
        # Verify partner exists
        if ObjectId.is_valid(document_data.partner_id):
            partner = await db.trading_partners.find_one({"_id": ObjectId(document_data.partner_id)})
            if not partner:
                raise HTTPException(status_code=404, detail="Partner not found")
            partner_code = partner.get("partner_code")
        else:
            partner_code = None
        
        document_dict = document_data.model_dump()
        document_dict["partner_code"] = partner_code
        document_dict["flow_type"] = "inbound" if document_data.direction == "Inbound" else "outbound"
        document_dict["received_at"] = datetime.utcnow()
        document_dict["created_at"] = datetime.utcnow()
        document_dict["updated_at"] = datetime.utcnow()
        document_dict["metadata"] = document_dict.get("metadata") or {}
        document_dict["metadata"]["dedup_hash"] = compute_document_hash(
            document_dict["raw_edi"],
            document_data.partner_id,
            document_data.document_type,
        )

        result = await db.documents.insert_one(document_dict)
        document = await db.documents.find_one({"_id": result.inserted_id})
        document["_id"] = str(document["_id"])
        
        # Create audit log
        audit_log = AuditLogCreate(
            action_type="Processing",
            action="Created",
            entity_type="Document",
            entity_id=str(result.inserted_id),
            description=f"Created {document_data.direction} document: {document_data.document_type}"
        )
        await db.audit_logs.insert_one(audit_log.model_dump())
        
        return document
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating document: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{document_id}", response_model=EDIDocument)
async def update_document(
    document_id: str,
    document_data: DocumentUpdate,
    db=Depends(get_database)
):
    """Update a document"""
    try:
        if not ObjectId.is_valid(document_id):
            raise HTTPException(status_code=400, detail="Invalid document ID")
        
        document = await db.documents.find_one({"_id": ObjectId(document_id)})
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        
        update_data = document_data.model_dump(exclude_unset=True)
        update_data["updated_at"] = datetime.utcnow()
        
        await db.documents.update_one(
            {"_id": ObjectId(document_id)},
            {"$set": update_data}
        )
        
        updated_document = await db.documents.find_one({"_id": ObjectId(document_id)})
        updated_document["_id"] = str(updated_document["_id"])
        
        # Create audit log
        audit_log = AuditLogCreate(
            action_type="Processing",
            action="Updated",
            entity_type="Document",
            entity_id=document_id,
            description=f"Updated document status: {update_data.get('status', 'Unknown')}"
        )
        await db.audit_logs.insert_one(audit_log.model_dump())
        
        return updated_document
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating document {document_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Review & Correction endpoints
# ---------------------------------------------------------------------------

class CorrectionRequest(BaseModel):
    segment_id: str
    field_name: str
    old_value: str
    new_value: str
    apply_to_canonical: Optional[bool] = True


async def _build_ai_suggestions(document: dict, exceptions: list) -> list:
    """
    Generate AI suggestions from validation_results + exceptions.
    Uses GPT-4o-mini when available; falls back to rule-based heuristics.
    """
    validation_results = document.get("validation_results", [])
    raw_edi = document.get("raw_edi", "")
    parsed_segments = document.get("parsed_segments", [])
    canonical = document.get("canonical_json") or {}

    suggestions = []

    # ── Try OpenAI GPT-4o-mini ──────────────────────────────────────────────
    openai_key = os.getenv("OPENAI_API_KEY", "")
    if openai_key and (validation_results or exceptions):
        try:
            from openai import AsyncOpenAI
            client = AsyncOpenAI(api_key=openai_key)

            errors_summary = "\n".join(
                f"- [{v.get('severity','?')}] {v.get('message', v.get('type', ''))}"
                for v in validation_results
            )
            exc_summary = "\n".join(
                f"- [{e.get('severity','?')}] {e.get('exception_type','')}: {e.get('description','')}"
                for e in exceptions[:5]
            )
            seg_sample = raw_edi[:1500] if raw_edi else ""

            prompt = f"""You are an EDI document expert. Analyze this X12 EDI document and its validation errors, then suggest specific field-level corrections.

VALIDATION ERRORS:
{errors_summary or 'None'}

EXCEPTIONS:
{exc_summary or 'None'}

RAW EDI (first 1500 chars):
{seg_sample}

For each issue, return a JSON array of suggestions with this exact structure:
[
  {{
    "field_name": "field label shown to user",
    "segment_id": "X12 segment like BEG or ISA",
    "issue": "brief description of the problem",
    "current_value": "current field value or empty string",
    "suggested_value": "corrected value",
    "reason": "why this correction is needed",
    "confidence": 0.0 to 1.0
  }}
]
Return ONLY the JSON array, no markdown, no explanation."""

            resp = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are an EDI corrections expert. Return only valid JSON."},
                    {"role": "user", "content": prompt},
                ],
                max_tokens=800,
                temperature=0.2,
            )
            import json as _json
            raw_text = resp.choices[0].message.content.strip()
            # Strip markdown fences if present
            if raw_text.startswith("```"):
                raw_text = re.sub(r"```[a-z]*\n?", "", raw_text).strip("`").strip()
            ai_suggestions = _json.loads(raw_text)
            if isinstance(ai_suggestions, list):
                suggestions = ai_suggestions
        except Exception as e:
            logger.warning(f"AI suggestion generation failed: {e}")

    # ── Rule-based fallback ─────────────────────────────────────────────────
    if not suggestions:
        for v in validation_results:
            msg = v.get("message", "")
            if "Missing required segment" in msg:
                seg = msg.replace("Missing required segment:", "").strip()
                suggestions.append({
                    "field_name": f"Segment {seg}",
                    "segment_id": seg,
                    "issue": f"Required X12 segment {seg} is absent",
                    "current_value": "",
                    "suggested_value": f"<Add {seg} segment>",
                    "reason": f"X12 standard requires the {seg} segment for valid interchange",
                    "confidence": 0.95,
                })
        for exc in exceptions[:5]:
            suggestions.append({
                "field_name": exc.get("exception_type", "Unknown"),
                "segment_id": "",
                "issue": exc.get("description", ""),
                "current_value": "",
                "suggested_value": "",
                "reason": f"Severity: {exc.get('severity','?')}",
                "confidence": 0.7,
            })

    return suggestions


@router.get("/{document_id}/review")
async def get_document_review(document_id: str, db=Depends(get_database)):
    """
    Return the document enriched with AI-generated field suggestions
    for the Manual Review workspace.
    """
    try:
        if not ObjectId.is_valid(document_id):
            raise HTTPException(status_code=400, detail="Invalid document ID")

        document = await db.documents.find_one({"_id": ObjectId(document_id)})
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        document["_id"] = str(document["_id"])

        # Fetch related exceptions (exclude Low Confidence when AI already fixed)
        exc_cursor = db.exceptions.find({"document_id": document_id}).sort("created_at", -1).limit(20)
        exceptions = await exc_cursor.to_list(length=20)
        for e in exceptions:
            e["_id"] = str(e["_id"])

        # Remove Low Confidence — AI auto-fixes or we don't flag it
        exceptions = [e for e in exceptions if (e.get("exception_type") or "").lower() != "low confidence"]
        ai_fixed = document.get("metadata", {}).get("ai_fixed_errors", [])
        if ai_fixed:
            suggestions = []  # AI already fixed; no pending suggestions
        else:
            suggestions = await _build_ai_suggestions(document, exceptions)

        # Fetch partner info
        partner = None
        pid = document.get("partner_id", "")
        if pid and ObjectId.is_valid(pid):
            partner = await db.trading_partners.find_one({"_id": ObjectId(pid)})
        if partner:
            partner["_id"] = str(partner["_id"])

        return {
            "document": document,
            "exceptions": exceptions,
            "ai_suggestions": suggestions,
            "partner": partner,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error building review for {document_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{document_id}/review/apply")
async def apply_correction(
    document_id: str,
    correction: CorrectionRequest,
    db=Depends(get_database),
):
    """
    Apply a user-approved correction to the document's parsed segments
    and canonical JSON, then persist to DB.
    """
    try:
        if not ObjectId.is_valid(document_id):
            raise HTTPException(status_code=400, detail="Invalid document ID")

        document = await db.documents.find_one({"_id": ObjectId(document_id)})
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")

        parsed_segments = document.get("parsed_segments", [])
        canonical = document.get("canonical_json") or {}

        # Patch the matching segment field
        updated_segments = []
        for seg in parsed_segments:
            if seg.get("segment_id") == correction.segment_id:
                seg_data = dict(seg.get("data", {}))
                # Find matching key by value
                for k, v in seg_data.items():
                    if str(v) == str(correction.old_value):
                        seg_data[k] = correction.new_value
                        break
                seg = {**seg, "data": seg_data}
            updated_segments.append(seg)

        update_payload: Dict[str, Any] = {
            "parsed_segments": updated_segments,
            "updated_at": datetime.utcnow(),
            "metadata.last_correction": {
                "field": correction.field_name,
                "old": correction.old_value,
                "new": correction.new_value,
                "corrected_at": datetime.utcnow().isoformat(),
            },
        }

        # Regenerate canonical JSON when apply_to_canonical is True
        if correction.apply_to_canonical and updated_segments:
            doc_type = document.get("document_type", "")
            new_canonical = rule_based_canonical(updated_segments, doc_type)
            update_payload["canonical_json"] = new_canonical
            direction = document.get("direction", "Inbound")
            update_payload["status"] = "Ready for Dispatch" if direction == "Inbound" else "Completed"
            update_payload["ai_confidence_score"] = 1.0

        await db.documents.update_one(
            {"_id": ObjectId(document_id)},
            {"$set": update_payload}
        )

        # Audit
        await db.audit_logs.insert_one({
            "action_type": "Review",
            "action": "Correction Applied",
            "entity_type": "Document",
            "entity_id": document_id,
            "description": (
                f"Field '{correction.field_name}' in segment {correction.segment_id} "
                f"corrected from '{correction.old_value}' → '{correction.new_value}'"
            ),
            "created_at": datetime.utcnow(),
        })

        return {"success": True, "message": "Correction applied"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error applying correction to {document_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{document_id}/reprocess")
async def reprocess_document(
    document_id: str,
    background_tasks: BackgroundTasks,
    db=Depends(get_database),
):
    """Re-run the full 10-step processing pipeline for this document."""
    try:
        if not ObjectId.is_valid(document_id):
            raise HTTPException(status_code=400, detail="Invalid document ID")

        document = await db.documents.find_one({"_id": ObjectId(document_id)})
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")

        # Reset processing state
        await db.documents.update_one(
            {"_id": ObjectId(document_id)},
            {"$set": {
                "status": "Received",
                "processing_step": 1,
                "validation_results": [],
                "parsed_segments": [],
                "canonical_json": None,
                "ai_confidence_score": 0.0,
                "erp_posted": False,
                "acknowledgment_sent": False,
                "updated_at": datetime.utcnow(),
                # timestamp-salt so dedup won't block the re-run
                "metadata.upload_source": "dashboard",
            }}
        )

        await db.audit_logs.insert_one({
            "action_type": "Processing",
            "action": "Reprocessed",
            "entity_type": "Document",
            "entity_id": document_id,
            "description": "Manual re-run triggered from review workspace",
            "created_at": datetime.utcnow(),
        })

        from app.workers.document_processor import processor
        background_tasks.add_task(processor.process_document, document_id)

        return {"success": True, "message": "Pipeline re-started", "document_id": document_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error reprocessing {document_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{document_id}/create-outbound")
async def create_outbound_from_inbound(
    document_id: str,
    background_tasks: BackgroundTasks,
    db=Depends(get_database),
):
    """
    Create outbound transmission from inbound. Validates Ready for Dispatch,
    creates new outbound record, links via parent_transaction_id, triggers outbound pipeline.
    Replaces legacy Send to ERP — inbound and outbound are separate transactions.
    """
    try:
        if not ObjectId.is_valid(document_id):
            raise HTTPException(status_code=400, detail="Invalid document ID")

        document = await db.documents.find_one({"_id": ObjectId(document_id)})
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")

        # Guardrails: must be inbound, canonical exists, not failed
        if document.get("direction") != "Inbound":
            raise HTTPException(status_code=422, detail="Only inbound documents can create outbound transmission")
        canonical = document.get("canonical_json")
        if not canonical:
            raise HTTPException(status_code=422, detail="No canonical JSON — generate canonical first")
        status = document.get("status", "")
        if status in ("Failed", "Duplicate"):
            raise HTTPException(status_code=422, detail=f"Cannot create outbound from {status} inbound")
        # Accept Ready for Dispatch, Completed (legacy), or Dispatched (allow re-dispatch edge case)
        if status not in ("Ready for Dispatch", "Completed", "Dispatched"):
            raise HTTPException(
                status_code=422,
                detail=f"Inbound must have canonical and be Ready for Dispatch or Completed (current: {status}). Generate canonical first.",
            )

        # Guardrail: no duplicate outbound
        existing = await db.documents.find_one({"parent_transaction_id": document_id})
        if existing:
            raise HTTPException(
                status_code=409,
                detail=f"Outbound already created (id: {existing.get('_id')})",
            )

        # Resolve partner
        pid = document.get("partner_id")
        partner = await db.trading_partners.find_one({"_id": ObjectId(pid)}) if pid and ObjectId.is_valid(pid) else None
        partner_code = partner.get("partner_code", "UNKNOWN") if partner else document.get("partner_code", "UNKNOWN")
        if not partner:
            partner = {
                "_id": pid,
                "partner_code": partner_code,
                "edi_config": {"standard": "X12", "version": "5010"},
                "erp_context": {},
            }

        now = datetime.utcnow()
        # Outbound: we are sender, partner is receiver — swap source/target from inbound
        inbound_source = document.get("source_system", "")
        inbound_target = document.get("target_system", "")
        outbound_doc = {
            "partner_id": str(pid),
            "partner_code": partner_code,
            "document_type": document.get("document_type", ""),
            "direction": "Outbound",
            "flow_type": "outbound",
            "source_system": inbound_target,
            "target_system": inbound_source,
            "status": "Created",
            "stage": "Created",
            "parent_transaction_id": document_id,
            "canonical_json": canonical,
            "ai_confidence_score": document.get("ai_confidence_score", 0.90),  # Inherit from inbound
            "raw_edi": "",  # Outbound created from canonical, no raw EDI
            "parsed_segments": [],
            "validation_results": [],
            "erp_posted": False,
            "erp_response": None,
            "acknowledgment_sent": False,
            "file_name": f"outbound_{document_id[:8]}_{now.strftime('%Y%m%d%H%M%S')}.json",
            "file_size": 0,
            "received_at": now,
            "processed_at": None,
            "created_at": now,
            "updated_at": now,
            "metadata": {
                "source": "create_outbound",
                "inbound_document_id": document_id,
            },
        }
        result = await db.documents.insert_one(outbound_doc)
        outbound_id = str(result.inserted_id)

        # Link outbound to inbound (status stays Ready for Dispatch until outbound completes)
        await db.documents.update_one(
            {"_id": ObjectId(document_id)},
            {"$set": {
                "metadata.outbound_transaction_id": outbound_id,
                "updated_at": now,
            }},
        )

        # Trigger outbound pipeline
        from app.workers.document_processor import processor
        async def _run_outbound():
            try:
                await processor.process_document(outbound_id)
            except Exception as e:
                import traceback
                logger.error(f"Outbound pipeline failed for {outbound_id}: {e}\n{traceback.format_exc()}")
                raise
        background_tasks.add_task(_run_outbound)

        await db.audit_logs.insert_one({
            "action_type": "Integration",
            "action": "Create Outbound",
            "entity_type": "Document",
            "entity_id": outbound_id,
            "description": f"Created outbound transmission from inbound {document_id}. Outbound pipeline started.",
            "created_at": now,
        })

        return {
            "success": True,
            "outbound_id": outbound_id,
            "inbound_id": document_id,
            "message": "Outbound transmission created. Redirect to outbound detail.",
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating outbound from {document_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{document_id}/generate-canonical")
async def generate_canonical(document_id: str, db=Depends(get_database)):
    """
    Build canonical JSON from parsed segments (rule-based + optional GPT-4o enhancement).
    Persists the result and boosts confidence to 1.0 (document is now reviewable/sendable).
    """
    try:
        if not ObjectId.is_valid(document_id):
            raise HTTPException(status_code=400, detail="Invalid document ID")

        document = await db.documents.find_one({"_id": ObjectId(document_id)})
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")

        parsed_segments = document.get("parsed_segments", [])
        doc_type = document.get("document_type", "")

        if not parsed_segments:
            raise HTTPException(status_code=422, detail="No parsed segments — re-run the pipeline first")

        canonical = rule_based_canonical(parsed_segments, doc_type)

        # ── Optionally enhance with GPT-4o ────────────────────────────────
        openai_key = os.getenv("OPENAI_API_KEY", "")
        if openai_key:
            try:
                from openai import AsyncOpenAI
                import json as _json
                client = AsyncOpenAI(api_key=openai_key)
                prompt = f"""You are an EDI-to-JSON transformation expert.
Convert these X12 {doc_type} parsed segments into a rich, named canonical business object JSON.
Use clear field names that make business sense (e.g. poNumber, buyerName, lineItems etc).
Segments data: {_json.dumps(parsed_segments[:30], default=str)[:3000]}
Return ONLY the JSON object, no markdown, no explanation."""
                resp = await client.chat.completions.create(
                    model="gpt-4o",
                    messages=[
                        {"role": "system", "content": "EDI transformation expert. Return only valid JSON."},
                        {"role": "user", "content": prompt},
                    ],
                    response_format={"type": "json_object"},
                    max_tokens=1200,
                    temperature=0.1,
                )
                gpt_canonical = _json.loads(resp.choices[0].message.content)
                # Merge: rule-based keys as fallback, GPT keys as primary
                canonical = {**canonical, **gpt_canonical}
            except Exception as e:
                logger.warning(f"GPT canonical enhancement failed: {e}")

        # Persist canonical JSON + mark confidence 1.0
        # Inbound: Ready for Dispatch (separate from outbound lifecycle)
        direction = document.get("direction", "Inbound")
        new_status = "Ready for Dispatch" if direction == "Inbound" else "Completed"
        await db.documents.update_one(
            {"_id": ObjectId(document_id)},
            {"$set": {
                "canonical_json": canonical,
                "ai_confidence_score": 1.0,
                "status": new_status,
                "updated_at": datetime.utcnow(),
            }}
        )

        await db.audit_logs.insert_one({
            "action_type": "Processing",
            "action": "Canonical Generated",
            "entity_type": "Document",
            "entity_id": document_id,
            "description": f"Canonical JSON generated from {len(parsed_segments)} segments for {doc_type}",
            "created_at": datetime.utcnow(),
        })

        return {"success": True, "canonical": canonical}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating canonical for {document_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
