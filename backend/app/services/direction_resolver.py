"""
Direction Resolver Service
Determines Inbound/Outbound from ISA/UNB sender/receiver vs platform identity.
"""
import logging
from typing import List, Any, Optional, Tuple

logger = logging.getLogger(__name__)


def _normalize_id(value: Optional[str]) -> str:
    """Normalize ID for comparison: strip whitespace, uppercase."""
    if not value:
        return ""
    return (value or "").strip().upper()


def _extract_x12_sender_receiver(parsed_segments: List[dict]) -> Tuple[str, str]:
    """Extract sender and receiver from X12 ISA segment."""
    sender, receiver = "", ""
    for seg in parsed_segments:
        if seg.get("segment_id") != "ISA":
            continue
        data = seg.get("data")
        if data:
            sender = (data.get("interchange_sender_id") or "").strip()
            receiver = (data.get("interchange_receiver_id") or "").strip()
            break
        elements = seg.get("elements") or []
        if len(elements) >= 8:
            sender = (elements[5] or "").strip()
            receiver = (elements[7] or "").strip()
            break
    return sender, receiver


def _extract_edifact_sender_receiver(parsed_segments: List[dict]) -> Tuple[str, str]:
    """Extract sender and receiver from EDIFACT UNB segment.
    UNB format: UNB+UNOA:2+SENDER+RECEIVER+...
    """
    sender, receiver = "", ""
    for seg in parsed_segments:
        if seg.get("segment_id") != "UNB":
            continue
        elements = seg.get("elements") or []
        if len(elements) >= 3:
            sender = (elements[1] or "").strip()
            receiver = (elements[2] or "").strip()
            break
    return sender, receiver


def resolve_direction(
    parsed_data: dict,
    our_company_id: Optional[str],
    fallback: str = "Inbound",
) -> Tuple[str, str, str]:
    """
    Resolve direction from parsed EDI segments.

    Returns (direction, source_system, target_system).
    - Inbound: document sent TO us (receiver == our_id)
    - Outbound: document sent FROM us (sender == our_id)
    - Unknown/fallback: when our_id not set or no match

    Args:
        parsed_data: Output from parse_edi() with "segments" and optionally "standard"
        our_company_id: Platform ISA ID (from settings or env)
        fallback: Direction when our_id not set or ambiguous
    """
    segments = parsed_data.get("segments") or []
    standard = (parsed_data.get("standard") or "X12").upper()

    if standard == "EDIFACT":
        sender, receiver = _extract_edifact_sender_receiver(segments)
    else:
        sender, receiver = _extract_x12_sender_receiver(segments)

    source_system = sender or ""
    target_system = receiver or ""

    our_id = _normalize_id(our_company_id)
    if not our_id:
        logger.warning(
            "Platform our_company_isa_id not set; direction defaulting to %s",
            fallback,
        )
        return fallback, source_system, target_system

    sender_norm = _normalize_id(sender)
    receiver_norm = _normalize_id(receiver)

    if receiver_norm == our_id:
        return "Inbound", source_system, target_system
    if sender_norm == our_id:
        return "Outbound", source_system, target_system

    # Both differ from our_id - default to Inbound (document received from external)
    return fallback, source_system, target_system
