# vast.ai Dependencies for EDI Platform

## Required for Backend + Partner AI

### 1. Python packages (from `requirements-vast.txt`)

```bash
cd /workspace/agentic-edi-platform/backend
pip install --no-cache-dir -r requirements-vast.txt
```

This installs:
- **Core**: fastapi, uvicorn, pymongo, motor
- **Partner AI**: PyPDF2, python-docx, pandas, openpyxl, **librosa** (for voice/Whisper)
- **Auth**: python-jose, passlib

### 2. vLLM image (already has)

- **torch** – GPU inference
- **transformers** – Qwen, Whisper models
- **CUDA** – GPU drivers

### 3. Optional (for full Partner AI)

If Partner AI chat/voice fails:

```bash
pip install transformers torch librosa
```

If voice (Whisper) fails with audio format errors:

```bash
apt-get update && apt-get install -y ffmpeg
```

### 4. For frontend build

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
cd /workspace/agentic-edi-platform/frontend && npm install && npm run build
```

## Full setup checklist

```bash
# 1. Pull latest
cd /workspace/agentic-edi-platform && git pull origin main

# 2. Backend deps
cd backend && pip install --no-cache-dir -r requirements-vast.txt

# 3. Rebuild frontend (if Node.js installed)
cd ../frontend && npm run build 2>/dev/null || true

# 4. Start MongoDB (if not running)
mongod --fork --logpath /tmp/mongod.log --dbpath /workspace/mongodb_data --bind_ip 127.0.0.1

# 5. Start backend
cd ../backend && uvicorn app.main:app --host 0.0.0.0 --port 8001
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Partner AI shows wrong response | Ensure frontend rebuilt – FormData fix |
| Voice not working | `pip install librosa`; check GPU/Whisper |
| 502 on API | Check backend logs; restart uvicorn |
| Context not sent | Do NOT set Content-Type on FormData |
