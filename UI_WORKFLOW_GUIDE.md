# EDI Platform — UI & Workflow Guide

A quick reference to understand how the UI connects to the backend and how the 10-step pipeline works.

---

## 1. Architecture Overview

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│   FRONTEND      │  HTTP   │   BACKEND API   │  Mongo  │   MONGODB       │
│   (React)       │ ──────► │   (FastAPI)     │ ──────► │   (Database)    │
│   :3000         │         │   :8001         │         │   :27017        │
└─────────────────┘         └─────────────────┘         └─────────────────┘
        │                            │
        │ config.json                │ Workers (Celery/async)
        │ backendUrl                 │ - Document processor
        ▼                            │ - Ingestion
   http://localhost:8001/api/v1      ▼
```

---

## 2. Connection Setup

| Component | URL | Purpose |
|-----------|-----|---------|
| **Frontend** | http://localhost:3000 | React app |
| **Backend API** | http://localhost:8001/api/v1 | REST API |
| **API Docs** | http://localhost:8001/docs | Swagger UI |
| **Config** | `frontend/public/config.json` | `{"backendUrl": "http://localhost:8001/api/v1"}` |

**To connect UI to backend:**
1. Start MongoDB: `docker start edi-mongo`
2. Start backend: `cd backend && uvicorn app.main:app --host 0.0.0.0 --port 8001`
3. Start frontend: `cd frontend && npm run start`
4. Ensure `frontend/public/config.json` has the correct `backendUrl`

---

## 3. Data Flow (UI ↔ Backend)

| UI Action | API Call | Backend |
|-----------|----------|---------|
| Load Dashboard | `GET /documents/?direction=Inbound&limit=1000` | Returns documents from MongoDB |
| Load Activity Table | `GET /documents/?limit=10` | Live EDI activity |
| Upload EDI file | `POST /documents/upload` | Saves file, queues processing |
| View document | `GET /documents/{id}` or `GET /documents/{id}/review` | Document + AI suggestions |
| KPIs | `GET /documents/` + `GET /exceptions/` | Computed from DB |

**Note:** The app uses `forceApi: true` for Dashboard/Activity so it always fetches from the backend, not localStorage.

---

## 4. The 10-Step EDI Pipeline

When you upload an EDI file, it goes through these steps:

| Step | Code | What happens |
|------|------|--------------|
| 1 | **RCV** Receive | File received, dedup hash computed, queued |
| 2 | **DET** Detect | Detects standard (X12, EDIFACT) from ISA/UNB |
| 3 | **PRS** Parse | Splits segments, validates, runs 47 rules |
| 4 | **ACK** Acknowledge | Generates 997 Functional Ack |
| 5 | **XFM** Transform | Maps segments → canonical JSON |
| 6 | **RTE** Route | Evaluates routing rules, selects target |
| 7 | **ERP** Post to ERP | Sends to ERP if configured |
| 8 | **RPL** Generate Reply | Creates reply doc (855 for 850, etc.) |
| 9 | **DLV** Deliver | Stages outbound delivery |
| 10 | **LOG** Log & Monitor | Audit trail, anomaly detection |

**Auto-complete:** The pipeline always finishes as "Completed". If there are validation errors, the AI auto-fixes them and stores `metadata.ai_fixed_errors`.

---

## 5. UI Screens & What They Show

| Screen | Data source | Key features |
|--------|-------------|--------------|
| **Dashboard** | `/documents/`, `/exceptions/` | KPIs, Live EDI Activity table, 10-step flow, upload |
| **Transaction Monitor** | `/documents/?direction=Inbound` | Inbound documents list |
| **Outbound EDI** | `/documents/?direction=Outbound` | Outbound documents |
| **Error Dashboard** | `/exceptions/` | Exceptions list |
| **Document Detail** | `/documents/{id}/review` | Raw EDI, parsed structure, canonical JSON, AI fixes |
| **Processing Modal** | Polls `GET /documents/{id}` | Real-time pipeline progress |

---

## 6. Reply Document Logic

| Inbound | Reply | When "Reply Doc" = NONE |
|---------|-------|--------------------------|
| 850 (PO) | 855 (PO Ack) | — |
| 855 | 856 (ASN) | — |
| 856 | 810 (Invoice) | — |
| **810 (Invoice)** | — | **Expected** — no reply for 810 |

---

## 7. Troubleshooting

| Issue | Check |
|-------|-------|
| UI shows old/empty data | Backend running? `curl http://localhost:8001/health` |
| CORS errors | Backend `CORS_ORIGINS` includes `http://localhost:3000` |
| Config not loading | `frontend/public/config.json` exists and has `backendUrl` |
| WebSocket fails | Backend supports `/api/v1/ws`; check console |
| Upload does nothing | Backend + MongoDB running; check Network tab for 201 |

---

## 8. Quick Start

```bash
# One command (requires Docker)
./scripts/run-local.sh

# Or manually:
docker start edi-mongo
cd backend && source .venv/bin/activate && uvicorn app.main:app --host 0.0.0.0 --port 8001
cd frontend && npm run start
```

Open http://localhost:3000 — the Dashboard should show live data from the backend.
