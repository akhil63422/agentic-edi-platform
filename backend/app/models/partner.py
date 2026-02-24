from datetime import datetime
from typing import Optional, List, Dict, Any, Annotated
from pydantic import BaseModel, Field, GetJsonSchemaHandler
from pydantic_core import core_schema
from pydantic.json_schema import JsonSchemaValue
from bson import ObjectId


class PyObjectId(ObjectId):
    @classmethod
    def __get_pydantic_core_schema__(
        cls, source_type: Any, handler: Any
    ) -> core_schema.CoreSchema:
        return core_schema.no_info_after_validator_function(
            cls.validate,
            core_schema.str_schema(),
            serialization=core_schema.plain_serializer_function_ser_schema(
                lambda x: str(x)
            ),
        )

    @classmethod
    def validate(cls, v):
        if isinstance(v, ObjectId):
            return v
        if isinstance(v, str):
            if ObjectId.is_valid(v):
                return ObjectId(v)
            raise ValueError("Invalid ObjectId string")
        raise ValueError("Invalid ObjectId")

    @classmethod
    def __get_pydantic_json_schema__(
        cls, core_schema: core_schema.CoreSchema, handler: GetJsonSchemaHandler
    ) -> JsonSchemaValue:
        return {"type": "string", "format": "objectid"}


class ContactInfo(BaseModel):
    name: str
    email: str
    phone: Optional[str] = None
    role: Optional[str] = None


class EDIConfig(BaseModel):
    standard: str  # X12, EDIFACT
    version: str  # 4010, 5010, etc.
    functional_group: Optional[str] = None
    character_set: str = "ASCII"
    delimiters: Dict[str, str] = Field(default_factory=lambda: {
        "element": "*",
        "segment": "~",
        "sub_element": ":"
    })
    isa_sender_id: Optional[str] = None
    isa_receiver_id: Optional[str] = None
    gs_ids: Optional[Dict[str, str]] = None


class ERPContext(BaseModel):
    backend_system: Optional[str] = None  # SAP, Oracle, NetSuite, etc.
    version: Optional[str] = None
    customizations: Optional[List[str]] = None
    notes: Optional[str] = None


class TransportConfig(BaseModel):
    type: str  # SFTP, AS2, S3, API, FTP
    endpoint: Optional[str] = None
    credentials: Optional[Dict[str, Any]] = None
    schedule: Optional[str] = None  # Cron expression
    encryption: Optional[str] = None
    compression: Optional[str] = None


class DocumentAgreement(BaseModel):
    transaction_set: str  # 850, 810, etc.
    direction: str  # Inbound, Outbound
    frequency: Optional[str] = None
    acknowledgment_required: bool = True
    sla: Optional[Dict[str, Any]] = None
    retry_rules: Optional[Dict[str, Any]] = None


class TradingPartner(BaseModel):
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    business_name: str
    partner_code: str
    role: str  # Customer, Supplier, Both
    industry: Optional[str] = None
    country: Optional[str] = None
    timezone: Optional[str] = None
    business_contact: Optional[ContactInfo] = None
    technical_contact: Optional[ContactInfo] = None
    status: str = "Draft"  # Draft, Testing, Active, Suspended
    edi_config: Optional[EDIConfig] = None
    erp_context: Optional[ERPContext] = None
    document_agreements: List[DocumentAgreement] = Field(default_factory=list)
    transport_config: Optional[TransportConfig] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: Optional[str] = None
    notes: Optional[str] = None

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}
        json_schema_extra = {
            "example": {
                "business_name": "Example Corp",
                "partner_code": "EX001",
                "role": "Customer"
            }
        }


class TradingPartnerCreate(BaseModel):
    business_name: str
    partner_code: str
    role: str
    industry: Optional[str] = None
    country: Optional[str] = None
    timezone: Optional[str] = None
    business_contact: Optional[ContactInfo] = None
    technical_contact: Optional[ContactInfo] = None
    edi_config: Optional[EDIConfig] = None
    erp_context: Optional[ERPContext] = None
    document_agreements: List[DocumentAgreement] = Field(default_factory=list)
    transport_config: Optional[TransportConfig] = None
    notes: Optional[str] = None


class TradingPartnerUpdate(BaseModel):
    business_name: Optional[str] = None
    partner_code: Optional[str] = None
    role: Optional[str] = None
    industry: Optional[str] = None
    country: Optional[str] = None
    timezone: Optional[str] = None
    business_contact: Optional[ContactInfo] = None
    technical_contact: Optional[ContactInfo] = None
    status: Optional[str] = None
    edi_config: Optional[EDIConfig] = None
    erp_context: Optional[ERPContext] = None
    document_agreements: Optional[List[DocumentAgreement]] = None
    transport_config: Optional[TransportConfig] = None
    notes: Optional[str] = None
