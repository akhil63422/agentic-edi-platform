# Sample EDI Files

Use these files to test the EDI platform workflow. Upload via the Dashboard or API.

**To clear all demo data:** `cd backend && python clear_demo_data.py`

| File | Type | Description |
|------|------|-------------|
| `sample_850_purchase_order.edi` | X12 850 | Purchase Order from Walmart to Acme |
| `sample_850_with_errors.edi` | X12 850 | **Intentional errors** — missing SE, GE, IEA segments (use to test AI error diagnosis) |
| `sample_810_invoice.edi` | X12 810 | Invoice from Acme to Walmart |
| `sample_856_advance_ship_notice.edi` | X12 856 | Advance Ship Notice (ASN) |
| `sample_edifact_orders.edi` | EDIFACT ORDERS | Purchase Order (EDIFACT format) |

## How to use

1. Open the Dashboard at http://localhost:3000
2. Drag & drop any `.edi` file onto the upload zone, or click to browse
3. The pipeline will auto-detect the standard (X12) and document type
4. Watch the Live EDI Activity table for processing status
