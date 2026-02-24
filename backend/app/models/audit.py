from datetime import datetime
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field
from bson import ObjectId
from app.models.partner import PyObjectId


class AuditLog(BaseModel):
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    action_type: str  # Exception, Processing, Configuration, Transport, Security, AI
    action: str  # Created, Updated, Deleted, Processed, etc.
    entity_type: str  # Partner, Document, Mapping, Exception, User
    entity_id: Optional[str] = None
    user_id: Optional[str] = None
    user_type: str = "Human"  # Human, AI Agent
    description: str
    metadata: Optional[Dict[str, Any]] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    related_logs: List[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}


class AuditLogCreate(BaseModel):
    action_type: str
    action: str
    entity_type: str
    entity_id: Optional[str] = None
    user_id: Optional[str] = None
    user_type: str = "Human"
    description: str
    metadata: Optional[Dict[str, Any]] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    related_logs: List[str] = Field(default_factory=list)
