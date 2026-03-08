# EDI Gateway Layer 1 — Gap Fixes

Aligns the platform with `EDI gateway layer 1.docx`.

## Implemented

### 1. SAP IDoc detection
- **standard_detector.py**: Detects SAP IDoc format (ORDERS05, ORDRSP, DESADV, INVOIC, IDOC, EDI_DC40)
- **document_processor.py**: Handles `SAP_IDOC` standard, stores `metadata.idoc_type`
- **Status**: Detection works; full IDoc parsing is a future enhancement

### 2. Inbound/outbound flow alignment
- Inbound: Send 997 before Transform ✓
- Outbound: Send 997 after Transform/Route ✓
- Canonical model used as intermediate ✓

## Future enhancements (per document)

| Gap | Document | Action |
|-----|----------|--------|
| **SAP IDoc parsing** | ORDERS05 → Canonical → X12 850 | Add `idoc_parser.py` to parse IDoc XML to canonical |
| **Oracle XML adapter** | Oracle XML ↔ Canonical | Add `oracle_xml_adapter.py` for Oracle REST/XML |
| **Transport: tRFC, PI/PO, VAN** | SAP/Oracle connectivity | Add adapters when needed |
