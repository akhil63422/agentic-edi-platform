"""
Standard Detector Service
Auto-detects EDI standard from raw content: X12, EDIFACT, JSON, XML, SAP IDoc
Per EDI gateway layer 1.docx: SAP IDoc (ORDERS05, ORDRSP, DESADV, INVOIC) support
"""
import re
import json
from typing import Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)

# Standard names per architecture diagram
STANDARD_X12 = "X12"
STANDARD_EDIFACT = "EDIFACT"
STANDARD_JSON = "JSON"
STANDARD_XML = "XML"
STANDARD_IDOC = "SAP_IDOC"


def detect_standard(raw_content: str) -> Dict[str, Any]:
    """
    Detect EDI/format standard from raw content.
    Returns: { "standard": "X12"|"EDIFACT"|"JSON"|"XML"|"SAP_IDOC", "confidence": 0.0-1.0 }
    """
    content = raw_content.strip()
    if not content:
        return {"standard": STANDARD_JSON, "confidence": 0.0}

    # SAP IDoc: XML with IDOC/EDI_DC40/ORDERS05/ORDRSP/DESADV/INVOIC (per EDI gateway doc)
    if content.startswith("<"):
        idoc_patterns = [
            (r"<ORDERS05\b", "ORDERS05"),   # SAP PO (outbound)
            (r"<ORDRSP\b", "ORDRSP"),       # PO Acknowledgment (inbound)
            (r"<DESADV\b", "DESADV"),       # ASN (inbound)
            (r"<INVOIC\b", "INVOIC"),       # Invoice (inbound)
            (r"<IDOC\b", None),
            (r"<EDI_DC40\b", None),
        ]
        for pat, idoc_type in idoc_patterns:
            if re.search(pat, content[:2000], re.I):
                result = {"standard": STANDARD_IDOC, "confidence": 0.95}
                if idoc_type:
                    result["idoc_type"] = idoc_type
                return result
        # Fall through to generic XML
        if re.match(r"<\?xml\s", content, re.I) or re.match(r"<[a-zA-Z][a-zA-Z0-9_-]*[\s>]", content):
            return {"standard": STANDARD_XML, "confidence": 0.95}

    # JSON: starts with { or [
    if content.startswith("{") or content.startswith("["):
        try:
            json.loads(content)
            return {"standard": STANDARD_JSON, "confidence": 1.0}
        except json.JSONDecodeError:
            pass

    # XML: starts with < and has matching tags
    if content.startswith("<"):
        if re.match(r"<\?xml\s", content, re.I) or re.match(r"<[a-zA-Z][a-zA-Z0-9_-]*[\s>]", content):
            return {"standard": STANDARD_XML, "confidence": 0.95}

    # X12: must start with ISA (fixed 106 chars for ISA)
    if content.startswith("ISA"):
        if len(content) >= 106:
            return {"standard": STANDARD_X12, "confidence": 1.0}
        return {"standard": STANDARD_X12, "confidence": 0.8}

    # EDIFACT: UNB (interchange) or UNH (message) at start of segment
    first_line = content.split("\n")[0].strip() if "\n" in content else content[:80]
    if first_line.startswith("UNB") or first_line.startswith("UNH"):
        return {"standard": STANDARD_EDIFACT, "confidence": 1.0}
    if "'" in content and ("UNB+" in content or "UNH+" in content):
        return {"standard": STANDARD_EDIFACT, "confidence": 0.9}

    # Fallback: segment-like with ~ delimiter suggests X12
    if "~" in content and len(content) > 50:
        return {"standard": STANDARD_X12, "confidence": 0.6}

    # Fallback: segment-like with ' suggests EDIFACT
    if "'" in content and "+" in content:
        return {"standard": STANDARD_EDIFACT, "confidence": 0.5}

    return {"standard": STANDARD_JSON, "confidence": 0.0}
