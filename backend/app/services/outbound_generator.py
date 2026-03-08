"""
Outbound Generator Service
Generates 850 ACK (855), 856 ASN, 810 Invoice from canonical JSON.
Delegates to edi_generator for actual generation.
"""
from typing import Dict, Any, Optional

from app.services.edi_generator import edi_generator

__all__ = ["generate_850_ack", "generate_856_asn", "generate_810_invoice"]


async def generate_850_ack(
    canonical_json: Dict[str, Any],
    partner: Dict[str, Any],
    standard: str = "X12",
) -> Optional[Dict[str, Any]]:
    """Generate X12 855 (PO Acknowledgment) from canonical. Inbound 850 → Outbound 855."""
    return await edi_generator.generate_reply(
        canonical_json=canonical_json,
        document_type="850",
        partner=partner,
        standard=standard,
    )


async def generate_856_asn(
    canonical_json: Dict[str, Any],
    partner: Dict[str, Any],
    standard: str = "X12",
) -> Optional[Dict[str, Any]]:
    """Generate X12 856 (Advance Ship Notice) from canonical. Inbound 855 → Outbound 856."""
    return await edi_generator.generate_reply(
        canonical_json=canonical_json,
        document_type="855",
        partner=partner,
        standard=standard,
    )


async def generate_810_invoice(
    canonical_json: Dict[str, Any],
    partner: Dict[str, Any],
    standard: str = "X12",
) -> Optional[Dict[str, Any]]:
    """Generate X12 810 (Invoice) from canonical. Inbound 856 → Outbound 810."""
    return await edi_generator.generate_reply(
        canonical_json=canonical_json,
        document_type="856",
        partner=partner,
        standard=standard,
    )
