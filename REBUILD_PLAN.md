# Agent Eddy Platform — Rebuild Plan

> Align the application with the architecture defined in `myedi-platform-diagram.html`

---

## Architecture Overview (from Diagram)

### Swimlanes
1. **Trading Partners** — Suppliers, Buyers, 3PL, Banks, Gov/Customs, Healthcare
2. **Transport** — AS2, SFTP/FTP, REST/SOAP, MQ/Kafka, SMTP, VAN, AS4/ebMS3
3. **Platform Core** — Agent Eddy (Experience, Process, Connector, Platform Services)
4. **EDI Standards** — X12, EDIFACT, JSON, XML — Transaction sets 840, 850, 855/865, 856, 810, 875/870, 997
5. **Backend/ERP** — Oracle, SAP, Salesforce, WMS, AP/Payments, Analytics, Healthcare, Data Warehouse

---

## 10-Step End-to-End Processing Flow (Target)

| Step | Name | Description | Current Status |
|------|------|-------------|----------------|
| 1 | **Receive** | AS2 / SFTP / REST | ✅ SFTP, S3, REST exist |
| 2 | **Detect Standard** | X12 / EDIFACT / JSON / XML | ⚠️ Partner config only |
| 3 | **Parse & Validate** | Syntax + Business rules | ✅ Parser exists |
| 4 | **Send ACK** | 997 / CONTRL auto-generated | ❌ Missing |
| 5 | **Transform** | Map to internal canonical model | ✅ Mapping exists |
| 6 | **Route** | Business rules → target system | ⚠️ Basic |
| 7 | **Post to ERP** | Oracle / SAP / OMS / WMS | ✅ ERP service exists |
| 8 | **Generate Reply** | 850 ACK / ASN / Invoice out | ⚠️ Partial |
| 9 | **Deliver** | Outbound via AS2 / SFTP | ✅ Transport exists |
| 10 | **Log & Monitor** | Audit trail / Dashboard alert | ✅ Audit + WebSocket |

---

## Platform Layers (Target)

### Experience Layer
| Component | Current | Action |
|----------|--------|--------|
| Partner Portal | Trading Partners | ✅ |
| Transaction Monitor | Inbound/Outbound EDI | ✅ |
| Error Dashboard | Exceptions | ✅ |
| Onboarding Wizard | AddTradingPartnerWizard | ✅ |
| Audit Trail UI | Audit Logs | ✅ |
| SLA Dashboard | Analytics | ⚠️ Enhance |

### Process Layer
| Component | Current | Action |
|----------|--------|--------|
| Parse & Validate | edi_parser | ✅ |
| Transform Engine | document_processor | ✅ |
| Business Rules | exception_engine | ✅ |
| ACK Generator | — | ❌ Add |
| Smart Routing | — | ❌ Add |
| Error Recovery | exception_engine | ✅ |
| De-duplication | — | ❌ Add |
| Retry Logic | — | ❌ Add |

### Connector Layer
| Connector | Current | Action |
|-----------|---------|--------|
| Oracle Connector | erp_service | ✅ Placeholder |
| SAP Connector | erp_service | ✅ Placeholder |
| Salesforce Conn | — | ❌ Add |
| REST / SOAP | erp_service | ✅ |
| DB Connector | erp_service | ✅ |
| Kafka Connector | — | ⚠️ Future |
| RabbitMQ Conn | — | ⚠️ Future |

### Platform Services
| Service | Current | Action |
|---------|---------|--------|
| API Gateway | FastAPI | ✅ |
| Auth / OAuth2 | security.py | ✅ |
| Secrets Vault | — | ⚠️ Future |
| Object Store | S3 | ✅ |
| Scheduler | — | ⚠️ Future |
| Rate Limiter | middleware | ✅ |
| Logging & Tracing | logging | ✅ |

---

## Transaction Sets (Target)

| Code | Name | Status |
|------|------|--------|
| 840 | Purchase Requisition | ⚠️ Add parsing |
| 850 | Purchase Order | ✅ |
| 855/865 | PO Acknowledgement | ⚠️ Add parsing |
| 856 | Ship Notice (ASN) | ⚠️ Add parsing |
| 810 | Invoice | ✅ |
| 875/870 | Sales Order | ⚠️ Add parsing |
| 997 | Functional ACK | ❌ Add generation |
| EDIFACT | ORDERS, ORDRSP, DESADV, INVOIC, CONTRL | ⚠️ Basic |
| JSON/XML | — | ❌ Add |
| cXML | — | ⚠️ Future |

---

## Implementation Phases

### Phase 1: Core Processing Pipeline (10-Step Flow)
- [ ] `ack_generator.py` — 997/CONTRL generation
- [ ] `standard_detector.py` — Auto-detect X12/EDIFACT/JSON/XML
- [ ] Refactor `document_processor.py` to strict 10-step flow
- [ ] Add `processing_step` tracking on document model

### Phase 2: Process Layer Enhancements
- [ ] `deduplication.py` — Check for duplicate document IDs
- [ ] `retry_logic.py` — Retry failed steps with backoff
- [ ] `routing_engine.py` — Business rules for target system routing

### Phase 3: JSON/XML Support
- [ ] Extend `edi_parser.py` for JSON/XML
- [ ] Add JSON/XML validation

### Phase 4: Frontend Alignment
- [ ] Rename nav to match Experience Layer: Partner Portal, Transaction Monitor, Error Dashboard
- [ ] Add SLA Dashboard section or enhance Analytics
- [ ] Add 10-step flow visualization to Dashboard

### Phase 5: Transport & Connectors
- [ ] AS2 connector (or integration stub)
- [ ] Salesforce connector in ERP service

---

## File Changes Summary

| File | Action |
|------|--------|
| `backend/app/services/ack_generator.py` | Create |
| `backend/app/services/standard_detector.py` | Create |
| `backend/app/services/deduplication.py` | Create |
| `backend/app/workers/document_processor.py` | Refactor |
| `backend/app/services/edi_parser.py` | Extend (JSON/XML) |
| `backend/app/models/document.py` | Add `processing_step` |
| `frontend/src/components/Layout.jsx` | Update nav labels |
| `frontend/src/components/FlowVisualization.jsx` | Update to 10-step flow |

---

## Quick Start

1. Run `pip install -r backend/requirements.txt`
2. `cd backend && uvicorn app.main:app --reload`
3. `cd frontend && npm start`
