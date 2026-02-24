"""
AI Service
Handles AI/ML operations for confidence scoring, exception detection, and mapping suggestions
"""
import os
from typing import Dict, Any, List, Optional
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)


class AIService:
    """AI Service for EDI processing"""
    
    def __init__(self):
        self.openai_api_key = settings.OPENAI_API_KEY
        self.model = settings.AI_MODEL
        self.confidence_threshold_high = settings.AI_CONFIDENCE_THRESHOLD_HIGH
        self.confidence_threshold_medium = settings.AI_CONFIDENCE_THRESHOLD_MEDIUM
    
    async def calculate_confidence_score(
        self,
        parsed_segments: List[Dict[str, Any]],
        canonical_json: Optional[Dict[str, Any]] = None,
        validation_results: List[Dict[str, Any]] = None,
        partner_history: Optional[Dict[str, Any]] = None
    ) -> float:
        """
        Calculate AI confidence score for document processing
        
        Factors:
        - Pattern matching (historical data)
        - Format validation (EDI standard compliance)
        - Business rule compliance
        - Field correlation analysis
        - Historical accuracy rate
        """
        try:
            base_confidence = 0.85
            
            # Factor 1: Validation results
            if validation_results:
                error_count = len([r for r in validation_results if r.get("type") == "error"])
                warning_count = len([r for r in validation_results if r.get("type") == "warning"])
                base_confidence -= (error_count * 0.15) + (warning_count * 0.05)
            
            # Factor 2: Canonical JSON existence
            if canonical_json:
                base_confidence += 0.05
            
            # Factor 3: Partner history (if available)
            if partner_history:
                historical_accuracy = partner_history.get("accuracy_rate", 0.85)
                base_confidence = (base_confidence + historical_accuracy) / 2
            
            # Factor 4: Segment completeness
            if parsed_segments:
                required_segments = ["ISA", "GS", "ST", "SE", "GE", "IEA"]
                segment_ids = [s.get("segment_id") for s in parsed_segments]
                missing_segments = [s for s in required_segments if s not in segment_ids]
                base_confidence -= len(missing_segments) * 0.1
            
            # Factor 5: Field correlation (basic check)
            if canonical_json and canonical_json.get("fields"):
                field_count = len(canonical_json["fields"])
                if field_count > 5:
                    base_confidence += 0.03
            
            # Ensure confidence is between 0 and 1
            confidence = max(0.0, min(1.0, base_confidence))
            
            # Use OpenAI if available for enhanced scoring
            if self.openai_api_key and confidence < 0.9:
                try:
                    enhanced_confidence = await self._enhance_confidence_with_llm(
                        parsed_segments, canonical_json
                    )
                    if enhanced_confidence:
                        confidence = (confidence + enhanced_confidence) / 2
                except Exception as e:
                    logger.warning(f"Failed to enhance confidence with LLM: {e}")
            
            return confidence
        
        except Exception as e:
            logger.error(f"Error calculating confidence score: {e}")
            return 0.5  # Default to medium confidence on error
    
    async def detect_exceptions(
        self,
        parsed_segments: List[Dict[str, Any]],
        canonical_json: Optional[Dict[str, Any]] = None,
        validation_results: List[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """Detect potential exceptions in the document"""
        exceptions = []
        
        # Check validation errors
        if validation_results:
            for result in validation_results:
                if result.get("type") == "error":
                    exceptions.append({
                        "type": "Validation Error",
                        "severity": result.get("severity", "Medium"),
                        "description": result.get("message", "Validation error detected"),
                        "field_path": result.get("field_path"),
                        "confidence": 0.95
                    })
        
        # Check for missing required segments
        segment_ids = [s.get("segment_id") for s in parsed_segments]
        required_segments = ["ISA", "GS", "ST", "SE", "GE", "IEA"]
        missing = [s for s in required_segments if s not in segment_ids]
        if missing:
            exceptions.append({
                "type": "Mapping Error",
                "severity": "High",
                "description": f"Missing required segments: {', '.join(missing)}",
                "confidence": 0.9
            })
        
        # Check for low confidence fields in canonical JSON
        if canonical_json:
            fields = canonical_json.get("fields", {})
            empty_fields = [k for k, v in fields.items() if not v or v == ""]
            if len(empty_fields) > len(fields) * 0.3:  # More than 30% empty
                exceptions.append({
                    "type": "Data Quality",
                    "severity": "Medium",
                    "description": f"High number of empty fields: {len(empty_fields)}/{len(fields)}",
                    "confidence": 0.75
                })
        
        return exceptions
    
    async def suggest_mapping(
        self,
        source_segments: List[Dict[str, Any]],
        target_schema: Dict[str, Any],
        partner_history: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """Suggest field mappings based on AI analysis"""
        suggestions = []
        
        # Basic mapping suggestions based on field names
        # In production, this would use ML models or LLM
        
        for segment in source_segments:
            segment_id = segment.get("segment_id")
            elements = segment.get("elements", [])
            
            # Suggest mappings based on common patterns
            if segment_id == "BEG":
                if len(elements) > 3:
                    suggestions.append({
                        "source_field": f"{segment_id}.3",
                        "target_field": "purchase_order_number",
                        "confidence": 0.9,
                        "reason": "BEG03 typically contains PO number"
                    })
            
            elif segment_id == "N1":
                if len(elements) > 1:
                    suggestions.append({
                        "source_field": f"{segment_id}.2",
                        "target_field": "customer_name",
                        "confidence": 0.85,
                        "reason": "N102 typically contains name"
                    })
            
            elif segment_id == "IT1":
                if len(elements) > 6:
                    suggestions.append({
                        "source_field": f"{segment_id}.7",
                        "target_field": "product_id",
                        "confidence": 0.9,
                        "reason": "IT107 typically contains product/service ID"
                    })
        
        return suggestions
    
    async def explain_decision(
        self,
        confidence_score: float,
        parsed_segments: List[Dict[str, Any]],
        exceptions: List[Dict[str, Any]]
    ) -> str:
        """Generate explanation for AI decision"""
        explanations = []
        
        if confidence_score >= self.confidence_threshold_high:
            explanations.append(f"High confidence ({confidence_score:.1%}): Document structure is valid and matches expected patterns.")
        elif confidence_score >= self.confidence_threshold_medium:
            explanations.append(f"Medium confidence ({confidence_score:.1%}): Document is mostly valid but requires review.")
        else:
            explanations.append(f"Low confidence ({confidence_score:.1%}): Document has issues that require human review.")
        
        if exceptions:
            explanations.append(f"Found {len(exceptions)} exception(s) that need attention.")
        
        if len(parsed_segments) < 10:
            explanations.append("Document has fewer segments than typical, which may indicate incomplete data.")
        
        return " ".join(explanations)
    
    async def _enhance_confidence_with_llm(
        self,
        parsed_segments: List[Dict[str, Any]],
        canonical_json: Optional[Dict[str, Any]] = None
    ) -> Optional[float]:
        """Enhance confidence score using LLM"""
        try:
            if not self.openai_api_key:
                return None
            
            # Import OpenAI client
            try:
                from openai import OpenAI
                client = OpenAI(api_key=self.openai_api_key)
            except ImportError:
                logger.warning("OpenAI library not installed")
                return None
            
            # Prepare prompt
            segment_summary = f"Document has {len(parsed_segments)} segments"
            if canonical_json:
                segment_summary += f" and {len(canonical_json.get('fields', {}))} mapped fields"
            
            prompt = f"""
            Analyze this EDI document processing result:
            {segment_summary}
            
            Rate the confidence score (0.0 to 1.0) for this document being correctly processed.
            Consider: structure validity, data completeness, and typical EDI patterns.
            
            Return only a number between 0.0 and 1.0.
            """
            
            response = client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are an EDI document analysis expert."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=10,
                temperature=0.3
            )
            
            confidence_str = response.choices[0].message.content.strip()
            confidence = float(confidence_str)
            
            return max(0.0, min(1.0, confidence))
        
        except Exception as e:
            logger.error(f"Error enhancing confidence with LLM: {e}")
            return None


# Global AI service instance
ai_service = AIService()
