from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from bson import ObjectId
from app.core.database import get_database
from app.workers.document_processor import processor
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/process", tags=["process"])


@router.post("/document/{document_id}")
async def process_document(
    document_id: str,
    background_tasks: BackgroundTasks,
    db=Depends(get_database)
):
    """Process a document through the pipeline"""
    try:
        if not ObjectId.is_valid(document_id):
            raise HTTPException(status_code=400, detail="Invalid document ID")
        
        # Verify document exists
        document = await db.documents.find_one({"_id": ObjectId(document_id)})
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        
        # Process in background
        background_tasks.add_task(processor.process_document, document_id)
        
        return {
            "message": "Document processing started",
            "document_id": document_id,
            "status": "Processing"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error starting document processing: {e}")
        raise HTTPException(status_code=500, detail=str(e))
