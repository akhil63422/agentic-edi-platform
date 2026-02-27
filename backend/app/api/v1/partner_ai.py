"""
Partner AI API endpoints for chat, voice, and document processing
"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, Request
from typing import Dict, Any, List, Optional
from pydantic import BaseModel
import logging
from app.services.partner_ai_service import partner_ai_service
from app.core.database import get_database
from app.models.partner import TradingPartnerCreate
from app.api.v1.dependencies import require_operator, get_optional_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/partners/ai", tags=["partner-ai"])


@router.get("/config")
async def get_partner_ai_config(db=Depends(get_database)):
    """Get customizable Partner AI config (prompt, synonyms)"""
    doc = await db.platform_settings.find_one({"_id": "platform"})
    config = doc.get("partner_ai_config") or {}
    return {
        "system_prompt": config.get("system_prompt") or None,
        "name_synonyms": config.get("name_synonyms") or {"one word": "oneworld"},
    }


class PartnerAIConfigUpdate(BaseModel):
    system_prompt: Optional[str] = None
    name_synonyms: Optional[Dict[str, str]] = None


@router.patch("/config")
async def update_partner_ai_config(update: PartnerAIConfigUpdate, db=Depends(get_database)):
    """Update Partner AI config - customizable prompts and name mappings"""
    from app.services.partner_ai_service import partner_ai_service
    doc = await db.platform_settings.find_one({"_id": "platform"}) or {}
    config = doc.get("partner_ai_config") or {}
    if update.system_prompt is not None:
        config["system_prompt"] = update.system_prompt
        partner_ai_service._system_prompt = update.system_prompt
    if update.name_synonyms is not None:
        config["name_synonyms"] = update.name_synonyms
        partner_ai_service._name_synonyms = update.name_synonyms
    doc["partner_ai_config"] = config
    doc["_id"] = "platform"
    await db.platform_settings.update_one({"_id": "platform"}, {"$set": doc}, upsert=True)
    return {"system_prompt": config.get("system_prompt"), "name_synonyms": config.get("name_synonyms")}


@router.get("/status")
async def get_ai_status():
    """Check if Hugging Face AI (Qwen, Whisper) is available"""
    try:
        from app.services.partner_ai_service import HAS_GPU, HF_AVAILABLE
        return {
            "available": HF_AVAILABLE,
            "gpu": HAS_GPU,
            "models": {
                "chat": "Qwen2.5-7B-Instruct",
                "voice": "Whisper-base",
                "document": "LayoutLMv3",
            },
        }
    except Exception as e:
        return {"available": False, "error": str(e)}


@router.post("/chat")
async def process_chat(
    request: Request,
    message: str = Form(...),
    conversation_history: Optional[str] = Form(None),  # JSON string
    context: Optional[str] = Form(None),  # JSON string
    db=Depends(get_database)
):
    """
    Process chat message and extract partner information
    
    Args:
        message: User's chat message
        conversation_history: JSON string of conversation history
        context: JSON string of additional context
        
    Returns:
        AI response and extracted partner data
    """
    try:
        import json
        
        # Get optional user (for audit logging if authenticated)
        current_user = None
        if request:
            current_user = await get_optional_user(request)
        
        # Parse JSON strings
        history = []
        if conversation_history:
            try:
                history = json.loads(conversation_history)
            except:
                pass
        
        ctx = {}
        if context:
            try:
                ctx = json.loads(context)
            except:
                pass
        
        # Process message
        result = await partner_ai_service.process_chat_message(
            message=message,
            conversation_history=history,
            context=ctx
        )
        
        return {
            "success": True,
            "response": result.get("response", ""),
            "extracted_data": result.get("extracted_data", {}),
            "confidence": result.get("confidence", 0.0)
        }
        
    except Exception as e:
        logger.error(f"Error processing chat: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/voice")
async def process_voice(
    request: Request,
    audio_file: UploadFile = File(...),
    db=Depends(get_database)
):
    """
    Process voice input and extract partner information
    
    Args:
        audio_file: Audio file (wav, mp3, etc.)
        
    Returns:
        Transcribed text and extracted partner data
    """
    try:
        # Get optional user (for audit logging if authenticated)
        current_user = None
        if request:
            current_user = await get_optional_user(request)
        
        # Read audio file
        audio_data = await audio_file.read()
        audio_format = audio_file.content_type or "audio/wav"
        
        # Process voice
        result = await partner_ai_service.process_voice_input(
            audio_data=audio_data,
            audio_format=audio_format
        )
        
        if result.get("error"):
            raise HTTPException(status_code=400, detail=result["error"])
        
        return {
            "success": True,
            "text": result.get("text", ""),
            "extracted_data": result.get("extracted_data", {}),
            "confidence": result.get("confidence", 0.0)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing voice: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/document")
async def process_document(
    request: Request,
    file: UploadFile = File(...),
    db=Depends(get_database)
):
    """
    Process uploaded document and extract partner information
    
    Args:
        file: Document file (PDF, DOCX, XLSX, etc.)
        
    Returns:
        Extracted partner data from document
    """
    try:
        # Get optional user (for audit logging if authenticated)
        current_user = None
        if request:
            current_user = await get_optional_user(request)
        
        # Read file
        file_data = await file.read()
        file_type = file.content_type or "application/octet-stream"
        
        # Process document
        result = await partner_ai_service.process_document_upload(
            file_data=file_data,
            file_name=file.filename or "unknown",
            file_type=file_type
        )
        
        if result.get("error"):
            raise HTTPException(status_code=400, detail=result["error"])
        
        return {
            "success": True,
            "extracted_data": result.get("extracted_data", {}),
            "confidence": result.get("confidence", 0.0),
            "file_name": result.get("file_name", "")
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing document: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/save-partner")
async def save_partner_from_ai(
    request: Request,
    partner_data: Dict[str, Any],
    db=Depends(get_database)
):
    """
    Save partner data extracted from AI processing
    
    Args:
        partner_data: Partner data dictionary
        
    Returns:
        Created partner object
    """
    try:
        from app.models.partner import TradingPartnerCreate, TradingPartner
        from app.models.audit import AuditLogCreate
        from datetime import datetime
        from bson import ObjectId
        
        # Convert dict to Pydantic model
        partner_create = TradingPartnerCreate(**partner_data)
        
        # Check if partner code already exists
        existing = await db.trading_partners.find_one({"partner_code": partner_create.partner_code})
        if existing:
            raise HTTPException(status_code=400, detail="Partner code already exists")
        
        partner_dict = partner_create.model_dump()
        partner_dict["created_at"] = datetime.utcnow()
        partner_dict["updated_at"] = datetime.utcnow()
        
        result = await db.trading_partners.insert_one(partner_dict)
        partner = await db.trading_partners.find_one({"_id": result.inserted_id})
        partner["_id"] = str(partner["_id"])
        
        # Create audit log (if user is authenticated)
        current_user = None
        if request:
            current_user = await get_optional_user(request)
        
        if current_user:
            audit_log = AuditLogCreate(
                action_type="Configuration",
                action="Created",
                entity_type="Partner",
                entity_id=str(result.inserted_id),
                user_id=current_user.get("_id") or current_user.get("id"),
                user_type="Human",
                description=f"Created trading partner via AI: {partner_create.business_name}"
            )
            await db.audit_logs.insert_one(audit_log.model_dump())
        
        return {
            "success": True,
            "partner": partner
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error saving partner: {e}")
        raise HTTPException(status_code=500, detail=str(e))
