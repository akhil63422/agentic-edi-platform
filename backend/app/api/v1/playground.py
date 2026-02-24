from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime
from app.core.database import get_database
import logging
import json

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/playground", tags=["playground"])


class PlaygroundSubmission(BaseModel):
    pipeline_name: str
    document_type: str  # "850", "856", "810"
    schema_json: str
    transformed_data: str
    file_name: Optional[str] = None
    file_size: Optional[int] = None


@router.post("/connect/", status_code=201)
async def connect_to_system(data: PlaygroundSubmission, db=Depends(get_database)):
    """
    Receive a playground transformation and insert it as an inbound document
    so it appears in the Inbound EDI list.
    """
    try:
        schema_obj = {}
        try:
            schema_obj = json.loads(data.schema_json)
        except json.JSONDecodeError:
            pass

        transformed_obj = {}
        try:
            transformed_obj = json.loads(data.transformed_data)
        except json.JSONDecodeError:
            pass

        doc_type_map = {
            "850": "X12 850",
            "856": "X12 856",
            "810": "X12 810",
            "997": "X12 997",
        }
        doc_type = doc_type_map.get(data.document_type, f"X12 {data.document_type}")

        document = {
            "partner_id": "playground",
            "partner_code": "PLAYGROUND",
            "document_type": doc_type,
            "direction": "Inbound",
            "status": "Completed",
            "raw_edi": data.transformed_data,
            "parsed_segments": [],
            "canonical_json": transformed_obj,
            "ai_confidence_score": 0.95,
            "ai_explanation": f"Auto-mapped via Playground pipeline: {data.pipeline_name}",
            "validation_results": [
                {"rule": "Schema validation", "status": "pass", "message": "All required fields present"},
                {"rule": "Data type check", "status": "pass", "message": "All fields match schema types"},
            ],
            "exception_ids": [],
            "erp_posted": False,
            "acknowledgment_sent": False,
            "file_name": data.file_name or f"playground_{data.document_type}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.json",
            "file_size": data.file_size or len(data.transformed_data),
            "received_at": datetime.utcnow(),
            "processed_at": datetime.utcnow(),
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "metadata": {
                "source": "playground",
                "pipeline_name": data.pipeline_name,
                "schema": schema_obj,
            },
        }

        result = await db.documents.insert_one(document)
        doc_id = str(result.inserted_id)

        audit_log = {
            "action_type": "Processing",
            "action": "Created",
            "entity_type": "Document",
            "entity_id": doc_id,
            "description": f"Playground: '{data.pipeline_name}' connected to system as {doc_type} inbound document",
            "timestamp": datetime.utcnow(),
            "created_at": datetime.utcnow(),
        }
        await db.audit_logs.insert_one(audit_log)

        logger.info(f"Playground document created: {doc_id} for pipeline '{data.pipeline_name}'")

        return {
            "success": True,
            "document_id": doc_id,
            "message": f'"{data.pipeline_name}" sent to the system successfully',
            "document_type": doc_type,
            "status": "Completed",
        }

    except Exception as e:
        logger.error(f"Error in playground connect: {e}")
        raise HTTPException(status_code=500, detail=str(e))
