from fastapi import APIRouter, HTTPException, Depends, Query, Request
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from bson import ObjectId
import httpx
from app.core.database import get_database
from app.models.partner import TradingPartner, TradingPartnerCreate, TradingPartnerUpdate
from app.models.audit import AuditLogCreate
from app.api.v1.dependencies import get_optional_user, require_auth_if_enabled
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/partners", tags=["partners"], dependencies=[Depends(require_auth_if_enabled)])


class TestERPConnectionRequest(BaseModel):
    endpoint: str
    api_key: Optional[str] = None
    type: Optional[str] = "API"


@router.post("/test-erp-connection")
async def test_erp_connection(req: TestERPConnectionRequest):
    """Test ERP endpoint connectivity (does not validate credentials fully)."""
    try:
        headers = {"Content-Type": "application/json"}
        if req.api_key:
            headers["Authorization"] = f"Bearer {req.api_key}"
        async with httpx.AsyncClient(timeout=10) as client:
            # Use HEAD or GET to verify endpoint is reachable
            resp = await client.get(req.endpoint.rstrip("/") + "/", headers=headers)
            if resp.status_code < 500:
                return {"success": True, "message": "Endpoint reachable"}
            return {"success": False, "message": f"HTTP {resp.status_code}"}
    except httpx.ConnectError as e:
        return {"success": False, "message": f"Connection failed: {str(e)[:100]}"}
    except Exception as e:
        return {"success": False, "message": str(e)[:100]}


@router.get("/", response_model=List[TradingPartner])
async def get_partners(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = None,
    search: Optional[str] = None,
    db=Depends(get_database)
):
    """Get all trading partners"""
    try:
        query = {}
        if status:
            query["status"] = status
        if search:
            query["$or"] = [
                {"business_name": {"$regex": search, "$options": "i"}},
                {"partner_code": {"$regex": search, "$options": "i"}}
            ]
        
        cursor = db.trading_partners.find(query).sort("created_at", -1).skip(skip).limit(limit)
        partners = await cursor.to_list(length=limit)
        
        # Normalize documents for response (handle legacy schema: partner_name vs business_name, missing role)
        normalized = []
        for partner in partners:
            p = dict(partner)
            p["_id"] = str(p["_id"])
            if not p.get("business_name") and p.get("partner_name"):
                p["business_name"] = p["partner_name"]
            if not p.get("role"):
                p["role"] = "Both"
            normalized.append(p)
        
        return normalized
    except Exception as e:
        logger.error(f"Error fetching partners: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{partner_id}", response_model=TradingPartner)
async def get_partner(partner_id: str, db=Depends(get_database)):
    """Get a specific trading partner"""
    try:
        if not ObjectId.is_valid(partner_id):
            raise HTTPException(status_code=400, detail="Invalid partner ID")
        
        partner = await db.trading_partners.find_one({"_id": ObjectId(partner_id)})
        if not partner:
            raise HTTPException(status_code=404, detail="Partner not found")
        
        p = dict(partner)
        p["_id"] = str(p["_id"])
        if not p.get("business_name") and p.get("partner_name"):
            p["business_name"] = p["partner_name"]
        if not p.get("role"):
            p["role"] = "Both"
        return p
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching partner {partner_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/", response_model=TradingPartner, status_code=201)
async def create_partner(
    partner_data: TradingPartnerCreate,
    request: Request,
    db=Depends(get_database),
):
    """Create a new trading partner"""
    try:
        existing = await db.trading_partners.find_one({"partner_code": partner_data.partner_code})
        if existing:
            raise HTTPException(status_code=400, detail="Partner code already exists")
        
        partner_dict = partner_data.model_dump()
        partner_dict["created_at"] = datetime.utcnow()
        partner_dict["updated_at"] = datetime.utcnow()
        partner_dict["status"] = "Draft"

        result = await db.trading_partners.insert_one(partner_dict)
        partner = await db.trading_partners.find_one({"_id": result.inserted_id})
        partner["_id"] = str(partner["_id"])
        
        current_user = await get_optional_user(request)
        audit_log = AuditLogCreate(
            action_type="Configuration",
            action="Created",
            entity_type="Partner",
            entity_id=str(result.inserted_id),
            user_id=(current_user.get("_id") or current_user.get("id")) if current_user else None,
            user_type="Human",
            description=f"Created trading partner: {partner_data.business_name}"
        )
        await db.audit_logs.insert_one(audit_log.model_dump())
        
        return partner
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating partner: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{partner_id}", response_model=TradingPartner)
async def update_partner(
    partner_id: str,
    partner_data: TradingPartnerUpdate,
    db=Depends(get_database)
):
    """Update a trading partner"""
    try:
        if not ObjectId.is_valid(partner_id):
            raise HTTPException(status_code=400, detail="Invalid partner ID")
        
        partner = await db.trading_partners.find_one({"_id": ObjectId(partner_id)})
        if not partner:
            raise HTTPException(status_code=404, detail="Partner not found")
        
        update_data = partner_data.model_dump(exclude_unset=True)
        update_data["updated_at"] = datetime.utcnow()
        
        await db.trading_partners.update_one(
            {"_id": ObjectId(partner_id)},
            {"$set": update_data}
        )
        
        updated_partner = await db.trading_partners.find_one({"_id": ObjectId(partner_id)})
        updated_partner["_id"] = str(updated_partner["_id"])
        
        # Create audit log
        audit_log = AuditLogCreate(
            action_type="Configuration",
            action="Updated",
            entity_type="Partner",
            entity_id=partner_id,
            description=f"Updated trading partner: {updated_partner.get('business_name', 'Unknown')}"
        )
        await db.audit_logs.insert_one(audit_log.model_dump())
        
        return updated_partner
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating partner {partner_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{partner_id}", status_code=204)
async def delete_partner(partner_id: str, db=Depends(get_database)):
    """Delete a trading partner"""
    try:
        if not ObjectId.is_valid(partner_id):
            raise HTTPException(status_code=400, detail="Invalid partner ID")
        
        partner = await db.trading_partners.find_one({"_id": ObjectId(partner_id)})
        if not partner:
            raise HTTPException(status_code=404, detail="Partner not found")
        
        await db.trading_partners.delete_one({"_id": ObjectId(partner_id)})
        
        # Create audit log
        audit_log = AuditLogCreate(
            action_type="Configuration",
            action="Deleted",
            entity_type="Partner",
            entity_id=partner_id,
            description=f"Deleted trading partner: {partner.get('business_name', 'Unknown')}"
        )
        await db.audit_logs.insert_one(audit_log.model_dump())
        
        return None
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting partner {partner_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
