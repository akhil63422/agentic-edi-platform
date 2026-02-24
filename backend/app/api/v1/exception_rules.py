"""
Exception Rules API
Advanced exception management with custom rules
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional, Dict, Any
from datetime import datetime
from bson import ObjectId
from app.core.database import get_database
from app.api.v1.dependencies import require_operator
from pydantic import BaseModel
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/exception-rules", tags=["exception-rules"])


class ExceptionRule(BaseModel):
    id: Optional[str] = None
    name: str
    description: Optional[str] = None
    partner_id: Optional[str] = None  # None = global rule
    document_type: Optional[str] = None
    condition: Dict[str, Any]  # JSON condition
    action: str  # create_exception, escalate, auto_resolve, notify
    severity: str
    exception_type: str
    is_active: bool = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class ExceptionRuleCreate(BaseModel):
    name: str
    description: Optional[str] = None
    partner_id: Optional[str] = None
    document_type: Optional[str] = None
    condition: Dict[str, Any]
    action: str
    severity: str
    exception_type: str
    is_active: bool = True


@router.get("/", response_model=List[ExceptionRule])
async def get_exception_rules(
    partner_id: Optional[str] = None,
    is_active: Optional[bool] = None,
    db=Depends(get_database)
):
    """Get exception rules"""
    try:
        query = {}
        if partner_id:
            query["partner_id"] = partner_id
        if is_active is not None:
            query["is_active"] = is_active
        
        cursor = db.exception_rules.find(query).sort("created_at", -1)
        rules = await cursor.to_list(length=1000)
        
        for rule in rules:
            rule["_id"] = str(rule["_id"])
        
        return rules
    except Exception as e:
        logger.error(f"Error fetching exception rules: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/", response_model=ExceptionRule, status_code=201)
async def create_exception_rule(
    rule_data: ExceptionRuleCreate,
    db=Depends(get_database),
    current_user: dict = Depends(require_operator)
):
    """Create exception rule"""
    try:
        rule_dict = rule_data.model_dump()
        rule_dict["created_at"] = datetime.utcnow()
        rule_dict["updated_at"] = datetime.utcnow()
        
        result = await db.exception_rules.insert_one(rule_dict)
        rule = await db.exception_rules.find_one({"_id": result.inserted_id})
        rule["_id"] = str(rule["_id"])
        
        return rule
    except Exception as e:
        logger.error(f"Error creating exception rule: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{rule_id}", response_model=ExceptionRule)
async def update_exception_rule(
    rule_id: str,
    rule_data: Dict[str, Any],
    db=Depends(get_database),
    current_user: dict = Depends(require_operator)
):
    """Update exception rule"""
    try:
        if not ObjectId.is_valid(rule_id):
            raise HTTPException(status_code=400, detail="Invalid rule ID")
        
        rule = await db.exception_rules.find_one({"_id": ObjectId(rule_id)})
        if not rule:
            raise HTTPException(status_code=404, detail="Rule not found")
        
        update_data = {k: v for k, v in rule_data.items() if v is not None}
        update_data["updated_at"] = datetime.utcnow()
        
        await db.exception_rules.update_one(
            {"_id": ObjectId(rule_id)},
            {"$set": update_data}
        )
        
        updated_rule = await db.exception_rules.find_one({"_id": ObjectId(rule_id)})
        updated_rule["_id"] = str(updated_rule["_id"])
        
        return updated_rule
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating exception rule: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{rule_id}", status_code=204)
async def delete_exception_rule(
    rule_id: str,
    db=Depends(get_database),
    current_user: dict = Depends(require_operator)
):
    """Delete exception rule"""
    try:
        if not ObjectId.is_valid(rule_id):
            raise HTTPException(status_code=400, detail="Invalid rule ID")
        
        await db.exception_rules.delete_one({"_id": ObjectId(rule_id)})
        return None
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting exception rule: {e}")
        raise HTTPException(status_code=500, detail=str(e))
