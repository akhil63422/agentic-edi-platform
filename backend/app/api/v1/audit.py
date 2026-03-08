from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional
from datetime import datetime, timedelta
from bson import ObjectId
from app.core.database import get_database
from app.api.v1.dependencies import require_auth_if_enabled
from app.models.audit import AuditLog, AuditLogCreate
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/audit", tags=["audit"], dependencies=[Depends(require_auth_if_enabled)])


@router.get("/", response_model=List[AuditLog])
async def get_audit_logs(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    action_type: Optional[str] = None,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    user_id: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db=Depends(get_database)
):
    """Get all audit logs"""
    try:
        query = {}
        if action_type:
            query["action_type"] = action_type
        if entity_type:
            query["entity_type"] = entity_type
        if entity_id:
            query["entity_id"] = entity_id
        if user_id:
            query["user_id"] = user_id
        if start_date or end_date:
            query["created_at"] = {}
            if start_date:
                query["created_at"]["$gte"] = start_date
            if end_date:
                query["created_at"]["$lte"] = end_date
        
        cursor = db.audit_logs.find(query).sort("created_at", -1).skip(skip).limit(limit)
        logs = await cursor.to_list(length=limit)
        
        # Convert ObjectId to string
        for log in logs:
            log["_id"] = str(log["_id"])
        
        return logs
    except Exception as e:
        logger.error(f"Error fetching audit logs: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{log_id}", response_model=AuditLog)
async def get_audit_log(log_id: str, db=Depends(get_database)):
    """Get a specific audit log"""
    try:
        if not ObjectId.is_valid(log_id):
            raise HTTPException(status_code=400, detail="Invalid log ID")
        
        log = await db.audit_logs.find_one({"_id": ObjectId(log_id)})
        if not log:
            raise HTTPException(status_code=404, detail="Audit log not found")
        
        log["_id"] = str(log["_id"])
        return log
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching audit log {log_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/", response_model=AuditLog, status_code=201)
async def create_audit_log(audit_data: AuditLogCreate, db=Depends(get_database)):
    """Create a new audit log"""
    try:
        audit_dict = audit_data.model_dump()
        audit_dict["created_at"] = datetime.utcnow()
        
        result = await db.audit_logs.insert_one(audit_dict)
        log = await db.audit_logs.find_one({"_id": result.inserted_id})
        log["_id"] = str(log["_id"])
        
        return log
    except Exception as e:
        logger.error(f"Error creating audit log: {e}")
        raise HTTPException(status_code=500, detail=str(e))
