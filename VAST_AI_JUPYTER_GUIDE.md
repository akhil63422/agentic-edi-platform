# vast.ai Setup – Jupyter Terminal (From Scratch)

Run these commands **in order** in the **Jupyter Terminal** on your vast.ai instance.

---

## Step 1: Open Jupyter Terminal

1. vast.ai → your instance → **Connect** → **Jupyter**
2. In Jupyter: **New** → **Terminal**
3. You should see a shell prompt like `root@C.XXXXX:~$`

---

## Step 2: Run Full Setup (One Command)

Copy and paste this entire block:

```bash
cd /workspace
git clone https://github.com/akhil63422/agentic-edi-platform.git
cd agentic-edi-platform
chmod +x scripts/setup-vast-ai-full.sh
./scripts/setup-vast-ai-full.sh
```

This will:
- Install MongoDB 6.0
- Clone the repo
- Install backend Python deps
- Build the frontend
- Seed sample data

**Wait for it to finish** (about 5–10 minutes).

---

## Step 3: Start the Backend

```bash
cd /workspace/agentic-edi-platform/backend
uvicorn app.main:app --host 0.0.0.0 --port 8001
```

Leave this running. You should see:
- `Connected to MongoDB`
- `Uvicorn running on http://0.0.0.0:8001`

---

## Step 4: Create Tunnel

1. In vast.ai → your instance → **Tunnels**
2. In **Enter target URL**, type: `http://localhost:8001`
3. Click **+ Create New Tunnel**
4. Copy the `https://xxxxx.trycloudflare.com` URL

---

## Step 5: Use the App

Open the tunnel URL in your browser. You get:
- **App** at `/` (Dashboard, Partners, Documents, etc.)
- **API** at `/api/v1`
- **Docs** at `/docs`

---

## If Setup Script Fails – Manual Steps

### 1. Install MongoDB

```bash
export DEBIAN_FRONTEND=noninteractive
apt-get update && apt-get install -y gnupg curl
curl -fsSL https://www.mongodb.org/static/pgp/server-6.0.asc | gpg -o /usr/share/keyrings/mongodb-server-6.0.gpg --dearmor
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-6.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/6.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-6.0.list
apt-get update && apt-get install -y mongodb-org
mkdir -p /tmp/mongodb_data
mongod --fork --logpath /tmp/mongod.log --dbpath /tmp/mongodb_data
sleep 2
```

### 2. Clone & Install Backend

```bash
cd /workspace
git clone https://github.com/akhil63422/agentic-edi-platform.git
cd agentic-edi-platform/backend
pip install --no-cache-dir -r requirements-vast.txt
```

### 3. Create .env

```bash
cat > .env << 'EOF'
MONGODB_URL=mongodb://localhost:27017/edi_platform
CORS_ORIGINS=http://localhost:3000,https://tranquil-blancmange-af2279.netlify.app
SERVE_FRONTEND=true
EOF
```

### 4. Build Frontend

```bash
cd /workspace/agentic-edi-platform/frontend
echo '{"backendUrl":"/api/v1"}' > public/config.json
npm install --legacy-peer-deps
npm run build
```

### 5. Seed Data

```bash
cd /workspace/agentic-edi-platform/backend
python populate_sample_data.py
```

### 6. Start Backend

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8001
```

---

## Restart After Instance Reboot

If the instance restarts, run:

```bash
# Start MongoDB
mongod --fork --logpath /tmp/mongod.log --dbpath /tmp/mongodb_data

# Start backend
cd /workspace/agentic-edi-platform/backend
uvicorn app.main:app --host 0.0.0.0 --port 8001
```

Then create a **new tunnel** (old URLs expire).

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `apt-get` not found | Use an Ubuntu-based instance |
| `No space left` | Use `requirements-vast.txt` (no torch), or add more storage |
| MongoDB install fails | Try `apt-get install -y mongodb` (older package) |
| Tunnel URL not loading | Create a new tunnel; old URLs expire |
| Frontend blank | Ensure `SERVE_FRONTEND=true` in backend `.env` |
