from datetime import datetime
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field
from bson import ObjectId
from app.models.partner import PyObjectId


class FieldMapping(BaseModel):
    source_field: str
    target_field: str
    transformation: Optional[str] = None  # math, concat, format, etc.
    transformation_params: Optional[Dict[str, Any]] = None
    validation_rules: Optional[List[Dict[str, Any]]] = None
    required: bool = False
    default_value: Optional[str] = None


class ValidationRule(BaseModel):
    type: str  # required, type, length, regex, custom
    field: str
    params: Dict[str, Any]
    error_message: Optional[str] = None


class Mapping(BaseModel):
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    partner_id: str
    document_type: str
    direction: str
    name: str
    description: Optional[str] = None
    field_mappings: List[FieldMapping] = Field(default_factory=list)
    validation_rules: List[ValidationRule] = Field(default_factory=list)
    version: int = 1
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}


class MappingCreate(BaseModel):
    partner_id: str
    document_type: str
    direction: str
    name: str
    description: Optional[str] = None
    field_mappings: List[FieldMapping] = Field(default_factory=list)
    validation_rules: List[ValidationRule] = Field(default_factory=list)
    metadata: Optional[Dict[str, Any]] = None


class MappingUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    field_mappings: Optional[List[FieldMapping]] = None
    validation_rules: Optional[List[ValidationRule]] = None
    is_active: Optional[bool] = None
    metadata: Optional[Dict[str, Any]] = None
