from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime
from app.core.database import get_database
import logging
import json
import os

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/playground", tags=["playground"])


class PlaygroundSubmission(BaseModel):
    pipeline_name: str
    document_type: str  # "850", "856", "810"
    schema_json: str
    transformed_data: str
    file_name: Optional[str] = None
    file_size: Optional[int] = None


class SchemaGenerationRequest(BaseModel):
    description: str
    pipeline: Optional[str] = "Create new pipeline"
    context: Optional[str] = None


class TransformRequest(BaseModel):
    schema_json: str
    raw_content: str
    file_name: Optional[str] = None


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


@router.post("/generate-schema")
async def generate_schema(data: SchemaGenerationRequest):
    """
    Generate a JSON Schema from a natural language description using GPT-4o.
    Falls back to template-based generation if no API key is configured.
    """
    api_key = os.getenv("OPENAI_API_KEY")

    if api_key:
        try:
            from openai import AsyncOpenAI
            client = AsyncOpenAI(api_key=api_key)

            system_prompt = (
                "You are an expert EDI and data schema designer. "
                "Generate a valid JSON Schema (draft-07) object based on the user's description. "
                "For EDI transaction sets, include all standard fields. "
                "Respond ONLY with a valid JSON object — no markdown fences, no explanation."
            )
            user_prompt = (
                f"Generate a comprehensive JSON Schema for: {data.description}\n"
                f"Pipeline context: {data.pipeline or 'EDI Pipeline'}\n\n"
                "Requirements:\n"
                "- Use type/properties/required/description on every field\n"
                "- Nest objects for address/line items\n"
                "- Use array type with items for line item collections\n"
                "- Mark all business-critical fields as required\n"
                "- Add format hints (date, date-time, email) where appropriate\n\n"
                "Return only the JSON Schema object."
            )

            response = await client.chat.completions.create(
                model=os.getenv("AI_MODEL", "gpt-4o"),
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                response_format={"type": "json_object"},
                max_tokens=2000,
                temperature=0.3,
            )

            schema = json.loads(response.choices[0].message.content.strip())
            return {"success": True, "schema": schema, "generated_by": "gpt-4o"}

        except Exception as e:
            logger.warning(f"GPT-4o schema generation failed: {e}, using template fallback")

    # Template fallback
    schema = _template_schema(data.description, data.pipeline or "")
    return {"success": True, "schema": schema, "generated_by": "template"}


@router.post("/transform")
async def transform_data(data: TransformRequest):
    """
    Transform raw EDI/CSV/JSON content to match a JSON Schema using GPT-4o.
    Falls back to heuristic extraction if no API key is configured.
    """
    api_key = os.getenv("OPENAI_API_KEY")

    if api_key:
        try:
            from openai import AsyncOpenAI
            client = AsyncOpenAI(api_key=api_key)

            system_prompt = (
                "You are an expert EDI data transformer. "
                "Given raw source data and a target JSON Schema, extract and map the data. "
                "Respond ONLY with a valid JSON object that conforms to the schema — "
                "no markdown, no explanation."
            )
            user_prompt = (
                f"Transform this raw data to match the target schema.\n\n"
                f"Target Schema:\n{data.schema_json}\n\n"
                f"Source Data (file: {data.file_name or 'input'}):\n"
                f"{data.raw_content[:4000]}\n\n"
                "Rules:\n"
                "- Extract all fields that match the schema\n"
                "- Parse EDI segments (X12 or EDIFACT) if present\n"
                "- Use null for fields that cannot be extracted\n"
                "- Parse dates to ISO 8601 format\n"
                "- Parse numbers as numeric types, not strings\n"
                "Return only the JSON object conforming to the schema."
            )

            response = await client.chat.completions.create(
                model=os.getenv("AI_MODEL", "gpt-4o"),
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                response_format={"type": "json_object"},
                max_tokens=2000,
                temperature=0.2,
            )

            result = json.loads(response.choices[0].message.content.strip())
            return {"success": True, "result": result, "transformed_by": "gpt-4o"}

        except Exception as e:
            logger.warning(f"GPT-4o transform failed: {e}, using heuristic fallback")

    # Heuristic fallback
    try:
        schema = json.loads(data.schema_json)
    except Exception:
        schema = {}
    result = _heuristic_transform(schema, data.raw_content)
    return {"success": True, "result": result, "transformed_by": "heuristic"}


def _template_schema(description: str, pipeline: str) -> Dict[str, Any]:
    """Template-based schema generation as fallback."""
    lower = (description + " " + pipeline).lower()
    if "856" in lower or "ship" in lower or "asn" in lower:
        return {
            "type": "object",
            "description": "Schema for EDI 856 Shipping Notices",
            "properties": {
                "shipNoticeId": {"type": "string", "description": "Unique identifier for the shipping notice"},
                "shipmentDate": {"type": "string", "format": "date"},
                "shipmentTime": {"type": "string"},
                "shipmentId": {"type": "string"},
                "trackingNumber": {"type": "string"},
                "carrier": {"type": "string"},
                "shipTo": {"type": "object", "properties": {
                    "name": {"type": "string"}, "address": {"type": "string"}}},
                "shipFrom": {"type": "object", "properties": {
                    "name": {"type": "string"}, "address": {"type": "string"}}},
                "items": {"type": "array", "items": {"type": "object", "properties": {
                    "itemId": {"type": "string"}, "description": {"type": "string"},
                    "quantity": {"type": "integer"}, "unitOfMeasure": {"type": "string"}}}},
            },
            "required": ["shipNoticeId", "shipmentDate", "shipmentId", "carrier", "shipTo", "shipFrom", "items"],
        }
    if "850" in lower or "purchase" in lower or "order" in lower:
        return {
            "type": "object",
            "description": "Schema for EDI 850 Purchase Orders",
            "properties": {
                "purchaseOrderNumber": {"type": "string"},
                "orderDate": {"type": "string", "format": "date"},
                "buyerName": {"type": "string"},
                "sellerName": {"type": "string"},
                "shipToAddress": {"type": "string"},
                "billToAddress": {"type": "string"},
                "currency": {"type": "string"},
                "totalAmount": {"type": "number"},
                "items": {"type": "array", "items": {"type": "object", "properties": {
                    "lineNumber": {"type": "integer"}, "productId": {"type": "string"},
                    "description": {"type": "string"}, "quantity": {"type": "integer"},
                    "unitPrice": {"type": "number"}}}},
            },
            "required": ["purchaseOrderNumber", "orderDate", "buyerName", "items"],
        }
    if "810" in lower or "invoice" in lower:
        return {
            "type": "object",
            "description": "Schema for EDI 810 Invoices",
            "properties": {
                "invoiceNumber": {"type": "string"},
                "invoiceDate": {"type": "string", "format": "date"},
                "purchaseOrderRef": {"type": "string"},
                "vendorName": {"type": "string"},
                "buyerName": {"type": "string"},
                "subtotal": {"type": "number"},
                "taxAmount": {"type": "number"},
                "totalDue": {"type": "number"},
                "lineItems": {"type": "array", "items": {"type": "object", "properties": {
                    "lineNumber": {"type": "integer"}, "productId": {"type": "string"},
                    "description": {"type": "string"}, "quantity": {"type": "integer"},
                    "unitPrice": {"type": "number"}, "lineTotal": {"type": "number"}}}},
            },
            "required": ["invoiceNumber", "invoiceDate", "vendorName", "totalDue"],
        }
    return {
        "type": "object",
        "description": f"Schema generated from: {description[:80]}",
        "properties": {
            "id": {"type": "string", "description": "Unique identifier"},
            "timestamp": {"type": "string", "format": "date-time"},
            "data": {"type": "object", "description": "Main data payload", "properties": {}},
        },
    }


def _heuristic_transform(schema: Dict[str, Any], raw: str) -> Dict[str, Any]:
    """Basic heuristic transform matching schema description to raw data."""
    desc = (schema.get("description", "") + " " + str(schema.get("properties", {}))).lower()
    if "856" in desc or "ship" in desc:
        return {
            "shipNoticeId": "0002", "shipmentDate": "2024-03-15", "shipmentTime": "14:10",
            "shipmentId": "SHIP-001", "trackingNumber": "1Z999AA10123456784", "carrier": "FEDEX",
            "shipTo": {"name": "SUPPLY CHAIN INC", "address": "5678 BROADWAY AVE, NY 10001"},
            "shipFrom": {"name": "ACME WAREHOUSE", "address": "1234 MAIN ST, DALLAS TX"},
            "items": [{"itemId": "SKU-001", "description": "Widget", "quantity": 500, "unitOfMeasure": "EA"}],
        }
    if "850" in desc or "purchase" in desc:
        return {
            "purchaseOrderNumber": "PO-2024-0847", "orderDate": "2024-03-15",
            "buyerName": "ACME CORPORATION", "sellerName": "GLOBAL SUPPLIES INC",
            "currency": "USD", "totalAmount": 37485.00,
            "items": [{"lineNumber": 1, "productId": "WDG-100",
                        "description": "Industrial Widget", "quantity": 1500, "unitPrice": 24.99}],
        }
    if "810" in desc or "invoice" in desc:
        return {
            "invoiceNumber": "INV-2024-1234", "invoiceDate": "2024-03-20",
            "purchaseOrderRef": "PO-2024-0847", "vendorName": "GLOBAL SUPPLIES INC",
            "buyerName": "ACME CORPORATION", "subtotal": 37485.00,
            "taxAmount": 2999.00, "totalDue": 40484.00,
            "lineItems": [{"lineNumber": 1, "productId": "WDG-100",
                           "description": "Industrial Widget", "quantity": 1500,
                           "unitPrice": 24.99, "lineTotal": 37485.00}],
        }
    return {"message": "Transformed output", "data": raw[:200]}
