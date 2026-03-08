"""
AI Intelligence Service
Single microservice with 5 agents in Assist Mode per "AI as a controlled architecture layer".
All agents call the same LLM; outputs require human approval before use.
"""
import json
import logging
from typing import Dict, Any, List, Optional

from app.core.config import settings

logger = logging.getLogger(__name__)


class AIIntelligenceService:
    """Single AI service with 5 agents - Assist Mode only."""

    def __init__(self):
        self.api_key = settings.OPENAI_API_KEY
        self.model = settings.AI_MODEL or "gpt-4o-mini"

    def _call_llm(self, system_prompt: str, user_prompt: str, json_mode: bool = False) -> Optional[str]:
        """Call LLM; returns None if no API key or error."""
        if not self.api_key:
            logger.debug("OpenAI API key not set, skipping LLM call")
            return None
        try:
            from openai import OpenAI
            client = OpenAI(api_key=self.api_key)
            kwargs = {
                "model": self.model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                "temperature": 0.3,
                "max_tokens": 2000,
            }
            if json_mode:
                kwargs["response_format"] = {"type": "json_object"}
            response = client.chat.completions.create(**kwargs)
            return response.choices[0].message.content
        except Exception as e:
            logger.error(f"LLM call failed: {e}")
            return None

    async def generate_mapping(
        self,
        source_schema: Dict[str, Any],
        x12_schema: Dict[str, Any],
        document_type: str = "850",
    ) -> Dict[str, Any]:
        """
        Mapping Intelligence Agent: Compare source schema + X12 schema; return structured mapping JSON.
        Engineer approves before storing.
        """
        system = (
            "You are an EDI mapping expert. Given a source schema and X12 EDI schema, "
            "produce a JSON mapping specification. Return only valid JSON with keys: "
            '"field_mappings" (array of {source_field, target_field, transformation?, confidence}), '
            '"notes", "confidence_overall".'
        )
        user = (
            f"Source schema:\n{json.dumps(source_schema, indent=2)}\n\n"
            f"X12 schema for {document_type}:\n{json.dumps(x12_schema, indent=2)}\n\n"
            "Generate the mapping JSON."
        )
        raw = self._call_llm(system, user, json_mode=True)
        if not raw:
            return {"field_mappings": [], "notes": "LLM unavailable", "confidence_overall": 0}
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return {"field_mappings": [], "notes": f"Parse error: {raw[:200]}", "confidence_overall": 0}

    async def analyze_schema(
        self,
        source_schema: Dict[str, Any],
        target_schema: Dict[str, Any],
        document_type: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Schema Understanding Agent: Schema comparison, canonical model suggestions.
        """
        system = (
            "You are an EDI schema expert. Compare source and target schemas. "
            "Return JSON with: schema_comparison (similarities, gaps), canonical_suggestions "
            "(recommended canonical fields), mapping_complexity (low/medium/high), notes."
        )
        user = (
            f"Source:\n{json.dumps(source_schema, indent=2)}\n\n"
            f"Target:\n{json.dumps(target_schema, indent=2)}\n\n"
            f"Document type: {document_type or 'unknown'}\n"
            "Provide analysis JSON."
        )
        raw = self._call_llm(system, user, json_mode=True)
        if not raw:
            return {"schema_comparison": {}, "canonical_suggestions": [], "mapping_complexity": "unknown", "notes": "LLM unavailable"}
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return {"schema_comparison": {}, "canonical_suggestions": [], "mapping_complexity": "unknown", "notes": str(raw)[:200]}

    async def explain_error(
        self,
        error_message: str,
        document_context: Optional[Dict[str, Any]] = None,
        validation_results: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """
        Error Diagnosis Agent: When validation fails, summarize root cause and suggest fix.
        """
        system = (
            "You are an EDI validation expert. Given an error and context, return JSON with: "
            '"root_cause", "suggested_fix", "severity" (Low/Medium/High/Critical), "related_segments".'
        )
        ctx = {}
        if document_context:
            ctx["document"] = document_context
        if validation_results:
            ctx["validation_results"] = validation_results
        user = f"Error: {error_message}\n\nContext:\n{json.dumps(ctx, indent=2)}\n\nProvide diagnosis JSON."
        raw = self._call_llm(system, user, json_mode=True)
        if not raw:
            return {"root_cause": "Unable to analyze", "suggested_fix": "Check logs", "severity": "Medium", "related_segments": []}
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return {"root_cause": error_message, "suggested_fix": "Manual review", "severity": "Medium", "related_segments": []}

    async def summarize_logs(
        self,
        log_entries: List[Dict[str, Any]],
        time_range: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Log Summarization Agent: Daily operational brief, root cause clusters.
        """
        system = (
            "You are an EDI operations analyst. Given log entries, return JSON with: "
            '"summary" (2-3 sentence brief), "root_cause_clusters" (grouped issues), '
            '"critical_issues", "recommendations".'
        )
        user = (
            f"Log entries ({len(log_entries)}):\n{json.dumps(log_entries[:100], indent=2)}\n\n"
            f"Time range: {time_range or 'unspecified'}\n"
            "Provide summary JSON."
        )
        raw = self._call_llm(system, user, json_mode=True)
        if not raw:
            return {"summary": "No analysis", "root_cause_clusters": [], "critical_issues": [], "recommendations": []}
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return {"summary": "Parse error", "root_cause_clusters": [], "critical_issues": [], "recommendations": []}

    async def get_auto_fix_suggestions(
        self,
        parsed_segments: List[Dict[str, Any]],
        validation_results: List[Dict[str, Any]],
        raw_edi: str = "",
    ) -> List[Dict[str, Any]]:
        """
        Auto-fix Agent: Return field-level corrections to apply automatically.
        Each suggestion: {segment_id, field_name, old_value, suggested_value, reason, confidence}
        """
        if not validation_results:
            return []
        system = (
            "You are an EDI validation expert. Given validation errors and parsed segments, "
            "return a JSON array of field-level corrections to auto-apply. "
            'Each item: {"segment_id":"X12 segment","field_name":"label","old_value":"current","suggested_value":"fix","reason":"why","confidence":0.0-1.0}. '
            "Only suggest fixes you are confident about (confidence >= 0.8). "
            "Return ONLY the JSON array, no markdown."
        )
        ctx = {
            "validation_errors": [v.get("message", "") for v in validation_results[:10]],
            "parsed_segments": parsed_segments[:40],
            "raw_edi_preview": (raw_edi or "")[:1200],
        }
        user = f"Context:\n{json.dumps(ctx, default=str)}\n\nProvide corrections JSON array."
        raw = self._call_llm(system, user, json_mode=False)
        if not raw:
            return []
        try:
            import re
            text = raw.strip()
            if text.startswith("```"):
                text = re.sub(r"```[a-z]*\n?", "", text).strip("`").strip()
            out = json.loads(text)
            if isinstance(out, list):
                return out
            if isinstance(out, dict) and "corrections" in out:
                return out["corrections"]
            return []
        except json.JSONDecodeError:
            return []

    async def detect_anomaly(
        self,
        document: Dict[str, Any],
        partner_history: Optional[Dict[str, Any]] = None,
        recent_documents: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """
        Anomaly Detection Agent: Before send - pricing deviation, quantity spikes, risk score.
        """
        system = (
            "You are an EDI anomaly analyst. Given a document and optional history, return JSON with: "
            '"risk_score" (0-1), "anomaly_types" (e.g. pricing_deviation, quantity_spike), '
            '"explanation", "recommendation" (proceed/review/hold).'
        )
        user = (
            f"Document:\n{json.dumps(document, indent=2)}\n\n"
            f"Partner history: {json.dumps(partner_history or {})}\n\n"
            f"Recent docs count: {len(recent_documents or [])}\n"
            "Provide anomaly analysis JSON."
        )
        raw = self._call_llm(system, user, json_mode=True)
        if not raw:
            return {"risk_score": 0.5, "anomaly_types": [], "explanation": "LLM unavailable", "recommendation": "review"}
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return {"risk_score": 0.5, "anomaly_types": [], "explanation": str(raw)[:200], "recommendation": "review"}


ai_intelligence_service = AIIntelligenceService()
