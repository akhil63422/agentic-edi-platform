# Cloud Database Troubleshooting

When you see **"Error loading partners: timeout of 30000ms exceeded"** or **"Connection refused"** in the cloud, follow these steps.

---

## Full reset (run this first)

On vast.ai, run this to pull latest code, rebuild frontend, restart MongoDB + backend, and seed sample data:

```bash
cd /workspace/agentic-edi-platform
git pull origin main
cd frontend && npm run build && cd ..
chmod +x scripts/start-vast-ai.sh
./scripts/start-vast-ai.sh --seed
```

Use `--seed` to populate sample partners/documents. Omit it if you already have data.

> **Frontend rebuild** is needed after pull so the 60s API timeout and other fixes take effect.

**To run in background:**
```bash
cd /workspace/agentic-edi-platform
git pull origin main
cd frontend && npm run build && cd ..
nohup ./scripts/start-vast-ai.sh --seed > /workspace/backend.log 2>&1 &
```

---

## Quick diagnosis

### 1. Check if backend is reachable

Open in browser (replace with your cloud URL):

```
https://YOUR-TUNNEL-URL/health
```

- **Returns `{"status":"healthy"}`** → Backend is up. Go to step 2.
- **Timeout or connection refused** → Backend not running or wrong URL. See [Backend not reachable](#backend-not-reachable).

### 2. Check MongoDB connectivity

```
https://YOUR-TUNNEL-URL/health?db_check=true
```

- **Returns `"database":"connected"`** → DB is fine. Issue may be network/tunnel latency.
- **Returns `"database":"error"`** → MongoDB problem. See [MongoDB not connected](#mongodb-not-connected).

---

## MongoDB not connected

### vast.ai with local MongoDB

MongoDB does **not** auto-start when the instance restarts. Start it before the backend:

```bash
# Option A: Use the startup script (recommended)
cd /workspace/agentic-edi-platform
chmod +x scripts/start-vast-ai.sh
./scripts/start-vast-ai.sh

# Option B: Manual start
mongod --fork --logpath /tmp/mongod.log --dbpath /workspace/mongodb_data --bind_ip 127.0.0.1
sleep 2
cd backend && uvicorn app.main:app --host 0.0.0.0 --port 8001
```

Verify MongoDB is running:

```bash
pgrep mongod && echo "MongoDB running" || echo "MongoDB NOT running"
```

### MongoDB Atlas (cloud)

If using `MONGODB_URL=mongodb+srv://...`:

1. **Network Access** → Add IP `0.0.0.0/0` (or your vast.ai instance IP)
2. **Database User** → Ensure password is correct in `.env`
3. Check Atlas logs for connection failures

---

## Backend not reachable

### Wrong frontend URL

If the frontend is on **Netlify/Render** and backend on **vast.ai**:

- Set `REACT_APP_BACKEND_URL` or `config.json` → `backendUrl` to your **vast.ai tunnel URL** + `/api/v1`
- Example: `https://xyz.trycloudflare.com/api/v1`

### vast.ai tunnel

1. vast.ai → **Tunnels** → create tunnel for `http://localhost:8001`
2. Copy the `trycloudflare.com` URL
3. Frontend must use this URL (not `localhost`)

### Port not exposed

1. vast.ai instance → **Config** → add port **8001** to exposed ports
2. Rebuild instance if needed

---

## Increase timeout (temporary workaround)

If the DB is slow (e.g. cold start, first request), you can increase the frontend timeout:

**`frontend/src/services/api.js`** – change `timeout: 30000` to `timeout: 60000` (60s).

This only helps if the backend eventually responds; it does not fix DB connection failures.
