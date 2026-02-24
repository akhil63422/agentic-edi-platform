from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional
from datetime import datetime
from bson import ObjectId
from app.core.database import get_database
from app.models.mapping import Mapping, MappingCreate, MappingUpdate
from app.models.audit import AuditLogCreate
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/mappings", tags=["mappings"])


@router.get("/", response_model=List[Mapping])
async def get_mappings(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    partner_id: Optional[str] = None,
    document_type: Optional[str] = None,
    direction: Optional[str] = None,
    is_active: Optional[bool] = None,
    db=Depends(get_database)
):
    """Get all mappings"""
    try:
        query = {}
        if partner_id:
            if ObjectId.is_valid(partner_id):
                query["partner_id"] = partner_id
        if document_type:
            query["document_type"] = document_type
        if direction:
            query["direction"] = direction
        if is_active is not None:
            query["is_active"] = is_active
        
        cursor = db.mappings.find(query).sort("created_at", -1).skip(skip).limit(limit)
        mappings = await cursor.to_list(length=limit)
        
        # Convert ObjectId to string
        for mapping in mappings:
            mapping["_id"] = str(mapping["_id"])
        
        return mappings
    except Exception as e:
        logger.error(f"Error fetching mappings: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{mapping_id}", response_model=Mapping)
async def get_mapping(mapping_id: str, db=Depends(get_database)):
    """Get a specific mapping"""
    try:
        if not ObjectId.is_valid(mapping_id):
            raise HTTPException(status_code=400, detail="Invalid mapping ID")
        
        mapping = await db.mappings.find_one({"_id": ObjectId(mapping_id)})
        if not mapping:
            raise HTTPException(status_code=404, detail="Mapping not found")
        
        mapping["_id"] = str(mapping["_id"])
        return mapping
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching mapping {mapping_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/", response_model=Mapping, status_code=201)
async def create_mapping(mapping_data: MappingCreate, db=Depends(get_database)):
    """Create a new mapping"""
    try:
        # Verify partner exists
        if ObjectId.is_valid(mapping_data.partner_id):
            partner = await db.trading_partners.find_one({"_id": ObjectId(mapping_data.partner_id)})
            if not partner:
                raise HTTPException(status_code=404, detail="Partner not found")
        
        mapping_dict = mapping_data.model_dump()
        mapping_dict["created_at"] = datetime.utcnow()
        mapping_dict["updated_at"] = datetime.utcnow()
        
        result = await db.mappings.insert_one(mapping_dict)
        mapping = await db.mappings.find_one({"_id": result.inserted_id})
        mapping["_id"] = str(mapping["_id"])
        
        # Create audit log
        audit_log = AuditLogCreate(
            action_type="Configuration",
            action="Created",
            entity_type="Mapping",
            entity_id=str(result.inserted_id),
            description=f"Created mapping: {mapping_data.name} for {mapping_data.document_type}"
        )
        await db.audit_logs.insert_one(audit_log.model_dump())
        
        return mapping
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating mapping: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{mapping_id}", response_model=Mapping)
async def update_mapping(
    mapping_id: str,
    mapping_data: MappingUpdate,
    db=Depends(get_database)
):
    """Update a mapping"""
    try:
        if not ObjectId.is_valid(mapping_id):
            raise HTTPException(status_code=400, detail="Invalid mapping ID")
        
        mapping = await db.mappings.find_one({"_id": ObjectId(mapping_id)})
        if not mapping:
            raise HTTPException(status_code=404, detail="Mapping not found")
        
        update_data = mapping_data.model_dump(exclude_unset=True)
        update_data["updated_at"] = datetime.utcnow()
        
        await db.mappings.update_one(
            {"_id": ObjectId(mapping_id)},
            {"$set": update_data}
        )
        
        updated_mapping = await db.mappings.find_one({"_id": ObjectId(mapping_id)})
        updated_mapping["_id"] = str(updated_mapping["_id"])
        
        # Create audit log
        audit_log = AuditLogCreate(
            action_type="Configuration",
            action="Updated",
            entity_type="Mapping",
            entity_id=mapping_id,
            description=f"Updated mapping: {updated_mapping.get('name', 'Unknown')}"
        )
        await db.audit_logs.insert_one(audit_log.model_dump())
        
        return updated_mapping
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating mapping {mapping_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{mapping_id}", status_code=204)
async def delete_mapping(mapping_id: str, db=Depends(get_database)):
    """Delete a mapping"""
    try:
        if not ObjectId.is_valid(mapping_id):
            raise HTTPException(status_code=400, detail="Invalid mapping ID")
        
        mapping = await db.mappings.find_one({"_id": ObjectId(mapping_id)})
        if not mapping:
            raise HTTPException(status_code=404, detail="Mapping not found")
        
        await db.mappings.delete_one({"_id": ObjectId(mapping_id)})
        
        # Create audit log
        audit_log = AuditLogCreate(
            action_type="Configuration",
            action="Deleted",
            entity_type="Mapping",
            entity_id=mapping_id,
            description=f"Deleted mapping: {mapping.get('name', 'Unknown')}"
        )
        await db.audit_logs.insert_one(audit_log.model_dump())
        
        return None
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting mapping {mapping_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
