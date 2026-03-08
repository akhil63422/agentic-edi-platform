"""
AI Intelligence API
5 agents in Assist Mode: generate-mapping, analyze-schema, explain-error, summarize-logs, detect-anomaly.
All outputs require human approval before use.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, List, Optional

from app.api.v1.dependencies import require_auth_if_enabled
from app.services.ai_intelligence_service import ai_intelligence_service

router = APIRouter(prefix="/ai", tags=["ai-intelligence"], dependencies=[Depends(require_auth_if_enabled)])


class GenerateMappingRequest(BaseModel):
    source_schema: Dict[str, Any]
    x12_schema: Dict[str, Any]
    document_type: Optional[str] = "850"


class AnalyzeSchemaRequest(BaseModel):
    source_schema: Dict[str, Any]
    target_schema: Dict[str, Any]
    document_type: Optional[str] = None


class ExplainErrorRequest(BaseModel):
    error_message: str
    document_context: Optional[Dict[str, Any]] = None
    validation_results: Optional[List[Dict[str, Any]]] = None


class SummarizeLogsRequest(BaseModel):
    log_entries: List[Dict[str, Any]]
    time_range: Optional[str] = None


class DetectAnomalyRequest(BaseModel):
    document: Dict[str, Any]
    partner_history: Optional[Dict[str, Any]] = None
    recent_documents: Optional[List[Dict[str, Any]]] = None


@router.post("/generate-mapping")
async def generate_mapping(req: GenerateMappingRequest):
    """Mapping Intelligence Agent: Compare schemas, return structured mapping JSON. Engineer approves before storing."""
    result = await ai_intelligence_service.generate_mapping(
        source_schema=req.source_schema,
        x12_schema=req.x12_schema,
        document_type=req.document_type or "850",
    )
    return {"mapping": result, "assist_mode": True, "requires_approval": True}


@router.post("/analyze-schema")
async def analyze_schema(req: AnalyzeSchemaRequest):
    """Schema Understanding Agent: Schema comparison, canonical model suggestions."""
    result = await ai_intelligence_service.analyze_schema(
        source_schema=req.source_schema,
        target_schema=req.target_schema,
        document_type=req.document_type,
    )
    return {"analysis": result, "assist_mode": True}


@router.post("/explain-error")
async def explain_error(req: ExplainErrorRequest):
    """Error Diagnosis Agent: Root cause and suggested fix when validation fails."""
    result = await ai_intelligence_service.explain_error(
        error_message=req.error_message,
        document_context=req.document_context,
        validation_results=req.validation_results,
    )
    return {"diagnosis": result, "assist_mode": True}


@router.post("/summarize-logs")
async def summarize_logs(req: SummarizeLogsRequest):
    """Log Summarization Agent: Daily operational brief, root cause clusters."""
    result = await ai_intelligence_service.summarize_logs(
        log_entries=req.log_entries,
        time_range=req.time_range,
    )
    return {"summary": result, "assist_mode": True}


@router.post("/detect-anomaly")
async def detect_anomaly(req: DetectAnomalyRequest):
    """Anomaly Detection Agent: Pricing deviation, quantity spikes, risk score before send."""
    result = await ai_intelligence_service.detect_anomaly(
        document=req.document,
        partner_history=req.partner_history,
        recent_documents=req.recent_documents,
    )
    return {"anomaly_analysis": result, "assist_mode": True}
