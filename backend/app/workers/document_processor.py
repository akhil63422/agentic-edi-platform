"""
Document Processing Worker
Processes EDI documents through the pipeline
"""
import asyncio
from datetime import datetime
from typing import Dict, Any, Optional
import logging
from app.core.database import get_database
from app.services.edi_parser import parse_edi
from app.services.ai_service import ai_service
from app.services.erp_service import erp_service
from app.services.exception_engine import exception_engine
from app.api.v1.websocket import broadcast_document_update, broadcast_exception
from app.models.document import DocumentUpdate
from app.models.exception import ExceptionCreate

logger = logging.getLogger(__name__)


class DocumentProcessor:
    """Processes EDI documents through the pipeline"""
    
    def __init__(self):
        self.db = None
    
    async def process_document(self, document_id: str) -> Dict[str, Any]:
        """Process a document through the pipeline"""
        db = get_database()
        
        try:
            # Get document
            from bson import ObjectId
            document = await db.documents.find_one({"_id": ObjectId(document_id)})
            if not document:
                raise ValueError(f"Document {document_id} not found")
            
            # Get partner
            partner = await db.trading_partners.find_one({"_id": ObjectId(document["partner_id"])})
            if not partner:
                raise ValueError(f"Partner {document['partner_id']} not found")
            
            # Step 1: Update status to Parsing
            await self._update_status(db, document_id, "Parsing")
            await broadcast_document_update(document_id, "Parsing")
            
            # Step 2: Parse EDI
            edi_config = partner.get("edi_config", {})
            standard = edi_config.get("standard", "X12")
            
            try:
                parsed_data = parse_edi(document["raw_edi"], standard)
                parsed_segments = parsed_data.get("segments", [])
                
                # Update document with parsed segments
                await db.documents.update_one(
                    {"_id": ObjectId(document_id)},
                    {"$set": {
                        "parsed_segments": parsed_segments,
                        "updated_at": datetime.utcnow()
                    }}
                )
            except Exception as e:
                logger.error(f"Error parsing document {document_id}: {e}")
                await self._create_exception(
                    db, document_id, document["partner_id"],
                    "Parsing Error", "Critical", str(e)
                )
                await self._update_status(db, document_id, "Failed")
                from app.services.slack_service import slack_service
                await slack_service.notify_document_status(document_id, "Failed", partner.get("partner_code"), document.get("document_type"))
                return {"success": False, "error": str(e)}
            
            # Step 3: Update status to Validating
            await self._update_status(db, document_id, "Validating")
            
            # Step 4: Validate document
            validation_results = []
            # Basic validation - check for required segments
            if standard == "X12":
                segment_ids = [s.get("segment_id") for s in parsed_segments]
                required_segments = ["ISA", "GS", "ST", "SE", "GE", "IEA"]
                for req_seg in required_segments:
                    if req_seg not in segment_ids:
                        validation_results.append({
                            "type": "error",
                            "message": f"Missing required segment: {req_seg}",
                            "severity": "High"
                        })
            
            # Step 5: Update status to Mapping
            await self._update_status(db, document_id, "Mapping")
            
            # Step 6: Apply mapping (if exists)
            canonical_json = None
            mapping = await db.mappings.find_one({
                "partner_id": document["partner_id"],
                "document_type": document["document_type"],
                "direction": document["direction"],
                "is_active": True
            })
            
            if mapping:
                # Apply mapping transformation
                canonical_json = await self._apply_mapping(parsed_segments, mapping)
                await db.documents.update_one(
                    {"_id": ObjectId(document_id)},
                    {"$set": {
                        "canonical_json": canonical_json,
                        "updated_at": datetime.utcnow()
                    }}
                )
            
            # Step 7: Update status to AI Processing
            await self._update_status(db, document_id, "AI Processing")
            
            # Step 8: Calculate AI confidence score
            ai_confidence = await ai_service.calculate_confidence_score(
                parsed_segments, canonical_json, validation_results
            )
            
            # Detect exceptions using AI
            detected_exceptions = await ai_service.detect_exceptions(
                parsed_segments, canonical_json, validation_results
            )
            
            # Create exceptions from AI detection
            for exc in detected_exceptions:
                exception_result = await self._create_exception(
                    db, document_id, document["partner_id"],
                    exc["type"], exc["severity"], exc["description"]
                )
                if exception_result:
                    await broadcast_exception(exception_result, exc)
            
            # Evaluate exception rules
            rule_based_exceptions = await exception_engine.evaluate_rules(
                document_id, document["partner_id"],
                parsed_segments, canonical_json, validation_results
            )
            
            for exc in rule_based_exceptions:
                await broadcast_exception(exc["_id"], exc)
            
            # Step 9: Determine next action based on confidence
            if ai_confidence >= 0.90:
                # High confidence - auto-approve
                await self._update_status(db, document_id, "Completed")
                from app.services.slack_service import slack_service
                await slack_service.notify_document_status(document_id, "Completed", partner.get("partner_code"), document.get("document_type"))
                
                # Post to ERP if configured
                if canonical_json and partner.get("erp_context"):
                    erp_result = await erp_service.post_to_erp(
                        canonical_json,
                        partner.get("erp_context", {}),
                        document["document_type"]
                    )
                    
                    if erp_result.get("success"):
                        await db.documents.update_one(
                            {"_id": ObjectId(document_id)},
                            {"$set": {
                                "erp_posted": True,
                                "erp_response": erp_result
                            }}
                        )
            elif ai_confidence >= 0.75:
                # Medium confidence - flag for review
                await self._update_status(db, document_id, "Needs Review")
                await self._create_exception(
                    db, document_id, document["partner_id"],
                    "Low Confidence", "Medium",
                    f"AI confidence score: {ai_confidence:.2%}"
                )
            else:
                # Low confidence - create exception
                await self._update_status(db, document_id, "Needs Review")
                await self._create_exception(
                    db, document_id, document["partner_id"],
                    "Low Confidence", "High",
                    f"AI confidence score below threshold: {ai_confidence:.2%}"
                )
            
            # Update document with final status
            await db.documents.update_one(
                {"_id": ObjectId(document_id)},
                {"$set": {
                    "ai_confidence_score": ai_confidence,
                    "validation_results": validation_results,
                    "processed_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow()
                }}
            )
            
            return {"success": True, "confidence": ai_confidence}
        
        except Exception as e:
            logger.error(f"Error processing document {document_id}: {e}")
            await self._update_status(db, document_id, "Failed")
            from app.services.slack_service import slack_service
            document = await db.documents.find_one({"_id": ObjectId(document_id)})
            partner = await db.trading_partners.find_one({"_id": ObjectId(document["partner_id"])}) if document else None
            await slack_service.notify_document_status(document_id, "Failed", partner.get("partner_code") if partner else None, document.get("document_type") if document else None)
            return {"success": False, "error": str(e)}
    
    async def _update_status(self, db, document_id: str, status: str):
        """Update document status"""
        from bson import ObjectId
        await db.documents.update_one(
            {"_id": ObjectId(document_id)},
            {"$set": {
                "status": status,
                "updated_at": datetime.utcnow()
            }}
        )
    
    async def _create_exception(
        self, db, document_id: str, partner_id: str,
        exception_type: str, severity: str, description: str
    ):
        """Create an exception"""
        from bson import ObjectId
        exception_data = ExceptionCreate(
            document_id=document_id,
            partner_id=partner_id,
            exception_type=exception_type,
            severity=severity,
            description=description
        )
        result = await db.exceptions.insert_one(exception_data.model_dump())
        from app.services.slack_service import slack_service
        await slack_service.notify_exception(
            exception_type=exception_type,
            severity=severity,
            description=description,
            document_id=document_id,
            partner_id=partner_id,
        )
        return str(result.inserted_id)
    
    async def _apply_mapping(self, parsed_segments: list, mapping: dict) -> Dict[str, Any]:
        """Apply mapping transformation"""
        # Basic mapping implementation
        # In production, this would execute the mapping configuration
        canonical = {
            "document_type": mapping.get("document_type"),
            "fields": {}
        }
        
        # Apply field mappings
        for field_mapping in mapping.get("field_mappings", []):
            source_field = field_mapping.get("source_field")
            target_field = field_mapping.get("target_field")
            
            # Find source value in parsed segments
            value = self._extract_field_value(parsed_segments, source_field)
            
            # Apply transformation if specified
            if field_mapping.get("transformation"):
                value = self._apply_transformation(
                    value, field_mapping.get("transformation"),
                    field_mapping.get("transformation_params", {})
                )
            
            canonical["fields"][target_field] = value
        
        return canonical
    
    def _extract_field_value(self, parsed_segments: list, field_path: str) -> Optional[str]:
        """Extract field value from parsed segments"""
        # Basic implementation - would need full path parsing
        parts = field_path.split(".")
        if len(parts) >= 2:
            segment_id = parts[0]
            element_index = int(parts[1]) if parts[1].isdigit() else None
            
            for segment in parsed_segments:
                if segment.get("segment_id") == segment_id:
                    elements = segment.get("elements", [])
                    if element_index and element_index < len(elements):
                        return elements[element_index]
        return None
    
    def _apply_transformation(
        self, value: str, transformation: str, params: dict
    ) -> str:
        """Apply transformation to value"""
        if transformation == "concat":
            separator = params.get("separator", " ")
            values = params.get("values", [])
            return separator.join([value] + values)
        elif transformation == "format":
            format_str = params.get("format", "")
            # Basic formatting
            return value
        return value
    


# Global processor instance
processor = DocumentProcessor()
