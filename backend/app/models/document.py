from datetime import datetime
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field
from bson import ObjectId
from app.models.partner import PyObjectId


class EDIDocument(BaseModel):
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    partner_id: str
    partner_code: Optional[str] = None
    document_type: str  # 850, 810, 856, etc.
    direction: str  # Inbound, Outbound
    flow_type: Optional[str] = None  # inbound, outbound (derived from direction if not set)
    status: str = "Received"  # Inbound: Received, Parsed, Validated, Canonical Generated, Ready for Dispatch, Dispatched, Failed. Outbound: Created, Routing, Delivering, Delivered, ACK Received, Failed
    processing_step: Optional[int] = None  # 1-10 per architecture flow
    stage: Optional[str] = None  # Outbound pipeline stage: Created, Routing, Transform, Delivering, Delivered, ACK Received
    parent_transaction_id: Optional[str] = None  # Links outbound to inbound (outbound.parent = inbound.id)
    source_system: Optional[str] = None
    target_system: Optional[str] = None
    raw_edi: str
    parsed_segments: Optional[List[Dict[str, Any]]] = None
    canonical_json: Optional[Dict[str, Any]] = None
    x12_output: Optional[str] = None
    ai_confidence_score: Optional[float] = None
    ai_explanation: Optional[str] = None
    validation_results: Optional[List[Dict[str, Any]]] = None
    exception_ids: List[str] = Field(default_factory=list)
    erp_posted: bool = False
    erp_response: Optional[Dict[str, Any]] = None
    acknowledgment_sent: bool = False
    acknowledgment_type: Optional[str] = None  # 997, 999
    file_name: Optional[str] = None
    file_size: Optional[int] = None
    received_at: datetime = Field(default_factory=datetime.utcnow)
    processed_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    metadata: Optional[Dict[str, Any]] = None

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}


class DocumentCreate(BaseModel):
    partner_id: str
    document_type: str
    direction: str
    raw_edi: str
    file_name: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class DocumentUpdate(BaseModel):
    status: Optional[str] = None
    parsed_segments: Optional[List[Dict[str, Any]]] = None
    canonical_json: Optional[Dict[str, Any]] = None
    x12_output: Optional[str] = None
    ai_confidence_score: Optional[float] = None
    ai_explanation: Optional[str] = None
    validation_results: Optional[List[Dict[str, Any]]] = None
    exception_ids: Optional[List[str]] = None
    erp_posted: Optional[bool] = None
    erp_response: Optional[Dict[str, Any]] = None
    acknowledgment_sent: Optional[bool] = None
    processed_at: Optional[datetime] = None
