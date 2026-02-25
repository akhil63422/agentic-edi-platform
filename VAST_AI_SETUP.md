# Connect vast.ai GPU to EDI Platform

Run the full AI backend (Qwen 7B, Whisper, LayoutLM) on your vast.ai RTX 3090 instance.

---

## Architecture Options

### Option 1: Full Stack on vast.ai (recommended – no Atlas SSL issues)

| Component | Where | Notes |
|-----------|-------|-------|
| **Frontend** | Netlify / Render | Already deployed |
| **Backend** | vast.ai GPU | Full models |
| **MongoDB** | vast.ai (local) | Installed on instance – no SSL |

### Option 2: Backend + Atlas

| Component | Where | Notes |
|-----------|-------|-------|
| **Frontend** | Netlify / Render | Already deployed |
| **Backend** | vast.ai GPU | Full models |
| **MongoDB** | Atlas | May hit SSL handshake errors on vLLM image |

---

## Full Stack on vast.ai (Proper Way)

Run everything on the instance – MongoDB + Backend. No Atlas SSL issues.

### One-command setup (run in Jupyter Terminal on vast.ai)

```bash
cd /workspace
curl -sSL https://raw.githubusercontent.com/akhil63422/agentic-edi-platform/main/scripts/setup-vast-ai-full.sh | bash
```

Or clone and run locally:

```bash
cd /workspace
git clone https://github.com/akhil63422/agentic-edi-platform.git
cd agentic-edi-platform
chmod +x scripts/setup-vast-ai-full.sh
./scripts/setup-vast-ai-full.sh
```

This script will:

1. Install MongoDB 6.0 locally
2. Clone the repo
3. Install backend deps (`requirements-vast.txt`)
4. Create `.env` with `MONGODB_URL=mongodb://localhost:27017/edi_platform`
5. Seed sample data

### Start the backend

```bash
cd /workspace/agentic-edi-platform/backend
uvicorn app.main:app --host 0.0.0.0 --port 8001
```

### Expose port

1. vast.ai → instance → **Config** → add port **8001**
2. API URL: `http://YOUR_VAST_IP:8001/api/v1`

### Point frontend to backend

In Netlify: **Environment variables** → `REACT_APP_BACKEND_URL` = `http://YOUR_VAST_IP:8001/api/v1` → Redeploy.

### If MongoDB install fails (minimal image)

Some vast.ai images lack `apt` or use different distros. Use an instance with **Ubuntu 22.04** base, or:

1. Start a new instance → choose template **Ubuntu 22.04** (not vLLM Jupyter) if available
2. Or run MongoDB in a separate container and link it

---

## Step 1: Start Your Instance

1. Go to [vast.ai](https://vast.ai) → **Instances**
2. Click **Play** on your RTX 3090 instance
3. Wait until status is **Running**

---

## Step 2: Get SSH Access

1. On the instance card, open the **SSH** tab
2. Copy the SSH command (looks like):
   ```bash
   ssh -p 12345 root@74.48.78.46
   ```
3. Or use vast.ai's **Connect** → **SSH** button

---

## Step 3: Deploy Backend on the Instance

### Option A: Manual Setup (recommended)

**If disk space is limited** (vLLM image already has torch/transformers):

```bash
cd /workspace
git clone https://github.com/akhil63422/agentic-edi-platform.git
cd agentic-edi-platform/backend

# Use system Python - NO venv (saves ~2GB)
pip install --no-cache-dir -r requirements-vast.txt
```

**If you have enough disk** (fresh instance):

```bash
cd /workspace
git clone https://github.com/akhil63422/agentic-edi-platform.git
cd agentic-edi-platform/backend

python3 -m venv venv
source venv/bin/activate
pip install torch --index-url https://download.pytorch.org/whl/cu121
pip install -r requirements.txt
```

### Option B: If Your Instance Uses vLLM Image

The vLLM image has Python and CUDA. You can run our backend alongside:

```bash
# SSH in, then:
cd /workspace
git clone https://github.com/akhil63422/agentic-edi-platform.git
cd agentic-edi-platform/backend
pip install -r requirements.txt  # May need: pip install torch first
# Create .env, then:
uvicorn app.main:app --host 0.0.0.0 --port 8001
```

### Option C: Use Docker (new instance with custom image)

Build and run with the GPU Dockerfile:

```bash
docker build -f backend/Dockerfile.gpu -t edi-gpu-backend ./backend
docker run --gpus all -p 8001:8001 -e MONGODB_URL=... -e CORS_ORIGINS=... edi-gpu-backend
```

---

## Step 4: Configure Environment

Create `backend/.env` on the instance:

```env
MONGODB_URL=mongodb+srv://akhilcopykat_db_user:YOUR_PASSWORD@mongodbsrv.ng98odu.mongodb.net/edi_platform?retryWrites=true&w=majority
CORS_ORIGINS=https://edi-frontend-xzel.onrender.com,https://tranquil-blancmange-af2279.netlify.app,http://localhost:3000
HUGGINGFACE_API_TOKEN=your_hf_token_if_needed
```

---

## Step 5: Run the Backend

```bash
cd /workspace/agentic-edi-platform/backend
source venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8001
```

---

## Step 6: Expose the Port

1. In vast.ai instance → **Config** → ensure port **8001** is in the exposed ports list
2. If you need to add it: **Edit** instance → add `8001` to ports, then **Rebuild**
3. Your API URL: `http://74.48.78.46:8001/api/v1` (use your instance's public IP)

---

## Step 7: Point Frontend to GPU Backend

In **Netlify** (or Render) → **Environment variables**:

| Key | Value |
|-----|-------|
| `REACT_APP_BACKEND_URL` | `http://YOUR_VAST_IP:8001/api/v1` |

Redeploy the frontend.

---

## Models Loaded (when GPU detected)

- **Qwen2.5-7B-Instruct** – Conversational AI for partner setup
- **Whisper-base** – Speech-to-text
- **LayoutLMv3** – Document understanding

First request may take 1–2 minutes while models load into VRAM.

---

## Keep It Running

To run in the background on the instance:

```bash
nohup uvicorn app.main:app --host 0.0.0.0 --port 8001 > /workspace/backend.log 2>&1 &
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| **No space left on device** | See below |
| `Connection refused` | Ensure port 8001 is exposed in vast.ai instance config |
| `CUDA out of memory` | Use smaller models or reduce batch size |
| Models not loading | Set `HUGGINGFACE_API_TOKEN` for gated models |
| MongoDB timeout | Check Atlas Network Access allows `0.0.0.0/0` |

### Fix "No space left on device"

1. **Remove venv and use system Python** (vLLM image has torch already):
   ```bash
   cd /workspace/agentic-edi-platform/backend
   rm -rf venv
   pip cache purge
   pip install --no-cache-dir -r requirements-vast.txt
   ```

2. **Free space**:
   ```bash
   pip cache purge
   rm -rf ~/.cache/huggingface  # if exists
   df -h  # check free space
   ```

3. **Attach a volume** in vast.ai (Instance → Config → add volume) for more disk
