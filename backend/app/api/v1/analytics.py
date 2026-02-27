from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from bson import ObjectId
from app.core.database import get_database
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/dashboard")
async def get_dashboard_analytics(
    days: int = Query(7, ge=1, le=365),
    db=Depends(get_database)
):
    """Get dashboard analytics"""
    try:
        start_date = datetime.utcnow() - timedelta(days=days)
        
        # Document metrics
        total_documents = await db.documents.count_documents({
            "created_at": {"$gte": start_date}
        })
        
        completed_documents = await db.documents.count_documents({
            "created_at": {"$gte": start_date},
            "status": "Completed"
        })
        
        failed_documents = await db.documents.count_documents({
            "created_at": {"$gte": start_date},
            "status": "Failed"
        })
        
        needs_review = await db.documents.count_documents({
            "created_at": {"$gte": start_date},
            "status": "Needs Review"
        })
        
        success_rate = (completed_documents / total_documents * 100) if total_documents > 0 else 0
        
        # Exception metrics
        total_exceptions = await db.exceptions.count_documents({
            "created_at": {"$gte": start_date}
        })
        
        resolved_exceptions = await db.exceptions.count_documents({
            "created_at": {"$gte": start_date},
            "status": "Resolved"
        })
        
        open_exceptions = await db.exceptions.count_documents({
            "status": "Open"
        })
        
        # Partner metrics
        total_partners = await db.trading_partners.count_documents({})
        active_partners = await db.trading_partners.count_documents({
            "status": "Active"
        })
        
        # Processing time metrics
        pipeline = [
            {"$match": {"processed_at": {"$exists": True, "$ne": None, "$gte": start_date}, "received_at": {"$exists": True, "$ne": None}}},
            {"$project": {
                "processing_time": {
                    "$subtract": ["$processed_at", "$received_at"]
                }
            }},
            {"$group": {
                "_id": None,
                "avg_time": {"$avg": "$processing_time"},
                "min_time": {"$min": "$processing_time"},
                "max_time": {"$max": "$processing_time"}
            }}
        ]
        
        time_stats = await db.documents.aggregate(pipeline).to_list(length=1)
        avg_processing_time = 0
        if time_stats and time_stats[0].get("avg_time") is not None:
            avg_processing_time = time_stats[0]["avg_time"] / 1000  # Convert ms to seconds
        
        return {
            "period_days": days,
            "documents": {
                "total": total_documents,
                "completed": completed_documents,
                "failed": failed_documents,
                "needs_review": needs_review,
                "success_rate": round(success_rate, 2)
            },
            "exceptions": {
                "total": total_exceptions,
                "resolved": resolved_exceptions,
                "open": open_exceptions,
                "resolution_rate": round((resolved_exceptions / total_exceptions * 100) if total_exceptions > 0 else 0, 2)
            },
            "partners": {
                "total": total_partners,
                "active": active_partners
            },
            "performance": {
                "avg_processing_time_seconds": round(avg_processing_time, 2)
            }
        }
    
    except Exception as e:
        logger.error(f"Error fetching dashboard analytics: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/trends")
async def get_trends(
    metric: str = Query("documents", pattern="^(documents|exceptions|partners)$"),
    days: int = Query(30, ge=1, le=365),
    db=Depends(get_database)
):
    """Get trend data for a metric"""
    try:
        start_date = datetime.utcnow() - timedelta(days=days)
        
        # Group by day
        pipeline = [
            {"$match": {"created_at": {"$gte": start_date}}},
            {"$group": {
                "_id": {
                    "$dateToString": {
                        "format": "%Y-%m-%d",
                        "date": "$created_at"
                    }
                },
                "count": {"$sum": 1}
            }},
            {"$sort": {"_id": 1}}
        ]
        
        if metric == "documents":
            collection = db.documents
        elif metric == "exceptions":
            collection = db.exceptions
        else:
            collection = db.trading_partners
        
        trends = await collection.aggregate(pipeline).to_list(length=1000)
        
        return {
            "metric": metric,
            "period_days": days,
            "data": trends
        }
    
    except Exception as e:
        logger.error(f"Error fetching trends: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/partner-performance")
async def get_partner_performance(
    partner_id: Optional[str] = None,
    days: int = Query(30, ge=1, le=365),
    db=Depends(get_database)
):
    """Get partner performance metrics"""
    try:
        start_date = datetime.utcnow() - timedelta(days=days)
        
        match_stage = {"created_at": {"$gte": start_date}}
        if partner_id:
            match_stage["partner_id"] = partner_id
        
        pipeline = [
            {"$match": match_stage},
            {"$group": {
                "_id": "$partner_id",
                "total_documents": {"$sum": 1},
                "completed": {"$sum": {"$cond": [{"$eq": ["$status", "Completed"]}, 1, 0]}},
                "failed": {"$sum": {"$cond": [{"$eq": ["$status", "Failed"]}, 1, 0]}},
                "avg_confidence": {"$avg": "$ai_confidence_score"}
            }},
            {"$sort": {"total_documents": -1}}
        ]
        
        performance = await db.documents.aggregate(pipeline).to_list(length=100)
        
        # Enrich with partner names
        for item in performance:
            if item.get("_id") is None:
                item["partner_name"] = "Unknown"
                item["partner_code"] = "N/A"
                item["success_rate"] = round(
                    (item["completed"] / item["total_documents"] * 100) if item["total_documents"] > 0 else 0,
                    2
                )
                continue
            try:
                partner = await db.trading_partners.find_one({"_id": ObjectId(item["_id"])})
            except Exception:
                partner = None
            if partner:
                item["partner_name"] = partner.get("business_name")
                item["partner_code"] = partner.get("partner_code")
            else:
                item["partner_name"] = "Unknown"
                item["partner_code"] = "N/A"
            
            item["success_rate"] = round(
                (item["completed"] / item["total_documents"] * 100) if item["total_documents"] > 0 else 0,
                2
            )
        
        return {
            "period_days": days,
            "partners": performance
        }
    
    except Exception as e:
        logger.error(f"Error fetching partner performance: {e}")
        raise HTTPException(status_code=500, detail=str(e))
