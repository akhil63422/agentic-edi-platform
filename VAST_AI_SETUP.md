# Connect vast.ai GPU to EDI Platform

Run the full AI backend (Qwen 7B, Whisper, LayoutLM) on your vast.ai RTX 3090 instance.

---

## Architecture

| Component | Where | Notes |
|-----------|-------|-------|
| **Frontend** | Netlify / Render | Already deployed |
| **Backend** | vast.ai GPU | Full models (torch, transformers) |
| **MongoDB** | Atlas | Already configured |

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

```bash
# On the vast.ai instance
cd /workspace
git clone https://github.com/akhil63422/agentic-edi-platform.git
cd agentic-edi-platform/backend

python3 -m venv venv
source venv/bin/activate

# Install torch with CUDA first
pip install torch --index-url https://download.pytorch.org/whl/cu121

# Install rest
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

vast.ai maps ports. Check your instance:

- **Direct-connect** instances: Use the public IP (e.g. `74.48.78.46`) and the port shown (often 8001 or a mapped port)
- **Proxy** instances: vast.ai provides a URL like `https://xxx.vast.ai`

Your API URL will be: `http://YOUR_VAST_IP:8001/api/v1`

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
| `Connection refused` | Ensure port 8001 is exposed in vast.ai instance config |
| `CUDA out of memory` | Use smaller models or reduce batch size |
| Models not loading | Set `HUGGINGFACE_API_TOKEN` for gated models |
| MongoDB timeout | Check Atlas Network Access allows `0.0.0.0/0` |
