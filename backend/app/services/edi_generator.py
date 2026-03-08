"""
EDI Generator Service
Generates outbound EDI documents from canonical JSON using GPT-4o structured output.
Supports X12 850 ACK (855), 856 ASN, 810 Invoice, and EDIFACT equivalents.
"""
import os
import json
import logging
from datetime import datetime
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

# Reply document type map: inbound doc type → outbound reply type
REPLY_MAP = {
    "850": "855",    # PO → PO Acknowledgment
    "X12 850": "855",
    "855": "856",    # PO Ack → ASN (advance ship notice)
    "856": "810",    # ASN → Invoice
    "X12 856": "810",
    "875": "855",    # Sales Order → Acknowledgment
    "X12 875": "855",
    "840": "850",    # PR → PO
    "X12 840": "850",
}

REPLY_NAMES = {
    "855": "Purchase Order Acknowledgment",
    "856": "Advance Ship Notice (ASN)",
    "810": "Invoice",
    "850": "Purchase Order",
    "997": "Functional Acknowledgment",
    "CONTRL": "EDIFACT Control Message",
}


class EDIGenerator:
    """
    Generates outbound EDI documents from canonical JSON.
    Uses GPT-4o when OPENAI_API_KEY is set; falls back to rule-based template generation.
    """

    def __init__(self):
        self.api_key = os.getenv("OPENAI_API_KEY")
        self.model = os.getenv("AI_MODEL", "gpt-4o")

    def _get_reply_type(self, inbound_document_type: str) -> Optional[str]:
        """Determine the appropriate reply transaction set for an inbound document."""
        normalized = inbound_document_type.strip().upper()
        for k, v in REPLY_MAP.items():
            if k.upper() in normalized or normalized in k.upper():
                return v
        return None

    async def generate_reply(
        self,
        canonical_json: Dict[str, Any],
        document_type: str,
        partner: Dict[str, Any],
        standard: str = "X12",
    ) -> Optional[Dict[str, Any]]:
        """
        Generate an outbound reply EDI document from canonical JSON.

        Args:
            canonical_json: Canonical representation of the inbound document.
            document_type: The inbound document type (e.g. "850", "X12 850").
            partner: Partner document from MongoDB.
            standard: "X12" or "EDIFACT".

        Returns:
            Dict with keys: reply_type, reply_name, edi_content, canonical_reply, standard
        """
        reply_type = self._get_reply_type(document_type)
        if not reply_type:
            logger.info(f"No reply type defined for document type: {document_type}")
            return None

        reply_name = REPLY_NAMES.get(reply_type, f"Reply {reply_type}")
        partner_code = partner.get("partner_code", "PARTNER")
        isa_sender = partner.get("edi_config", {}).get("isa_receiver_id", "SENDER001")
        isa_receiver = partner.get("edi_config", {}).get("isa_sender_id", "RECEIVER01")

        try:
            if self.api_key:
                result = await self._generate_with_llm(
                    canonical_json, document_type, reply_type, reply_name,
                    partner_code, isa_sender, isa_receiver, standard,
                )
                if result:
                    return result
        except Exception as e:
            logger.warning(f"LLM EDI generation failed, falling back to template: {e}")

        return self._generate_with_template(
            canonical_json, document_type, reply_type, reply_name,
            partner_code, isa_sender, isa_receiver, standard,
        )

    async def _generate_with_llm(
        self,
        canonical_json: Dict[str, Any],
        inbound_type: str,
        reply_type: str,
        reply_name: str,
        partner_code: str,
        isa_sender: str,
        isa_receiver: str,
        standard: str,
    ) -> Optional[Dict[str, Any]]:
        """Generate outbound EDI using GPT-4o structured output."""
        try:
            from openai import AsyncOpenAI
        except ImportError:
            logger.warning("OpenAI library not installed, cannot use LLM for EDI generation")
            return None

        client = AsyncOpenAI(api_key=self.api_key)
        ts = datetime.utcnow()
        ctrl_num = ts.strftime("%05d")
        date_str = ts.strftime("%y%m%d")
        time_str = ts.strftime("%H%M")

        system_prompt = (
            "You are an expert EDI (Electronic Data Interchange) document generator. "
            "Generate syntactically correct, production-quality EDI documents. "
            "For X12: use segment delimiter '~', element delimiter '*', sub-element delimiter ':'. "
            "Always include proper ISA/GS/ST/SE/GE/IEA envelope segments. "
            "Respond ONLY with a JSON object matching the requested schema — no markdown, no explanation."
        )

        user_prompt = f"""Generate an outbound X12 {reply_type} ({reply_name}) EDI document.

Inbound document type: {inbound_type}
Standard: {standard}
Partner code: {partner_code}
ISA Sender ID: {isa_sender}
ISA Receiver ID: {isa_receiver}
Date: {ts.strftime('%Y-%m-%d')}  Time: {ts.strftime('%H:%M')} UTC
Control number: {ctrl_num}

Canonical data from inbound document:
{json.dumps(canonical_json, indent=2, default=str)}

Respond with this exact JSON structure:
{{
  "edi_content": "<full EDI string with ~ segment terminators>",
  "canonical_reply": {{
    "document_type": "{reply_type}",
    "fields": {{}}
  }},
  "generation_notes": "<brief explanation>"
}}

Rules:
- Use real EDI segment codes for {reply_type}
- Extract relevant values from the canonical data provided
- All required envelope segments must be present
- Keep line items consistent with the inbound document
- Use today's date ({ts.strftime('%Y%m%d')}) and time ({ts.strftime('%H%M')})"""

        response = await client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            response_format={"type": "json_object"},
            max_tokens=2000,
            temperature=0.2,
        )

        raw = response.choices[0].message.content.strip()
        parsed = json.loads(raw)

        return {
            "reply_type": reply_type,
            "reply_name": reply_name,
            "edi_content": parsed.get("edi_content", ""),
            "canonical_reply": parsed.get("canonical_reply", {"document_type": reply_type, "fields": {}}),
            "standard": standard,
            "generated_by": "gpt-4o",
            "generation_notes": parsed.get("generation_notes", ""),
            "generated_at": ts.isoformat(),
        }

    def _generate_with_template(
        self,
        canonical_json: Dict[str, Any],
        inbound_type: str,
        reply_type: str,
        reply_name: str,
        partner_code: str,
        isa_sender: str,
        isa_receiver: str,
        standard: str,
    ) -> Dict[str, Any]:
        """Rule-based template fallback for common reply types."""
        ts = datetime.utcnow()
        ctrl = ts.strftime("%05d")
        date6 = ts.strftime("%y%m%d")
        date8 = ts.strftime("%Y%m%d")
        time4 = ts.strftime("%H%M")
        fields = canonical_json.get("fields", {})
        po_num = fields.get("purchase_order_number", fields.get("order_number", "PO-UNKNOWN"))

        edi_content = ""

        if reply_type == "855":
            # PO Acknowledgment
            edi_content = (
                f"ISA*00*          *00*          *ZZ*{isa_sender:<15}*ZZ*{isa_receiver:<15}"
                f"*{date6}*{time4}*^*00501*{ctrl}*0*P*:~"
                f"GS*PR*{isa_sender.strip()}*{isa_receiver.strip()}*{date8}*{time4}*{ctrl}*X*005010~"
                f"ST*855*0001~"
                f"BAK*00*AC*{po_num}*{date8}~"
                f"PO1*1*1*EA*0**IN*001~"
                f"CTT*1~"
                f"SE*5*0001~"
                f"GE*1*{ctrl}~"
                f"IEA*1*{ctrl}~"
            )
            canonical_reply = {
                "document_type": "855",
                "fields": {
                    "purchase_order_number": po_num,
                    "acknowledgment_type": "AC",
                    "acknowledgment_date": date8,
                    "status": "Accepted",
                },
            }

        elif reply_type == "856":
            # Advance Ship Notice
            shipment_id = fields.get("shipment_id", f"SHIP-{ctrl}")
            edi_content = (
                f"ISA*00*          *00*          *ZZ*{isa_sender:<15}*ZZ*{isa_receiver:<15}"
                f"*{date6}*{time4}*^*00501*{ctrl}*0*P*:~"
                f"GS*SH*{isa_sender.strip()}*{isa_receiver.strip()}*{date8}*{time4}*{ctrl}*X*005010~"
                f"ST*856*0001~"
                f"BSN*00*{shipment_id}*{date8}*{time4}~"
                f"HL*1**S~"
                f"TD1*CTN*1~"
                f"TD5**2*FDXG~"
                f"REF*BM*{po_num}~"
                f"HL*2*1*O~"
                f"PRF*{po_num}~"
                f"HL*3*2*I~"
                f"LIN*1*IN*ITEM001~"
                f"SN1*1*1*EA~"
                f"CTT*3~"
                f"SE*12*0001~"
                f"GE*1*{ctrl}~"
                f"IEA*1*{ctrl}~"
            )
            canonical_reply = {
                "document_type": "856",
                "fields": {
                    "purchase_order_number": po_num,
                    "shipment_id": shipment_id,
                    "ship_date": date8,
                    "status": "Shipped",
                },
            }

        elif reply_type == "810":
            # Invoice
            invoice_num = f"INV-{ctrl}"
            total = fields.get("total_amount", fields.get("totalDue", "0.00"))
            edi_content = (
                f"ISA*00*          *00*          *ZZ*{isa_sender:<15}*ZZ*{isa_receiver:<15}"
                f"*{date6}*{time4}*^*00501*{ctrl}*0*P*:~"
                f"GS*IN*{isa_sender.strip()}*{isa_receiver.strip()}*{date8}*{time4}*{ctrl}*X*005010~"
                f"ST*810*0001~"
                f"BIG*{date8}*{invoice_num}*{date8}*{po_num}~"
                f"REF*DP*001~"
                f"N1*SE*{partner_code}~"
                f"IT1*1*1*EA*{total}**IN*ITEM001~"
                f"TDS*{str(total).replace('.','').replace('-','')}~"
                f"CTT*1~"
                f"SE*9*0001~"
                f"GE*1*{ctrl}~"
                f"IEA*1*{ctrl}~"
            )
            canonical_reply = {
                "document_type": "810",
                "fields": {
                    "invoice_number": invoice_num,
                    "invoice_date": date8,
                    "purchase_order_number": po_num,
                    "total_due": str(total),
                },
            }

        else:
            # Generic 997 FA as safe fallback
            edi_content = (
                f"ISA*00*          *00*          *ZZ*{isa_sender:<15}*ZZ*{isa_receiver:<15}"
                f"*{date6}*{time4}*^*00501*{ctrl}*0*P*:~"
                f"GS*FA*{isa_sender.strip()}*{isa_receiver.strip()}*{date8}*{time4}*{ctrl}*X*005010~"
                f"ST*997*0001~"
                f"AK1*{inbound_type.replace('X12 ', '').replace('EDIFACT ', '')}*{ctrl}~"
                f"AK9*A*1*1*1~"
                f"SE*4*0001~"
                f"GE*1*{ctrl}~"
                f"IEA*1*{ctrl}~"
            )
            canonical_reply = {"document_type": "997", "fields": {"status": "Accepted"}}

        return {
            "reply_type": reply_type,
            "reply_name": reply_name,
            "edi_content": edi_content,
            "canonical_reply": canonical_reply,
            "standard": standard,
            "generated_by": "template",
            "generated_at": ts.isoformat(),
        }


edi_generator = EDIGenerator()
