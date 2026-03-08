"""
Rule-based canonical JSON builder from X12 parsed segments.
Used by document processor and generate-canonical API.
"""
from typing import Dict, Any, List


def rule_based_canonical(parsed_segments: list, doc_type: str) -> dict:
    """
    Build a canonical business JSON from X12 parsed segments without AI.
    Handles 850 (PO), 855 (POA), 856 (ASN), 810 (Invoice).
    """
    seg_map: Dict[str, Any] = {}
    for s in parsed_segments:
        sid = s.get("segment_id", "")
        data = s.get("data") or {}
        elements = s.get("elements", [])
        if sid not in seg_map:
            seg_map[sid] = []
        seg_map[sid].append({"data": data, "elements": elements})

    # ─── Parties ───────────────────────────────────────────────────────────
    parties = []
    for entry in seg_map.get("N1", []):
        d = entry["data"]
        parties.append({
            "qualifier": d.get("entity_identifier_code", ""),
            "name": d.get("name", ""),
            "id_qualifier": d.get("identification_code_qualifier", ""),
            "id": d.get("identification_code", ""),
        })

    # ─── Line items ────────────────────────────────────────────────────────
    line_items = []
    for entry in seg_map.get("PO1", []) + seg_map.get("IT1", []):
        d = entry.get("data") or {}
        els = entry.get("elements") or []
        line_items.append({
            "line_number": d.get("assigned_identification") or (els[0] if els else ""),
            "quantity": d.get("quantity_ordered") or d.get("quantity_invoiced") or (els[1] if len(els) > 1 else ""),
            "unit": d.get("unit_or_basis_for_measurement_code") or (els[2] if len(els) > 2 else ""),
            "unit_price": d.get("unit_price") or (els[3] if len(els) > 3 else ""),
            "product_id": d.get("product_service_id") or (els[6] if len(els) > 6 else ""),
        })

    # ─── Build by doc type ─────────────────────────────────────────────────
    beg = (seg_map.get("BEG") or [{}])[0].get("data", {})
    st = (seg_map.get("ST") or [{}])[0].get("data", {})
    gs = (seg_map.get("GS") or [{}])[0].get("data", {})
    ctt = (seg_map.get("CTT") or [{}])[0].get("data", {})
    amt = (seg_map.get("AMT") or [{}])[0].get("data", {})
    cur = (seg_map.get("CUR") or [{}])
    cur_entry = cur[0] if cur else {}
    currency = cur_entry.get("data", {}).get("currency_code") or (cur_entry.get("elements") or ["", "USD"])[1] if cur_entry else "USD"

    canonical = {
        "document_type": doc_type or st.get("transaction_set_id", ""),
        "control_number": beg.get("purchase_order_number") or beg.get("invoice_number") or "",
        "date": beg.get("date") or gs.get("date") or "",
        "currency": currency,
        "sender": gs.get("application_sender_code", ""),
        "receiver": gs.get("application_receiver_code", ""),
        "parties": parties,
        "line_items": line_items,
        "total_line_items": (ctt or {}).get("number_of_line_items") or len(line_items),
        "total_amount": amt.get("amount") or "",
    }

    tx = (doc_type or "").replace("X12 ", "").replace("EDIFACT ", "").strip()
    if tx == "850":
        canonical["purchase_order"] = {
            "po_number": beg.get("purchase_order_number", ""),
            "po_type": beg.get("purchase_order_type_code", ""),
            "purpose": beg.get("transaction_set_purpose_code", ""),
            "date": beg.get("date", ""),
            "buyer": next((p for p in parties if p["qualifier"] == "BY"), {}),
            "ship_to": next((p for p in parties if p["qualifier"] == "ST"), {}),
            "seller": next((p for p in parties if p["qualifier"] == "SE"), {}),
            "line_items": line_items,
            "total_amount": canonical["total_amount"],
            "currency": currency,
        }
    elif tx == "810":
        canonical["invoice"] = {
            "invoice_number": canonical["control_number"],
            "invoice_date": canonical["date"],
            "bill_to": next((p for p in parties if p["qualifier"] == "BT"), {}),
            "line_items": line_items,
            "total_amount": canonical["total_amount"],
        }
    elif tx == "856":
        canonical["shipment"] = {
            "shipment_id": canonical["control_number"],
            "ship_date": canonical["date"],
            "ship_to": next((p for p in parties if p["qualifier"] == "ST"), {}),
            "line_items": line_items,
        }
    return canonical
