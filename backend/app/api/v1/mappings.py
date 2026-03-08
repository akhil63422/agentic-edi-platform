from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional, Dict, Any
from datetime import datetime
from bson import ObjectId
from app.core.database import get_database
from app.api.v1.dependencies import require_auth_if_enabled
from app.models.mapping import Mapping, MappingCreate, MappingUpdate
from app.models.audit import AuditLogCreate
from pydantic import BaseModel
import logging
import os
import json

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/mappings", tags=["mappings"], dependencies=[Depends(require_auth_if_enabled)])


class MappingSuggestRequest(BaseModel):
    source_fields: List[str]
    document_type: Optional[str] = "850"
    standard: Optional[str] = "X12"
    partner_id: Optional[str] = None


@router.get("/", response_model=List[Mapping])
async def get_mappings(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    partner_id: Optional[str] = None,
    document_type: Optional[str] = None,
    direction: Optional[str] = None,
    is_active: Optional[bool] = None,
    db=Depends(get_database)
):
    """Get all mappings"""
    try:
        query = {}
        if partner_id:
            if ObjectId.is_valid(partner_id):
                query["partner_id"] = partner_id
        if document_type:
            query["document_type"] = document_type
        if direction:
            query["direction"] = direction
        if is_active is not None:
            query["is_active"] = is_active
        
        cursor = db.mappings.find(query).sort("created_at", -1).skip(skip).limit(limit)
        mappings = await cursor.to_list(length=limit)
        
        # Convert ObjectId to string
        for mapping in mappings:
            mapping["_id"] = str(mapping["_id"])
        
        return mappings
    except Exception as e:
        logger.error(f"Error fetching mappings: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{mapping_id}", response_model=Mapping)
async def get_mapping(mapping_id: str, db=Depends(get_database)):
    """Get a specific mapping"""
    try:
        if not ObjectId.is_valid(mapping_id):
            raise HTTPException(status_code=400, detail="Invalid mapping ID")
        
        mapping = await db.mappings.find_one({"_id": ObjectId(mapping_id)})
        if not mapping:
            raise HTTPException(status_code=404, detail="Mapping not found")
        
        mapping["_id"] = str(mapping["_id"])
        return mapping
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching mapping {mapping_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/", response_model=Mapping, status_code=201)
async def create_mapping(mapping_data: MappingCreate, db=Depends(get_database)):
    """Create a new mapping"""
    try:
        # Verify partner exists
        if ObjectId.is_valid(mapping_data.partner_id):
            partner = await db.trading_partners.find_one({"_id": ObjectId(mapping_data.partner_id)})
            if not partner:
                raise HTTPException(status_code=404, detail="Partner not found")
        
        mapping_dict = mapping_data.model_dump()
        mapping_dict["created_at"] = datetime.utcnow()
        mapping_dict["updated_at"] = datetime.utcnow()
        
        result = await db.mappings.insert_one(mapping_dict)
        mapping = await db.mappings.find_one({"_id": result.inserted_id})
        mapping["_id"] = str(mapping["_id"])
        
        # Create audit log
        audit_log = AuditLogCreate(
            action_type="Configuration",
            action="Created",
            entity_type="Mapping",
            entity_id=str(result.inserted_id),
            description=f"Created mapping: {mapping_data.name} for {mapping_data.document_type}"
        )
        await db.audit_logs.insert_one(audit_log.model_dump())
        
        return mapping
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating mapping: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{mapping_id}", response_model=Mapping)
async def update_mapping(
    mapping_id: str,
    mapping_data: MappingUpdate,
    db=Depends(get_database)
):
    """Update a mapping"""
    try:
        if not ObjectId.is_valid(mapping_id):
            raise HTTPException(status_code=400, detail="Invalid mapping ID")
        
        mapping = await db.mappings.find_one({"_id": ObjectId(mapping_id)})
        if not mapping:
            raise HTTPException(status_code=404, detail="Mapping not found")
        
        update_data = mapping_data.model_dump(exclude_unset=True)
        update_data["updated_at"] = datetime.utcnow()
        
        await db.mappings.update_one(
            {"_id": ObjectId(mapping_id)},
            {"$set": update_data}
        )
        
        updated_mapping = await db.mappings.find_one({"_id": ObjectId(mapping_id)})
        updated_mapping["_id"] = str(updated_mapping["_id"])
        
        # Create audit log
        audit_log = AuditLogCreate(
            action_type="Configuration",
            action="Updated",
            entity_type="Mapping",
            entity_id=mapping_id,
            description=f"Updated mapping: {updated_mapping.get('name', 'Unknown')}"
        )
        await db.audit_logs.insert_one(audit_log.model_dump())
        
        return updated_mapping
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating mapping {mapping_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{mapping_id}", status_code=204)
async def delete_mapping(mapping_id: str, db=Depends(get_database)):
    """Delete a mapping"""
    try:
        if not ObjectId.is_valid(mapping_id):
            raise HTTPException(status_code=400, detail="Invalid mapping ID")
        
        mapping = await db.mappings.find_one({"_id": ObjectId(mapping_id)})
        if not mapping:
            raise HTTPException(status_code=404, detail="Mapping not found")
        
        await db.mappings.delete_one({"_id": ObjectId(mapping_id)})
        
        # Create audit log
        audit_log = AuditLogCreate(
            action_type="Configuration",
            action="Deleted",
            entity_type="Mapping",
            entity_id=mapping_id,
            description=f"Deleted mapping: {mapping.get('name', 'Unknown')}"
        )
        await db.audit_logs.insert_one(audit_log.model_dump())
        
        return None
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting mapping {mapping_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── Canonical target fields per transaction set ──────────────────────────────
_CANONICAL_FIELDS: Dict[str, List[str]] = {
    "850": [
        "purchase_order_number", "order_date", "buyer_name", "seller_name",
        "ship_to_address", "bill_to_address", "currency", "total_amount",
        "line_items.line_number", "line_items.product_id", "line_items.description",
        "line_items.quantity", "line_items.unit_price", "line_items.unit_of_measure",
        "ship_date", "delivery_date", "payment_terms",
    ],
    "856": [
        "ship_notice_id", "shipment_date", "shipment_time", "shipment_id",
        "tracking_number", "carrier", "ship_to.name", "ship_to.address",
        "ship_from.name", "ship_from.address", "items.item_id",
        "items.description", "items.quantity", "items.unit_of_measure",
        "pro_number", "seal_number", "packaging_type",
    ],
    "810": [
        "invoice_number", "invoice_date", "purchase_order_ref",
        "vendor_name", "buyer_name", "subtotal", "tax_amount", "total_due",
        "line_items.line_number", "line_items.product_id", "line_items.description",
        "line_items.quantity", "line_items.unit_price", "line_items.line_total",
        "payment_due_date", "remit_to_address", "discount_amount",
    ],
    "997": ["transaction_set_id", "functional_group_id", "acknowledgment_code", "error_code"],
    "855": [
        "purchase_order_number", "acknowledgment_type", "acknowledgment_date",
        "vendor_name", "buyer_name", "status",
        "line_items.line_number", "line_items.product_id", "line_items.quantity_acknowledged",
    ],
}


def _cosine_similarity(a: List[float], b: List[float]) -> float:
    """Compute cosine similarity between two embedding vectors."""
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = sum(x ** 2 for x in a) ** 0.5
    norm_b = sum(x ** 2 for x in b) ** 0.5
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


async def _embed_texts(texts: List[str], api_key: str) -> Optional[List[List[float]]]:
    """Embed a list of texts using OpenAI text-embedding-3-small."""
    try:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=api_key)
        response = await client.embeddings.create(
            model="text-embedding-3-small",
            input=texts,
        )
        return [item.embedding for item in response.data]
    except Exception as e:
        logger.warning(f"Embedding request failed: {e}")
        return None


@router.post("/suggest")
async def suggest_mappings(data: MappingSuggestRequest):
    """
    Suggest canonical target field mappings for a list of source EDI field names.

    Uses OpenAI text-embedding-3-small (cosine similarity) when OPENAI_API_KEY is set.
    Falls back to keyword heuristics otherwise.

    Returns a list of {source_field, suggested_target, confidence, reason}.
    """
    api_key = os.getenv("OPENAI_API_KEY")
    doc_type = (data.document_type or "850").replace("X12 ", "").replace("EDIFACT ", "").split()[0]
    target_fields = _CANONICAL_FIELDS.get(doc_type, _CANONICAL_FIELDS["850"])

    suggestions = []

    if api_key and data.source_fields:
        # Embed source fields + target fields together
        all_texts = data.source_fields + target_fields
        embeddings = await _embed_texts(all_texts, api_key)

        if embeddings:
            src_embeddings = embeddings[:len(data.source_fields)]
            tgt_embeddings = embeddings[len(data.source_fields):]

            for i, src_field in enumerate(data.source_fields):
                sims = [
                    (_cosine_similarity(src_embeddings[i], tgt_embeddings[j]), target_fields[j])
                    for j in range(len(target_fields))
                ]
                sims.sort(reverse=True)
                best_sim, best_target = sims[0]
                second_sim, second_target = sims[1] if len(sims) > 1 else (0, "")

                suggestions.append({
                    "source_field": src_field,
                    "suggested_target": best_target,
                    "confidence": round(best_sim, 4),
                    "alternatives": [
                        {"field": second_target, "confidence": round(second_sim, 4)},
                    ] if second_sim > 0.5 else [],
                    "reason": f"Embedding cosine similarity: {best_sim:.2%}",
                    "method": "embedding",
                })

            # For low-confidence suggestions, use GPT-4o to improve
            low_conf = [s for s in suggestions if s["confidence"] < 0.70]
            if low_conf:
                try:
                    from openai import AsyncOpenAI
                    client = AsyncOpenAI(api_key=api_key)
                    prompt = (
                        f"Map these EDI source fields to the closest canonical target field "
                        f"for an X12 {doc_type} transaction set.\n\n"
                        f"Source fields: {json.dumps([s['source_field'] for s in low_conf])}\n"
                        f"Available canonical fields: {json.dumps(target_fields)}\n\n"
                        "Respond with a JSON array: "
                        '[{"source_field": "...", "target_field": "...", "confidence": 0.0-1.0, "reason": "..."}]'
                    )
                    resp = await client.chat.completions.create(
                        model="gpt-4o-mini",
                        messages=[
                            {"role": "system", "content": "You are an EDI field mapping expert. Always respond with valid JSON only."},
                            {"role": "user", "content": prompt},
                        ],
                        response_format={"type": "json_object"},
                        max_tokens=600,
                        temperature=0.2,
                    )
                    content = json.loads(resp.choices[0].message.content.strip())
                    llm_suggestions = content if isinstance(content, list) else content.get("mappings", [])
                    llm_map = {s["source_field"]: s for s in llm_suggestions}
                    for s in suggestions:
                        if s["source_field"] in llm_map:
                            llm = llm_map[s["source_field"]]
                            if llm.get("confidence", 0) > s["confidence"]:
                                s["suggested_target"] = llm.get("target_field", s["suggested_target"])
                                s["confidence"] = llm.get("confidence", s["confidence"])
                                s["reason"] = llm.get("reason", s["reason"]) + " (LLM enhanced)"
                                s["method"] = "embedding+llm"
                except Exception as e:
                    logger.warning(f"LLM mapping enhancement failed: {e}")

            return {"suggestions": suggestions, "method": "embedding", "model": "text-embedding-3-small"}

    # ── Keyword heuristic fallback ──────────────────────────────────────────
    KEYWORD_MAP = {
        "po": "purchase_order_number", "ponumber": "purchase_order_number",
        "order": "purchase_order_number", "orderdate": "order_date",
        "buyer": "buyer_name", "customer": "buyer_name",
        "seller": "seller_name", "vendor": "vendor_name",
        "shipto": "ship_to.name", "shipfrom": "ship_from.name",
        "qty": "line_items.quantity", "quantity": "line_items.quantity",
        "price": "line_items.unit_price", "unitprice": "line_items.unit_price",
        "item": "line_items.product_id", "sku": "line_items.product_id",
        "total": "total_amount", "amount": "total_amount",
        "invoice": "invoice_number", "invoicedate": "invoice_date",
        "ship": "ship_notice_id", "track": "tracking_number",
        "carrier": "carrier",
    }
    for src in data.source_fields:
        key = src.lower().replace("_", "").replace(" ", "").replace("-", "")
        target = None
        for kw, tgt in KEYWORD_MAP.items():
            if kw in key or key in kw:
                target = tgt
                break
        if not target:
            target = target_fields[0] if target_fields else src
        suggestions.append({
            "source_field": src,
            "suggested_target": target,
            "confidence": 0.6,
            "alternatives": [],
            "reason": "Keyword heuristic match",
            "method": "heuristic",
        })

    return {"suggestions": suggestions, "method": "heuristic"}
