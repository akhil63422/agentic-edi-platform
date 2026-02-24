# Render Deployment Guide

Step-by-step guide to fix and deploy the EDI Platform on Render.

---

## Why Deployments Fail

| Issue | Cause | Fix |
|-------|-------|-----|
| **Backend build timeout** | `torch`, `transformers`, `librosa` (~2GB+) | Use `requirements-render.txt` (slim) |
| **Frontend npm ERESOLVE** | Peer deps (date-fns, React 19) | `.npmrc` with `legacy-peer-deps=true` ✓ |
| **CORS errors** | Frontend URL not allowed | Set `CORS_ORIGINS` on backend |
| **API 404** | Wrong backend URL | Set `REACT_APP_BACKEND_URL` on frontend |

---

## 1. Deploy Backend (Web Service)

### Option A: Manual Setup

1. Go to [dashboard.render.com](https://dashboard.render.com) → **New +** → **Web Service**
2. Connect **GitHub** → select `akhil63422/agentic-edi-platform`
3. Configure:
   - **Name:** `edi-backend`
   - **Branch:** `main`
   - **Root Directory:** `backend`
   - **Runtime:** `Python 3`
   - **Build Command:** `pip install -r requirements-render.txt`
   - **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. **Environment Variables** → Add:
   | Key | Value |
   |-----|-------|
   | `MONGODB_URL` | `mongodb+srv://USER:PASS@cluster.mongodb.net/edi_platform?retryWrites=true&w=majority` |
5. Click **Create Web Service**
6. Wait for deploy. Copy the URL (e.g. `https://edi-backend-xxxx.onrender.com`)

### Option B: Blueprint

1. **New +** → **Blueprint**
2. Connect repo → Render reads `render.yaml`
3. Add `MONGODB_URL` and `CORS_ORIGINS` when prompted (or in Dashboard → Environment)

---

## 2. Deploy Frontend (Static Site)

1. **New +** → **Static Site**
2. Connect same repo
3. Configure:
   - **Name:** `edi-frontend`
   - **Branch:** `main`
   - **Root Directory:** `frontend`
   - **Build Command:** `npm install && npm run build`
   - **Publish Directory:** `build`
4. **Environment Variables** → Add:
   | Key | Value |
   |-----|-------|
   | `REACT_APP_BACKEND_URL` | `https://edi-backend-xxxx.onrender.com/api/v1` |
5. Click **Create Static Site**
6. Copy the frontend URL (e.g. `https://edi-frontend-xxxx.onrender.com`)

---

## 3. Fix CORS (Backend)

1. Open **edi-backend** in Render Dashboard
2. **Environment** → Add:
   | Key | Value |
   |-----|-------|
   | `CORS_ORIGINS` | `https://edi-frontend-xxxx.onrender.com` |
3. **Save Changes** → Redeploy

---

## 4. MongoDB Atlas

1. [cloud.mongodb.com](https://cloud.mongodb.com) → **Network Access**
2. **Add IP Address** → **Allow Access from Anywhere** (`0.0.0.0/0`)
3. Ensure DB user has access to `edi_platform` database

---

## 5. Verify

- Frontend: `https://edi-frontend-xxxx.onrender.com`
- Backend health: `https://edi-backend-xxxx.onrender.com/docs`
- Test Dashboard, Trading Partners, Playground

---

## Troubleshooting

### Backend build fails with "No module named X"
- Ensure **Build Command** uses `requirements-render.txt` (not `requirements.txt`)

### Frontend build fails with ERESOLVE
- Ensure `frontend/.npmrc` exists with `legacy-peer-deps=true` and is committed

### CORS / Network errors in browser
- Add frontend URL to `CORS_ORIGINS` on backend (comma-separated for multiple)
- Redeploy backend after changing env vars

### Backend sleeps (free tier)
- First request after ~15 min idle may take 30–60s to wake up
