"""
Semantic Search API
Provides natural language search over EDI documents, partners, and audit logs.
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from app.core.database import get_database
from app.services.search_service import search_service
from app.services.anomaly_service import anomaly_service
from app.api.v1.dependencies import require_auth_if_enabled
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/search", tags=["search"], dependencies=[Depends(require_auth_if_enabled)])


class SearchRequest(BaseModel):
    query: str
    collection: Optional[str] = "documents"
    limit: Optional[int] = 20
    filters: Optional[Dict[str, Any]] = None


class AnomalyBatchRequest(BaseModel):
    partner_id: Optional[str] = None
    limit: Optional[int] = 100


@router.post("/")
async def semantic_search(data: SearchRequest, db=Depends(get_database)):
    """
    Natural language search over EDI documents or trading partners.

    Examples:
      - "850 purchase orders from Acme Corp this month"
      - "failed invoices with high amounts"
      - "shipments missing tracking numbers"
      - "new suppliers added last week"
    """
    try:
        if not data.query or not data.query.strip():
            raise HTTPException(status_code=400, detail="Query cannot be empty")

        result = await search_service.search(
            query=data.query.strip(),
            collection=data.collection or "documents",
            limit=min(data.limit or 20, 100),
            filters=data.filters,
            db=db,
        )
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Search error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/")
async def search_get(
    q: str = Query(..., description="Natural language search query"),
    collection: str = Query("documents", description="documents or partners"),
    limit: int = Query(20, ge=1, le=100),
    direction: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    partner_code: Optional[str] = Query(None),
    db=Depends(get_database),
):
    """GET endpoint for search — useful for quick URL-based queries."""
    filters = {}
    if direction:
        filters["direction"] = direction
    if status:
        filters["status"] = status
    if partner_code:
        filters["partner_code"] = partner_code

    try:
        return await search_service.search(
            query=q.strip(),
            collection=collection,
            limit=limit,
            filters=filters or None,
            db=db,
        )
    except Exception as e:
        logger.error(f"Search error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/anomalies")
async def detect_anomalies(data: AnomalyBatchRequest, db=Depends(get_database)):
    """
    Run anomaly detection over recent documents.
    Returns documents ranked by anomaly score (highest first).
    """
    try:
        query = {"status": {"$in": ["Completed", "Needs Review", "Failed"]}}
        if data.partner_id:
            query["partner_id"] = data.partner_id

        docs = await db.documents.find(query).sort("received_at", -1).limit(data.limit or 100).to_list(length=data.limit or 100)

        if not docs:
            return {"anomalies": [], "total_scored": 0, "model_status": anomaly_service.get_model_status()}

        results = await anomaly_service.score_batch(docs)

        # Sort by anomaly score descending
        results.sort(key=lambda x: x.get("anomaly_score", 0), reverse=True)

        anomalies = [r for r in results if r.get("is_anomaly")]

        return {
            "anomalies": anomalies,
            "all_scores": results,
            "total_scored": len(results),
            "anomaly_count": len(anomalies),
            "model_status": anomaly_service.get_model_status(),
        }
    except Exception as e:
        logger.error(f"Anomaly detection error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/anomaly-status")
async def anomaly_model_status():
    """Return current state of the anomaly detection model."""
    return anomaly_service.get_model_status()


@router.post("/index-document/{document_id}")
async def index_document(document_id: str, db=Depends(get_database)):
    """Manually index a specific document into the vector store."""
    from bson import ObjectId
    try:
        if not ObjectId.is_valid(document_id):
            raise HTTPException(status_code=400, detail="Invalid document ID")
        doc = await db.documents.find_one({"_id": ObjectId(document_id)})
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")
        doc["_id"] = str(doc["_id"])
        indexed = await search_service.index_document(doc)
        return {"success": indexed, "document_id": document_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
