from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional
from datetime import datetime
from bson import ObjectId
from app.core.database import get_database
from app.models.document import EDIDocument, DocumentCreate, DocumentUpdate
from app.models.audit import AuditLogCreate
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/documents", tags=["documents"])


@router.get("/", response_model=List[EDIDocument])
async def get_documents(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    direction: Optional[str] = None,
    status: Optional[str] = None,
    partner_id: Optional[str] = None,
    document_type: Optional[str] = None,
    db=Depends(get_database)
):
    """Get all documents"""
    try:
        query = {}
        if direction:
            query["direction"] = direction
        if status:
            query["status"] = status
        if partner_id:
            if ObjectId.is_valid(partner_id):
                query["partner_id"] = partner_id
        if document_type:
            query["document_type"] = document_type
        
        cursor = db.documents.find(query).sort("received_at", -1).skip(skip).limit(limit)
        documents = await cursor.to_list(length=limit)
        
        # Convert ObjectId to string
        for doc in documents:
            doc["_id"] = str(doc["_id"])
        
        return documents
    except Exception as e:
        logger.error(f"Error fetching documents: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{document_id}", response_model=EDIDocument)
async def get_document(document_id: str, db=Depends(get_database)):
    """Get a specific document"""
    try:
        if not ObjectId.is_valid(document_id):
            raise HTTPException(status_code=400, detail="Invalid document ID")
        
        document = await db.documents.find_one({"_id": ObjectId(document_id)})
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        
        document["_id"] = str(document["_id"])
        return document
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching document {document_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/", response_model=EDIDocument, status_code=201)
async def create_document(document_data: DocumentCreate, db=Depends(get_database)):
    """Create a new document"""
    try:
        # Verify partner exists
        if ObjectId.is_valid(document_data.partner_id):
            partner = await db.trading_partners.find_one({"_id": ObjectId(document_data.partner_id)})
            if not partner:
                raise HTTPException(status_code=404, detail="Partner not found")
            partner_code = partner.get("partner_code")
        else:
            partner_code = None
        
        document_dict = document_data.model_dump()
        document_dict["partner_code"] = partner_code
        document_dict["received_at"] = datetime.utcnow()
        document_dict["created_at"] = datetime.utcnow()
        document_dict["updated_at"] = datetime.utcnow()
        
        result = await db.documents.insert_one(document_dict)
        document = await db.documents.find_one({"_id": result.inserted_id})
        document["_id"] = str(document["_id"])
        
        # Create audit log
        audit_log = AuditLogCreate(
            action_type="Processing",
            action="Created",
            entity_type="Document",
            entity_id=str(result.inserted_id),
            description=f"Created {document_data.direction} document: {document_data.document_type}"
        )
        await db.audit_logs.insert_one(audit_log.model_dump())
        
        return document
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating document: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{document_id}", response_model=EDIDocument)
async def update_document(
    document_id: str,
    document_data: DocumentUpdate,
    db=Depends(get_database)
):
    """Update a document"""
    try:
        if not ObjectId.is_valid(document_id):
            raise HTTPException(status_code=400, detail="Invalid document ID")
        
        document = await db.documents.find_one({"_id": ObjectId(document_id)})
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        
        update_data = document_data.model_dump(exclude_unset=True)
        update_data["updated_at"] = datetime.utcnow()
        
        await db.documents.update_one(
            {"_id": ObjectId(document_id)},
            {"$set": update_data}
        )
        
        updated_document = await db.documents.find_one({"_id": ObjectId(document_id)})
        updated_document["_id"] = str(updated_document["_id"])
        
        # Create audit log
        audit_log = AuditLogCreate(
            action_type="Processing",
            action="Updated",
            entity_type="Document",
            entity_id=document_id,
            description=f"Updated document status: {update_data.get('status', 'Unknown')}"
        )
        await db.audit_logs.insert_one(audit_log.model_dump())
        
        return updated_document
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating document {document_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
