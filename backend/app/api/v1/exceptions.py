from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional
from datetime import datetime
from bson import ObjectId
from app.core.database import get_database
from app.models.exception import Exception, ExceptionCreate, ExceptionUpdate
from app.models.audit import AuditLogCreate
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/exceptions", tags=["exceptions"])


@router.get("/", response_model=List[Exception])
async def get_exceptions(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = None,
    severity: Optional[str] = None,
    exception_type: Optional[str] = None,
    partner_id: Optional[str] = None,
    document_id: Optional[str] = None,
    db=Depends(get_database)
):
    """Get all exceptions"""
    try:
        query = {}
        if status:
            query["status"] = status
        if severity:
            query["severity"] = severity
        if exception_type:
            query["exception_type"] = exception_type
        if partner_id:
            if ObjectId.is_valid(partner_id):
                query["partner_id"] = partner_id
        if document_id:
            if ObjectId.is_valid(document_id):
                query["document_id"] = document_id
        
        cursor = db.exceptions.find(query).sort("created_at", -1).skip(skip).limit(limit)
        exceptions = await cursor.to_list(length=limit)
        
        # Convert ObjectId to string
        for exc in exceptions:
            exc["_id"] = str(exc["_id"])
        
        return exceptions
    except Exception as e:
        logger.error(f"Error fetching exceptions: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{exception_id}", response_model=Exception)
async def get_exception(exception_id: str, db=Depends(get_database)):
    """Get a specific exception"""
    try:
        if not ObjectId.is_valid(exception_id):
            raise HTTPException(status_code=400, detail="Invalid exception ID")
        
        exception = await db.exceptions.find_one({"_id": ObjectId(exception_id)})
        if not exception:
            raise HTTPException(status_code=404, detail="Exception not found")
        
        exception["_id"] = str(exception["_id"])
        return exception
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching exception {exception_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/", response_model=Exception, status_code=201)
async def create_exception(exception_data: ExceptionCreate, db=Depends(get_database)):
    """Create a new exception"""
    try:
        exception_dict = exception_data.model_dump()
        exception_dict["created_at"] = datetime.utcnow()
        exception_dict["updated_at"] = datetime.utcnow()
        
        result = await db.exceptions.insert_one(exception_dict)
        exception = await db.exceptions.find_one({"_id": result.inserted_id})
        exception["_id"] = str(exception["_id"])
        
        # Update document with exception ID
        if ObjectId.is_valid(exception_data.document_id):
            await db.documents.update_one(
                {"_id": ObjectId(exception_data.document_id)},
                {"$addToSet": {"exception_ids": str(result.inserted_id)}}
            )
        
        # Create audit log
        audit_log = AuditLogCreate(
            action_type="Exception",
            action="Created",
            entity_type="Exception",
            entity_id=str(result.inserted_id),
            description=f"Created exception: {exception_data.exception_type} - {exception_data.description}"
        )
        await db.audit_logs.insert_one(audit_log.model_dump())
        
        return exception
    except Exception as e:
        logger.error(f"Error creating exception: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{exception_id}", response_model=Exception)
async def update_exception(
    exception_id: str,
    exception_data: ExceptionUpdate,
    db=Depends(get_database)
):
    """Update an exception"""
    try:
        if not ObjectId.is_valid(exception_id):
            raise HTTPException(status_code=400, detail="Invalid exception ID")
        
        exception = await db.exceptions.find_one({"_id": ObjectId(exception_id)})
        if not exception:
            raise HTTPException(status_code=404, detail="Exception not found")
        
        update_data = exception_data.model_dump(exclude_unset=True)
        if "resolved_at" not in update_data and update_data.get("status") == "Resolved":
            update_data["resolved_at"] = datetime.utcnow()
        update_data["updated_at"] = datetime.utcnow()
        
        await db.exceptions.update_one(
            {"_id": ObjectId(exception_id)},
            {"$set": update_data}
        )
        
        updated_exception = await db.exceptions.find_one({"_id": ObjectId(exception_id)})
        updated_exception["_id"] = str(updated_exception["_id"])
        
        # Create audit log
        audit_log = AuditLogCreate(
            action_type="Exception",
            action="Updated",
            entity_type="Exception",
            entity_id=exception_id,
            description=f"Updated exception status: {update_data.get('status', 'Unknown')}"
        )
        await db.audit_logs.insert_one(audit_log.model_dump())
        
        return updated_exception
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating exception {exception_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
