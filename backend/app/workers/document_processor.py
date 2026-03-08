"""
Document Processing Worker
Processes EDI documents through the 10-step pipeline per architecture diagram:
1. Receive (AS2/SFTP/REST)
2. Detect Standard (X12/EDIFACT/JSON/XML)
3. Parse & Validate
4. Send ACK (997/CONTRL)
5. Transform
6. Route
7. Post to ERP
8. Generate Reply
9. Deliver
10. Log & Monitor
"""
from datetime import datetime
from typing import Dict, Any, Optional
import logging
import traceback
from bson import ObjectId

from app.core.database import get_database
from app.services.edi_parser import parse_edi
from app.services.direction_resolver import resolve_direction
from app.services.ai_service import ai_service
from app.services.erp_service import erp_service
from app.services.exception_engine import exception_engine
from app.services.standard_detector import detect_standard
from app.services.ack_generator import generate_ack
from app.services.deduplication import is_duplicate, compute_document_hash
from app.services.canonical_builder import rule_based_canonical
from app.services.edi_generator import edi_generator
from app.services.transport_service import transport_service
from app.services.anomaly_service import anomaly_service
from app.services.ai_intelligence_service import ai_intelligence_service
from app.api.v1.websocket import broadcast_document_update, broadcast_exception
from app.models.exception import ExceptionCreate

logger = logging.getLogger(__name__)

# Step names per architecture
STEP_NAMES = {
    1: "Receive",
    2: "Detect Standard",
    3: "Parse & Validate",
    4: "Send ACK",
    5: "Transform",
    6: "Route",
    7: "Post to ERP",
    8: "Generate Reply",
    9: "Deliver",
    10: "Log & Monitor",
}


class DocumentProcessor:
    """Processes EDI documents through the 10-step pipeline"""

    def __init__(self):
        self.db = None

    async def process_document(self, document_id: str) -> Dict[str, Any]:
        """Process a document through the 10-step pipeline"""
        db = get_database()

        try:
            document = await db.documents.find_one({"_id": ObjectId(document_id)})
            if not document:
                raise ValueError(f"Document {document_id} not found")

            partner = None
            pid = document.get("partner_id")
            if pid:
                try:
                    partner = await db.trading_partners.find_one(
                        {"_id": ObjectId(pid) if isinstance(pid, str) else pid}
                    )
                except Exception:
                    pass
            # Fallback when no partners exist (e.g. after clear_demo_data)
            if not partner:
                partner = {
                    "_id": pid or "000000000000000000000000",
                    "partner_code": document.get("partner_code", "UNKNOWN"),
                    "edi_config": {"standard": "X12", "version": "5010"},
                    "erp_context": {},
                }

            partner_id_str = str(document["partner_id"])
            flow_type = document.get("flow_type") or ("inbound" if document.get("direction") == "Inbound" else "outbound")

            # --- Outbound created from inbound: run outbound-only pipeline ---
            if document.get("parent_transaction_id") and flow_type == "outbound":
                return await self._process_outbound_transmission(db, document_id, document, partner, partner_id_str)

            # --- Step 1: Receive (already received; document exists) ---
            await self._update_step(db, document_id, 1, "Received")
            await broadcast_document_update(document_id, "Received")

            # De-duplication check (exclude self for re-processing).
            # Skip entirely for documents manually uploaded via the dashboard —
            # those already receive a timestamp-salted unique hash at upload time
            # so the user can re-submit the same file for testing without being
            # blocked by the 24-hour dedup window.
            skip_dedup = document.get("metadata", {}).get("upload_source") == "dashboard"
            dup = None if skip_dedup else await is_duplicate(
                db,
                document["raw_edi"],
                partner_id_str,
                document["document_type"],
                document["direction"],
                exclude_document_id=document_id,
            )
            if dup:
                await self._create_exception(
                    db, document_id, partner_id_str,
                    "Duplicate Document", "Medium",
                    f"Duplicate of document received earlier (id: {dup.get('_id')})",
                )
                await self._update_status(db, document_id, "Duplicate")
                return {"success": False, "error": "Duplicate document"}

            # --- Step 2: Detect Standard ---
            await self._update_step(db, document_id, 2, "Detect Standard")
            detection = detect_standard(document["raw_edi"])
            standard = detection.get("standard", "X12")
            if standard not in ("X12", "EDIFACT", "SAP_IDOC"):
                standard = partner.get("edi_config", {}).get("standard", "X12")
            metadata_update = {
                "metadata.detected_standard": standard,
                "metadata.detection_confidence": detection.get("confidence"),
                "updated_at": datetime.utcnow(),
            }
            if detection.get("idoc_type"):
                metadata_update["metadata.idoc_type"] = detection["idoc_type"]
            await db.documents.update_one(
                {"_id": ObjectId(document_id)},
                {"$set": metadata_update}
            )

            # --- Step 3: Parse & Validate ---
            await self._update_step(db, document_id, 3, "Parsing")
            await broadcast_document_update(document_id, "Parsing")

            try:
                if standard in ("X12", "EDIFACT"):
                    parsed_data = parse_edi(document["raw_edi"], standard)
                elif standard == "SAP_IDOC":
                    # SAP IDoc detected: parsing not yet implemented (per EDI gateway doc)
                    parsed_data = {
                        "standard": standard,
                        "segments": [],
                        "errors": [{"type": "info", "message": "SAP IDoc format detected; full parsing is a future enhancement.", "severity": "Medium"}],
                    }
                else:
                    parsed_data = {"standard": standard, "segments": [], "errors": []}
                parsed_segments = parsed_data.get("segments", [])
            except Exception as e:
                logger.error(f"Error parsing document {document_id}: {e}")
                await self._create_exception(
                    db, document_id, partner_id_str,
                    "Parsing Error", "Critical", str(e),
                )
                await self._update_status(db, document_id, "Failed")
                await self._notify_slack(document_id, "Failed", partner, document)
                return {"success": False, "error": str(e)}

            await self._update_step(db, document_id, 3, "Validating")
            validation_results = parsed_data.get("errors", [])
            if standard == "X12":
                segment_ids = [s.get("segment_id") for s in parsed_segments]
                for req in ["ISA", "GS", "ST", "SE", "GE", "IEA"]:
                    if req not in segment_ids:
                        validation_results.append({
                            "type": "error",
                            "message": f"Missing required segment: {req}",
                            "severity": "High",
                        })
            validation_ok = len([v for v in validation_results if v.get("severity") == "High"]) == 0

            # Populate source_system, target_system from parsed if missing (e.g. legacy docs)
            source_system = document.get("source_system") or ""
            target_system = document.get("target_system") or ""
            if (not source_system or not target_system) and standard in ("X12", "EDIFACT") and parsed_segments:
                _, src, tgt = resolve_direction(parsed_data, None, fallback=document.get("direction", "Inbound"))
                if not source_system:
                    source_system = src
                if not target_system:
                    target_system = tgt

            # AI Assist: when validation fails, get error diagnosis (human approval required)
            if not validation_ok and validation_results:
                try:
                    err_msgs = [v.get("message", "") for v in validation_results if v.get("type") == "error"]
                    diagnosis = await ai_intelligence_service.explain_error(
                        error_message="; ".join(err_msgs[:3]),
                        document_context={"document_type": document.get("document_type"), "standard": standard},
                        validation_results=validation_results,
                    )
                    await db.documents.update_one(
                        {"_id": ObjectId(document_id)},
                        {"$set": {"metadata.ai_error_diagnosis": diagnosis, "updated_at": datetime.utcnow()}},
                    )
                except Exception as e:
                    logger.debug(f"AI explain-error assist failed: {e}")

            step3_update = {
                "parsed_segments": parsed_segments,
                "validation_results": validation_results,
                "updated_at": datetime.utcnow(),
            }
            if source_system or target_system:
                step3_update["source_system"] = source_system
                step3_update["target_system"] = target_system
            await db.documents.update_one(
                {"_id": ObjectId(document_id)},
                {"$set": step3_update}
            )

            # --- Step 4: Send ACK (Inbound only: 997 after Validate, before Transform) ---
            ack_sent = False
            if flow_type == "inbound":
                await self._update_step(db, document_id, 4, "Send ACK")
                if standard in ("X12", "EDIFACT") and parsed_segments:
                    try:
                        ack_content = generate_ack(parsed_data, standard, accepted=validation_ok)
                        if ack_content:
                            ack_sent = True
                            await db.documents.update_one(
                                {"_id": ObjectId(document_id)},
                                {"$set": {
                                    "acknowledgment_sent": True,
                                    "acknowledgment_type": "997" if standard == "X12" else "CONTRL",
                                    "metadata.ack_content": ack_content,
                                    "updated_at": datetime.utcnow(),
                                }}
                            )
                    except Exception as e:
                        logger.warning(f"ACK generation failed for {document_id}: {e}")

            # --- Step 5: Transform ---
            await self._update_step(db, document_id, 5, "Mapping")
            canonical_json = None
            mapping = await db.mappings.find_one({
                "partner_id": document["partner_id"],
                "document_type": document["document_type"],
                "direction": document["direction"],
                "is_active": True,
            })

            if mapping:
                canonical_json = await self._apply_mapping(parsed_segments, mapping)
                await db.documents.update_one(
                    {"_id": ObjectId(document_id)},
                    {"$set": {
                        "canonical_json": canonical_json,
                        "updated_at": datetime.utcnow(),
                    }}
                )
            else:
                # Fallback: rule-based canonical when no mapping (enables Ready for Dispatch)
                canonical_json = rule_based_canonical(parsed_segments, document.get("document_type", ""))
                await db.documents.update_one(
                    {"_id": ObjectId(document_id)},
                    {"$set": {
                        "canonical_json": canonical_json,
                        "metadata.ai_mapping_suggestion_available": True,
                        "metadata.parsed_segments_for_mapping": parsed_segments[:50],
                        "updated_at": datetime.utcnow(),
                    }},
                )

            # --- INBOUND: Stop at Ready for Dispatch (no ERP post, no reply, no deliver) ---
            if flow_type == "inbound":
                await self._update_step(db, document_id, 5, "Ready for Dispatch")
                await self._update_status(db, document_id, "Ready for Dispatch")
                await db.documents.update_one(
                    {"_id": ObjectId(document_id)},
                    {"$set": {
                        "ai_confidence_score": 0.90 if validation_ok else 0.75,
                        "processed_at": datetime.utcnow(),
                        "updated_at": datetime.utcnow(),
                    }}
                )
                await broadcast_document_update(document_id, "Ready for Dispatch")
                return {
                    "success": True,
                    "inbound_complete": True,
                    "status": "Ready for Dispatch",
                    "message": "Inbound processing complete. Create outbound transmission to dispatch.",
                }

            # --- Step 6: Route (business rules → target) — OUTBOUND only ---
            await self._update_step(db, document_id, 6, "Routing")
            target_erp = partner.get("erp_context", {}).get("type", "REST") if partner.get("erp_context") else None

            # --- Step 4 (Outbound): Send 997 after Transform/Route, before Deliver ---
            if flow_type == "outbound" and standard in ("X12", "EDIFACT") and parsed_segments:
                await self._update_step(db, document_id, 4, "Send ACK")
                try:
                    ack_content = generate_ack(parsed_data, standard, accepted=validation_ok)
                    if ack_content:
                        ack_sent = True
                        await db.documents.update_one(
                            {"_id": ObjectId(document_id)},
                            {"$set": {
                                "acknowledgment_sent": True,
                                "acknowledgment_type": "997" if standard == "X12" else "CONTRL",
                                "metadata.ack_content": ack_content,
                                "updated_at": datetime.utcnow(),
                            }}
                        )
                except Exception as e:
                    logger.warning(f"ACK generation failed for {document_id}: {e}")

            # --- Step 7: Post to ERP ---
            await self._update_step(db, document_id, 7, "Post to ERP")
            await self._update_status(db, document_id, "AI Processing")

            ai_confidence = await ai_service.calculate_confidence_score(
                parsed_segments, canonical_json, validation_results
            )
            detected_exceptions = await ai_service.detect_exceptions(
                parsed_segments, canonical_json, validation_results
            )
            for exc in detected_exceptions:
                await self._create_exception(
                    db, document_id, partner_id_str,
                    exc["type"], exc["severity"], exc["description"],
                )
                await broadcast_exception(str(exc.get("_id", "")), exc)

            rule_based = await exception_engine.evaluate_rules(
                document_id, partner_id_str,
                parsed_segments, canonical_json, validation_results,
            )
            for exc in rule_based:
                await broadcast_exception(exc.get("_id"), exc)

            # Anomaly detection (runs alongside ERP/AI processing)
            try:
                recent_docs_cursor = db.documents.find(
                    {"partner_id": document["partner_id"], "status": {"$in": ["Completed", "Needs Review"]}},
                    {"_id": 1, "received_at": 1, "canonical_json": 1, "parsed_segments": 1,
                     "validation_results": 1, "ai_confidence_score": 1}
                ).sort("received_at", -1).limit(200)
                recent_docs = await recent_docs_cursor.to_list(length=200)
                partner_history = {"total_documents": len(recent_docs)}
                anomaly_result = await anomaly_service.score_document(
                    document, recent_docs, partner_history
                )
                if anomaly_result.get("is_anomaly") and anomaly_result.get("anomaly_score", 0) > 0.6:
                    anomaly_types = ", ".join(anomaly_result.get("anomaly_types", ["unknown"]))
                    await self._create_exception(
                        db, document_id, partner_id_str,
                        "Anomaly Detected",
                        anomaly_result.get("severity", "Medium"),
                        f"Anomaly score: {anomaly_result['anomaly_score']:.2%}. "
                        f"Types: {anomaly_types}. Method: {anomaly_result.get('method')}",
                    )
                await db.documents.update_one(
                    {"_id": ObjectId(document_id)},
                    {"$set": {
                        "metadata.anomaly_score": anomaly_result.get("anomaly_score"),
                        "metadata.is_anomaly": anomaly_result.get("is_anomaly"),
                        "metadata.anomaly_types": anomaly_result.get("anomaly_types"),
                        "updated_at": datetime.utcnow(),
                    }}
                )
            except Exception as e:
                logger.warning(f"Anomaly detection failed for {document_id}: {e}")

            erp_posted = False
            erp_ctx = partner.get("erp_context") or {}
            if ai_confidence >= 0.90 and canonical_json and (erp_ctx.get("endpoint") or erp_ctx.get("type") or erp_ctx.get("backend_system")):
                # Build erp_config from partner erp_context (type, endpoint, api_key)
                erp_config = {
                    "type": erp_ctx.get("type") or erp_ctx.get("backend_system") or (erp_ctx.get("targetSystem") or {}).get("system") or "REST",
                    "endpoint": erp_ctx.get("endpoint"),
                    "api_key": erp_ctx.get("api_key"),
                    "base_url": erp_ctx.get("endpoint"),
                    **(erp_ctx.get("credentials") or {}),
                }
                erp_result = await erp_service.post_to_erp(
                    canonical_json,
                    erp_config,
                    document["document_type"],
                )
                if erp_result.get("success"):
                    erp_posted = True
                    await db.documents.update_one(
                        {"_id": ObjectId(document_id)},
                        {"$set": {
                            "erp_posted": True,
                            "erp_response": erp_result,
                            "updated_at": datetime.utcnow(),
                        }}
                    )

            # --- Step 8: Generate Reply ---
            await self._update_step(db, document_id, 8, "Generate Reply")
            reply_doc_id = None
            if canonical_json and document.get("direction", "Inbound") == "Inbound":
                try:
                    reply = await edi_generator.generate_reply(
                        canonical_json=canonical_json,
                        document_type=document["document_type"],
                        partner=partner,
                        standard=standard,
                    )
                    if reply and reply.get("edi_content"):
                        outbound_doc = {
                            "partner_id": document["partner_id"],
                            "partner_code": partner.get("partner_code", "UNKNOWN"),
                            "document_type": f"X12 {reply['reply_type']}",
                            "direction": "Outbound",
                            "flow_type": "outbound",
                            "status": "Generated",
                            "raw_edi": reply["edi_content"],
                            "canonical_json": reply.get("canonical_reply", {}),
                            "ai_confidence_score": 0.95,
                            "ai_explanation": (
                                f"Auto-generated {reply['reply_name']} in response to inbound "
                                f"{document['document_type']} (doc {document_id}) via {reply.get('generated_by','template')}"
                            ),
                            "validation_results": [],
                            "acknowledgment_sent": False,
                            "erp_posted": False,
                            "file_name": f"reply_{reply['reply_type']}_{document_id[:8]}.edi",
                            "file_size": len(reply["edi_content"]),
                            "received_at": datetime.utcnow(),
                            "processed_at": datetime.utcnow(),
                            "created_at": datetime.utcnow(),
                            "updated_at": datetime.utcnow(),
                            "metadata": {
                                "source": "auto_reply",
                                "inbound_document_id": document_id,
                                "reply_type": reply["reply_type"],
                                "generated_by": reply.get("generated_by", "template"),
                                "generation_notes": reply.get("generation_notes", ""),
                            },
                        }
                        result = await db.documents.insert_one(outbound_doc)
                        reply_doc_id = str(result.inserted_id)
                        await db.documents.update_one(
                            {"_id": ObjectId(document_id)},
                            {"$set": {
                                "metadata.reply_document_id": reply_doc_id,
                                "updated_at": datetime.utcnow(),
                            }}
                        )
                        logger.info(
                            f"Generated outbound {reply['reply_type']} reply "
                            f"(id={reply_doc_id}) for inbound {document_id}"
                        )
                        # Deliver reply via partner transport when configured
                        await self._deliver_outbound(
                            db, reply_doc_id, reply["edi_content"], partner,
                            {"file_name": outbound_doc.get("file_name"), "document_type": outbound_doc.get("document_type")},
                        )
                except Exception as e:
                    logger.warning(f"Reply generation failed for {document_id}: {e}")

            # --- Step 9: Deliver ---
            await self._update_step(db, document_id, 9, "Deliver")
            # AI Assist: anomaly check before deliver (Assist Mode - does not block)
            if canonical_json:
                try:
                    recent_for_anomaly = await db.documents.find(
                        {"partner_id": document["partner_id"], "status": {"$in": ["Completed", "Needs Review"]}},
                        {"canonical_json": 1},
                    ).sort("received_at", -1).limit(20).to_list(length=20)
                    anomaly_ai = await ai_intelligence_service.detect_anomaly(
                        document={"canonical_json": canonical_json, "document_type": document.get("document_type")},
                        partner_history={"total_documents": len(recent_for_anomaly)},
                        recent_documents=recent_for_anomaly,
                    )
                    if anomaly_ai.get("risk_score", 0) > 0.7:
                        await db.documents.update_one(
                            {"_id": ObjectId(document_id)},
                            {"$set": {"metadata.ai_anomaly_pre_deliver": anomaly_ai, "updated_at": datetime.utcnow()}},
                        )
                except Exception as e:
                    logger.debug(f"AI detect-anomaly assist failed: {e}")
            # Deliver: for outbound docs, send via partner transport; for inbound, reply was delivered in step 8
            if flow_type == "outbound" and document.get("raw_edi"):
                await self._deliver_outbound(db, document_id, document["raw_edi"], partner, document)

            # --- Step 10: Log & Monitor ---
            await self._update_step(db, document_id, 10, "Log & Monitor")

            # Auto-fix: apply AI suggestions for validation errors, then always complete
            ai_fixed_errors = []
            val_results = list(validation_results or [])
            if val_results and parsed_segments:
                try:
                    fixes = await ai_intelligence_service.get_auto_fix_suggestions(
                        parsed_segments, val_results, document.get("raw_edi", "")
                    )
                    for f in fixes:
                        conf = f.get("confidence", 0)
                        if conf < 0.75:
                            continue
                        seg_id = f.get("segment_id", "")
                        old_val = f.get("old_value", "")
                        new_val = f.get("suggested_value", "")
                        if not seg_id or not new_val:
                            continue
                        for seg in parsed_segments:
                            if seg.get("segment_id") != seg_id:
                                continue
                            seg_data = dict(seg.get("data", {}))
                            applied = False
                            for k, v in seg_data.items():
                                if str(v) == str(old_val):
                                    seg_data[k] = new_val
                                    applied = True
                                    break
                            if not applied and seg.get("elements"):
                                for i, el in enumerate(seg["elements"]):
                                    if str(el) == str(old_val):
                                        seg["elements"] = seg["elements"][:i] + [new_val] + seg["elements"][i + 1:]
                                        applied = True
                                        break
                            if applied:
                                seg["data"] = seg_data
                                ai_fixed_errors.append({
                                    "segment_id": seg_id,
                                    "field_name": f.get("field_name", ""),
                                    "old_value": old_val,
                                    "new_value": new_val,
                                    "reason": f.get("reason", "AI auto-correction"),
                                })
                            break
                except Exception as e:
                    logger.warning(f"Auto-fix failed for {document_id}: {e}")

            final_confidence = ai_confidence
            if ai_fixed_errors:
                final_confidence = max(ai_confidence, 0.95)
                await db.documents.update_one(
                    {"_id": ObjectId(document_id)},
                    {"$set": {
                        "parsed_segments": parsed_segments,
                        "validation_results": [],
                        "metadata.ai_fixed_errors": ai_fixed_errors,
                        "updated_at": datetime.utcnow(),
                    }}
                )

            # Always complete — no manual review; show AI fixes in document detail
            await self._update_status(db, document_id, "Completed")
            await self._notify_slack(document_id, "Completed", partner, document)

            await db.documents.update_one(
                {"_id": ObjectId(document_id)},
                {"$set": {
                    "ai_confidence_score": final_confidence,
                    "processed_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow(),
                    "metadata.dedup_hash": compute_document_hash(
                        document["raw_edi"], partner_id_str, document["document_type"]
                    ),
                    "metadata.is_anomaly": False,
                }}
            )

            return {
                "success": True,
                "confidence": ai_confidence,
                "erp_posted": erp_posted,
                "reply_document_id": reply_doc_id,
            }

        except Exception as e:
            tb = traceback.format_exc()
            logger.error(f"Error processing document {document_id}: {e}\n{tb}")
            try:
                await db.documents.update_one(
                    {"_id": ObjectId(document_id)},
                    {"$set": {
                        "status": "Failed",
                        "metadata.pipeline_error": str(e),
                        "metadata.pipeline_error_traceback": tb[:2000],
                        "updated_at": datetime.utcnow(),
                    }}
                )
            except Exception:
                await self._update_status(db, document_id, "Failed")
            document = await db.documents.find_one({"_id": ObjectId(document_id)})
            partner = None
            if document:
                try:
                    partner = await db.trading_partners.find_one(
                        {"_id": ObjectId(document["partner_id"])}
                    ) or await db.trading_partners.find_one(
                        {"_id": document["partner_id"]}
                    )
                except Exception:
                    pass
            await self._notify_slack(
                document_id, "Failed",
                partner or {},
                document or {},
            )
            return {"success": False, "error": str(e)}

    async def _process_outbound_transmission(
        self, db, document_id: str, document: dict, partner: dict, partner_id_str: str
    ) -> Dict[str, Any]:
        """
        Outbound pipeline: Created → Routing → Delivering → Delivered.
        Posts canonical to ERP, then marks parent inbound as Dispatched.
        """
        canonical = document.get("canonical_json")
        if not canonical:
            await self._update_status(db, document_id, "Failed")
            return {"success": False, "error": "No canonical payload for outbound transmission"}

        parent_id = document.get("parent_transaction_id")
        try:
            # Stage: Routing
            await db.documents.update_one(
                {"_id": ObjectId(document_id)},
                {"$set": {"stage": "Routing", "status": "Routing", "updated_at": datetime.utcnow()}},
            )
            await broadcast_document_update(document_id, "Routing")

            # Stage: Delivering (post to ERP)
            await db.documents.update_one(
                {"_id": ObjectId(document_id)},
                {"$set": {"stage": "Delivering", "status": "Delivering", "updated_at": datetime.utcnow()}},
            )
            erp_posted = False
            erp_ctx = partner.get("erp_context") or {}
            if erp_ctx.get("endpoint") or erp_ctx.get("type") or erp_ctx.get("backend_system"):
                erp_config = {
                    "type": erp_ctx.get("type") or erp_ctx.get("backend_system") or "REST",
                    "endpoint": erp_ctx.get("endpoint"),
                    "api_key": erp_ctx.get("api_key"),
                    "base_url": erp_ctx.get("endpoint"),
                    **(erp_ctx.get("credentials") or {}),
                }
                erp_result = await erp_service.post_to_erp(
                    canonical, erp_config, document.get("document_type", ""),
                )
                if erp_result.get("success"):
                    erp_posted = True
                    await db.documents.update_one(
                        {"_id": ObjectId(document_id)},
                        {"$set": {
                            "erp_posted": True,
                            "erp_response": erp_result,
                            "updated_at": datetime.utcnow(),
                        }},
                    )

            # Stage: Delivered
            await db.documents.update_one(
                {"_id": ObjectId(document_id)},
                {"$set": {
                    "stage": "Delivered",
                    "status": "Delivered",
                    "processed_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow(),
                }},
            )
            await broadcast_document_update(document_id, "Delivered")

            # Mark parent inbound as Dispatched
            if parent_id and ObjectId.is_valid(parent_id):
                await db.documents.update_one(
                    {"_id": ObjectId(parent_id)},
                    {"$set": {"status": "Dispatched", "updated_at": datetime.utcnow()}},
                )
                await db.documents.update_one(
                    {"_id": ObjectId(parent_id)},
                    {"$set": {"metadata.outbound_transaction_id": document_id, "updated_at": datetime.utcnow()}},
                )

            await db.audit_logs.insert_one({
                "action_type": "Integration",
                "action": "Outbound Delivered",
                "entity_type": "Document",
                "entity_id": document_id,
                "description": f"Outbound transmission delivered (ERP posted: {erp_posted}). Parent: {parent_id}",
                "created_at": datetime.utcnow(),
            })
            return {"success": True, "erp_posted": erp_posted}
        except Exception as e:
            logger.error(f"Outbound transmission failed {document_id}: {e}")
            await self._update_status(db, document_id, "Failed")
            raise

    async def _update_step(self, db, document_id: str, step: int, status: str):
        """Update document with processing step and status"""
        await db.documents.update_one(
            {"_id": ObjectId(document_id)},
            {"$set": {
                "processing_step": step,
                "status": status,
                "updated_at": datetime.utcnow(),
            }}
        )

    async def _update_status(self, db, document_id: str, status: str):
        """Update document status"""
        await db.documents.update_one(
            {"_id": ObjectId(document_id)},
            {"$set": {"status": status, "updated_at": datetime.utcnow()}}
        )

    async def _notify_slack(self, document_id, status, partner, document):
        try:
            from app.services.slack_service import slack_service
            await slack_service.notify_document_status(
                document_id, status,
                partner.get("partner_code") if partner else None,
                document.get("document_type") if document else None,
            )
        except Exception as e:
            logger.debug(f"Slack notify failed: {e}")

    async def _create_exception(
        self, db, document_id: str, partner_id: str,
        exception_type: str, severity: str, description: str,
    ):
        """Create an exception"""
        exception_data = ExceptionCreate(
            document_id=document_id,
            partner_id=partner_id,
            exception_type=exception_type,
            severity=severity,
            description=description,
        )
        result = await db.exceptions.insert_one(exception_data.model_dump())
        try:
            from app.services.slack_service import slack_service
            await slack_service.notify_exception(
                exception_type=exception_type,
                severity=severity,
                description=description,
                document_id=document_id,
                partner_id=partner_id,
            )
        except Exception:
            pass
        return str(result.inserted_id)

    async def _apply_mapping(self, parsed_segments: list, mapping: dict) -> Dict[str, Any]:
        """Apply mapping transformation to canonical model"""
        canonical = {
            "document_type": mapping.get("document_type"),
            "fields": {},
        }
        for fm in mapping.get("field_mappings", []):
            value = self._extract_field_value(parsed_segments, fm.get("source_field"))
            if fm.get("transformation"):
                value = self._apply_transformation(
                    value, fm.get("transformation"),
                    fm.get("transformation_params", {}),
                )
            canonical["fields"][fm.get("target_field", "")] = value
        return canonical

    def _extract_field_value(self, parsed_segments: list, field_path: str) -> Optional[str]:
        parts = (field_path or "").split(".")
        if len(parts) >= 2:
            seg_id, idx = parts[0], parts[1]
            for s in parsed_segments:
                if s.get("segment_id") == seg_id:
                    els = s.get("elements", [])
                    i = int(idx) if idx.isdigit() else None
                    if i is not None and i < len(els):
                        return els[i]
        return None

    def _apply_transformation(self, value: str, transformation: str, params: dict) -> str:
        if transformation == "concat":
            return (value or "") + (params.get("separator", " ")).join(params.get("values", []))
        return value or ""

    async def _deliver_outbound(
        self, db, document_id: str, content: str, partner: dict, document: dict,
    ):
        """Deliver outbound EDI via partner transport (SFTP, S3, API) when configured."""
        tc = partner.get("transport_config") or {}
        transport_type = tc.get("type") or partner.get("transportType")
        if not transport_type or transport_type not in ("SFTP", "S3", "API"):
            return
        import tempfile
        import os
        file_name = document.get("file_name") or f"outbound_{document_id[:8]}.edi"
        try:
            with tempfile.NamedTemporaryFile(mode="w", suffix=".edi", delete=False) as tmp:
                tmp.write(content)
                tmp_path = tmp.name
            try:
                if transport_type == "SFTP":
                    host = tc.get("host") or (tc.get("endpoint") or {}).get("host") if isinstance(tc.get("endpoint"), dict) else None
                    port = int(tc.get("port") or (tc.get("endpoint") or {}).get("port") or 22) if isinstance(tc.get("endpoint"), dict) else int(tc.get("port") or 22)
                    username = tc.get("username") or (tc.get("credentials") or {}).get("username")
                    password = tc.get("password") or (tc.get("credentials") or {}).get("password")
                    remote_path = (tc.get("path") or tc.get("remote_path") or "/").rstrip("/") + "/" + file_name
                    if host and username:
                        result = await transport_service.send_file_sftp(
                            host=host, port=port, username=username, password=password,
                            local_path=tmp_path, remote_path=remote_path,
                        )
                        if result.get("success"):
                            logger.info(f"Delivered {document_id} to SFTP {remote_path}")
                elif transport_type == "S3":
                    bucket = tc.get("bucket")
                    prefix = (tc.get("prefix") or "").rstrip("/")
                    key = f"{prefix}/{file_name}" if prefix else file_name
                    if bucket:
                        result = await transport_service.send_file_s3(
                            local_path=tmp_path, bucket=bucket, key=key,
                        )
                        if result.get("success"):
                            logger.info(f"Delivered {document_id} to S3 {bucket}/{key}")
            finally:
                if os.path.exists(tmp_path):
                    os.unlink(tmp_path)
        except Exception as e:
            logger.warning(f"Delivery failed for {document_id}: {e}")


processor = DocumentProcessor()
