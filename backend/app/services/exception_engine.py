"""
Exception Engine
Advanced exception management with rules, escalation, and analytics
"""
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
import logging
from app.core.database import get_database
from app.models.exception import ExceptionCreate

logger = logging.getLogger(__name__)


class ExceptionEngine:
    """Advanced exception management engine"""
    
    def __init__(self):
        self.db = None
    
    async def evaluate_rules(
        self,
        document_id: str,
        partner_id: str,
        parsed_segments: List[Dict[str, Any]],
        canonical_json: Optional[Dict[str, Any]],
        validation_results: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Evaluate exception rules and create exceptions"""
        db = get_database()
        exceptions_created = []
        
        try:
            # Get active exception rules for this partner or global rules
            rules = await db.exception_rules.find({
                "$or": [
                    {"partner_id": partner_id, "is_active": True},
                    {"partner_id": None, "is_active": True}  # Global rules
                ]
            }).to_list(length=100)
            
            for rule in rules:
                # Evaluate rule condition
                if await self._evaluate_condition(rule["condition"], parsed_segments, canonical_json, validation_results):
                    # Rule matched - create exception or take action
                    if rule["action"] == "create_exception":
                        exception = await self._create_exception_from_rule(
                            db, document_id, partner_id, rule
                        )
                        exceptions_created.append(exception)
                    elif rule["action"] == "escalate":
                        # Create exception with escalation
                        exception = await self._create_exception_from_rule(
                            db, document_id, partner_id, rule, escalated=True
                        )
                        exceptions_created.append(exception)
                    elif rule["action"] == "notify":
                        # Create exception and send notification
                        exception = await self._create_exception_from_rule(
                            db, document_id, partner_id, rule
                        )
                        from app.services.slack_service import slack_service
                        await slack_service.notify_exception(
                            exception_type=rule["exception_type"],
                            severity=rule["severity"],
                            description=rule.get("description", "Condition matched"),
                            document_id=document_id,
                            partner_id=partner_id,
                        )
                        exceptions_created.append(exception)
            
            return exceptions_created
        
        except Exception as e:
            logger.error(f"Error evaluating exception rules: {e}")
            return []
    
    async def _evaluate_condition(
        self,
        condition: Dict[str, Any],
        parsed_segments: List[Dict[str, Any]],
        canonical_json: Optional[Dict[str, Any]],
        validation_results: List[Dict[str, Any]]
    ) -> bool:
        """Evaluate rule condition"""
        condition_type = condition.get("type")
        
        if condition_type == "field_missing":
            field_path = condition.get("field_path")
            if canonical_json:
                fields = canonical_json.get("fields", {})
                return field_path not in fields or not fields.get(field_path)
        
        elif condition_type == "field_value":
            field_path = condition.get("field_path")
            expected_value = condition.get("value")
            operator = condition.get("operator", "equals")
            
            if canonical_json:
                actual_value = canonical_json.get("fields", {}).get(field_path)
                
                if operator == "equals":
                    return actual_value == expected_value
                elif operator == "not_equals":
                    return actual_value != expected_value
                elif operator == "contains":
                    return expected_value in str(actual_value)
        
        elif condition_type == "validation_error":
            error_type = condition.get("error_type")
            return any(r.get("type") == "error" and r.get("message", "").lower().contains(error_type.lower()) 
                      for r in validation_results)
        
        elif condition_type == "confidence_threshold":
            threshold = condition.get("threshold", 0.75)
            # This would need confidence score passed in
            return False  # Placeholder
        
        return False
    
    async def _create_exception_from_rule(
        self,
        db,
        document_id: str,
        partner_id: str,
        rule: Dict[str, Any],
        escalated: bool = False
    ) -> Dict[str, Any]:
        """Create exception from rule"""
        exception_data = ExceptionCreate(
            document_id=document_id,
            partner_id=partner_id,
            exception_type=rule["exception_type"],
            severity=rule["severity"],
            description=f"Rule '{rule['name']}': {rule.get('description', 'Condition matched')}",
            tags=["rule-based", rule["name"]],
        )
        
        if escalated:
            exception_data.severity = "Critical"  # Escalate severity
        
        result = await db.exceptions.insert_one(exception_data.model_dump())
        exception = await db.exceptions.find_one({"_id": result.inserted_id})
        exception["_id"] = str(exception["_id"])
        
        return exception
    
    async def check_sla_violations(self, db) -> List[Dict[str, Any]]:
        """Check for SLA violations"""
        # Get exceptions that are open and past SLA
        now = datetime.utcnow()
        sla_hours = {
            "Critical": 1,
            "High": 4,
            "Medium": 24,
            "Low": 72
        }
        
        violations = []
        
        for severity, hours in sla_hours.items():
            threshold = now - timedelta(hours=hours)
            exceptions = await db.exceptions.find({
                "severity": severity,
                "status": {"$in": ["Open", "In Review"]},
                "created_at": {"$lt": threshold}
            }).to_list(length=100)
            
            for exc in exceptions:
                violations.append({
                    "exception_id": str(exc["_id"]),
                    "severity": severity,
                    "sla_hours": hours,
                    "hours_overdue": (now - exc["created_at"]).total_seconds() / 3600
                })
        
        return violations
    
    async def auto_resolve_exceptions(self, db) -> int:
        """Attempt to auto-resolve exceptions based on rules"""
        # Get exceptions with auto-resolve rules
        resolved_count = 0
        
        # This would implement auto-resolution logic
        # For example, if a document is reprocessed successfully, auto-resolve related exceptions
        
        return resolved_count


# Global exception engine
exception_engine = ExceptionEngine()
