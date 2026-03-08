from datetime import datetime
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field
from bson import ObjectId
from app.models.partner import PyObjectId


class Exception(BaseModel):
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    document_id: str
    partner_id: str
    partner_code: Optional[str] = None
    exception_type: str  # Low Confidence, Validation Error, Mapping Error, Business Rule Violation, Data Quality, Transport Error
    severity: str  # Critical, High, Medium, Low
    status: str = "Open"  # Open, In Review, Resolved
    ai_confidence_score: Optional[float] = None
    ai_suggestion: Optional[str] = None
    description: str
    field_path: Optional[str] = None
    error_details: Optional[Dict[str, Any]] = None
    resolution_action: Optional[str] = None
    resolved_by: Optional[str] = None
    resolved_at: Optional[datetime] = None
    sla_breach: bool = False  # True when exception exceeds SLA threshold
    sla_hours_threshold: Optional[int] = None  # Hours for this severity
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    tags: List[str] = Field(default_factory=list)
    metadata: Optional[Dict[str, Any]] = None

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}


class ExceptionCreate(BaseModel):
    document_id: str
    partner_id: str
    exception_type: str
    severity: str
    description: str
    field_path: Optional[str] = None
    error_details: Optional[Dict[str, Any]] = None
    ai_confidence_score: Optional[float] = None
    ai_suggestion: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    metadata: Optional[Dict[str, Any]] = None


class ExceptionUpdate(BaseModel):
    status: Optional[str] = None
    resolution_action: Optional[str] = None
    resolved_by: Optional[str] = None
    resolved_at: Optional[datetime] = None
    tags: Optional[List[str]] = None
    metadata: Optional[Dict[str, Any]] = None
