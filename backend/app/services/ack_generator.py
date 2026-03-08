"""
ACK Generator Service
Generates 997 (X12) and CONTRL (EDIFACT) functional acknowledgements
Per architecture: Step 4 — Send ACK (997 / CONTRL auto-generated)
"""
from typing import Dict, Any, Optional
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


def generate_997(
    parsed_data: Dict[str, Any],
    accepted: bool = True,
    control_numbers: Optional[Dict[str, str]] = None,
) -> str:
    """
    Generate X12 997 Functional Acknowledgment.
    Confirms receipt and syntax validity of the received transaction set.
    """
    seg = "~"
    elem = "*"
    sub = ":"

    ctrl = control_numbers or {}
    isa_num = ctrl.get("isa_control", "000000001")
    gs_num = ctrl.get("gs_control", "000000001")
    st_num = ctrl.get("st_control", "0001")

    # Get sender/receiver from parsed ISA if available
    segments = parsed_data.get("segments", [])
    isa_data = {}
    for s in segments:
        if s.get("segment_id") == "ISA":
            isa_data = s.get("data", {})
            break

    sender_id = isa_data.get("interchange_sender_id", "SENDER")[:15].ljust(15)
    receiver_id = isa_data.get("interchange_receiver_id", "RECEIVER")[:15].ljust(15)
    qual1 = isa_data.get("interchange_id_qualifier", "ZZ")[:2].ljust(2)
    qual2 = isa_data.get("interchange_id_qualifier_2", "ZZ")[:2].ljust(2)

    today = datetime.utcnow().strftime("%y%m%d")
    now = datetime.utcnow().strftime("%H%M")

    # AK1 (Functional Group Response) - from GS
    gs_data = {}
    for s in segments:
        if s.get("segment_id") == "GS":
            gs_data = s.get("data", {})
            break
    functional_id = gs_data.get("functional_id_code", "PO")[:2].ljust(2)
    gs_control = gs_data.get("group_control_number", gs_num)[:9].ljust(9)

    # AK9 (Functional Group Acknowledge)
    # 1=Accepted, 2=Rejected, 3=Accepted with errors
    ak9_1 = "1" if accepted else "2"
    # Number of transaction sets included
    st_segments = [s for s in segments if s.get("segment_id") == "ST"]
    num_sets = str(len(st_segments) or 1)
    # Number of received transaction sets
    num_received = num_sets
    # Number of accepted transaction sets
    num_accepted = num_sets if accepted else "0"

    # Build 997 segments
    # ISA
    isa = f"ISA{elem}00{elem}          {elem}00{elem}          {elem}{qual1}{elem}{sender_id}{elem}{qual2}{elem}{receiver_id}{elem}{today}{elem}{now}{elem}^{elem}997{elem}{isa_num}{elem}0{elem}P{elem}{sub}"
    # GS
    gs = f"GS{elem}FA{elem}SENDER{elem}RECEIVER{elem}{today}{elem}{now}{elem}{isa_num}{elem}X{elem}004010"
    # ST 997
    st = f"ST{elem}997{elem}{st_num}"
    # AK1
    ak1 = f"AK1{elem}{functional_id}{elem}{gs_control}"
    # AK2 (Transaction Set Response Header) - one per ST in original
    ak2_lines = []
    for st_seg in st_segments:
        st_data = st_seg.get("data", {})
        tx_id = st_data.get("transaction_set_id", "850")[:3].ljust(3)
        tx_ctrl = st_data.get("transaction_set_control_number", st_num)[:9].ljust(9)
        ak2_lines.append(f"AK2{elem}{tx_id}{elem}{tx_ctrl}")
    # AK5 (Transaction Set Response Trailer)
    ak5_1 = "A" if accepted else "R"  # A=Accepted, R=Rejected
    ak5_lines = [f"AK5{elem}{ak5_1}" for _ in ak2_lines]
    # AK9
    ak9 = f"AK9{elem}{ak9_1}{elem}{num_sets}{elem}{num_received}{elem}{num_accepted}"
    # SE
    num_seg = 5 + len(ak2_lines) * 2 + 1  # AK1, AK2s, AK5s, AK9, SE
    se = f"SE{elem}{num_seg}{elem}{st_num}"
    # GE
    ge = f"GE{elem}{num_sets}{elem}{gs_control}"
    # IEA
    iea = f"IEA{elem}1{elem}{isa_num}"

    parts = [isa, gs, st, ak1]
    parts.extend(ak2_lines)
    parts.extend(ak5_lines)
    parts.extend([ak9, se, ge, iea])

    return seg.join(parts)


def generate_contrl(
    parsed_data: Dict[str, Any],
    accepted: bool = True,
) -> str:
    """
    Generate EDIFACT CONTRL (Functional Acknowledgment).
    EDIFACT uses apostrophe (') as segment terminator, + as element separator.
    """
    segments = parsed_data.get("segments", [])
    unb_data = {}
    unh_data = {}
    for s in segments:
        sid = s.get("segment_id", "")
        if sid == "UNB":
            unb_data = s.get("data", {}) or {}
        elif sid == "UNH":
            unh_data = s.get("data", {}) or {}

    # UNB - interchange header (echo back)
    # Simplified CONTRL - real impl would parse UNB/UNH fully
    sep = "+"
    term = "'"

    ref = unb_data.get("reference", "CONTRL001") if isinstance(unb_data.get("reference"), str) else "CONTRL001"
    now = datetime.utcnow().strftime("%y%m%d:%H%M")

    # UCI - Interchange response
    uci_1 = "1" if accepted else "2"  # 1=accepted, 2=rejected
    uci = f"UCI{sep}{ref}{sep}{uci_1}{term}"

    # Minimal CONTRL structure
    unb = f"UNB{sep}UNOC{sep}3{sep}SENDER{sep}RECEIVER{sep}{now}{sep}{ref}{term}"
    unh = f"UNH{sep}1{sep}CONTRL:D:96A:UN{term}"
    uci_seg = uci
    unt = f"UNT{sep}3{sep}1{term}"
    unb_trail = f"UNZ{sep}1{sep}{ref}{term}"

    return unb + unh + uci_seg + unt + unb_trail


def generate_ack(
    parsed_data: Dict[str, Any],
    standard: str,
    accepted: bool = True,
    control_numbers: Optional[Dict[str, str]] = None,
) -> str:
    """
    Generate functional ACK based on detected standard.
    """
    standard = (standard or "X12").upper()
    if standard == "X12":
        return generate_997(parsed_data, accepted=accepted, control_numbers=control_numbers)
    if standard in ("EDIFACT", "EDIF"):
        return generate_contrl(parsed_data, accepted=accepted)
    # JSON/XML: no traditional 997/CONTRL; return empty or HTTP 202 style
    return ""
