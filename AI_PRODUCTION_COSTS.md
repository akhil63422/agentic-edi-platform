# AI & Production Costs — Agentic EDI Platform

Complete list of AI APIs, paid subscriptions, and infrastructure needed for **full AI integration** and **production-ready** deployment.

---

## 1. OpenAI API (Primary AI Provider)

**Required for:** All LLM features, embeddings, voice transcription

| Service | Model | Use Case | Pricing (2025) |
|---------|-------|----------|----------------|
| **Chat Completions** | `gpt-4o` | Canonical generation, document review, EDI reply generation, schema analysis | $2.50/1M input, $10/1M output |
| **Chat Completions** | `gpt-4o-mini` | Error explanation, review suggestions, Mapper AI nodes, mapping suggestions, confidence scoring | $0.15/1M input, $0.60/1M output |
| **Embeddings** | `text-embedding-3-small` | Mapping suggestions, semantic search, field similarity | $0.02/1M tokens |
| **Transcription** | `whisper-1` | Partner voice input (cloud fallback when no GPU) | $0.006/minute ($0.36/hour) |

**Environment variable:** `OPENAI_API_KEY`

**Estimated monthly cost (moderate usage):**
- 50K input + 10K output tokens/day (gpt-4o-mini) ≈ $3–5/month
- 5K input + 2K output tokens/day (gpt-4o) ≈ $2–4/month
- 1M embedding tokens/day ≈ $0.60/month
- 100 min voice/month ≈ $0.60/month  
**Total: ~$7–12/month** (light–moderate)

**Heavy production (500 docs/day, 10 partners, voice):**
- **Total: ~$80–150/month**

---

## 2. MongoDB (Database)

**Required for:** Document storage, partners, mappings, audit logs

| Option | Cost | Notes |
|--------|------|-------|
| **MongoDB Atlas Free** | $0 | 512MB, shared resources, good for dev/demo |
| **MongoDB Atlas Flex** | ~$30/month cap | Dynamic scaling, dev/staging |
| **MongoDB Atlas Dedicated** | $57+/month | Production, dedicated resources |

**Environment variable:** `MONGODB_URL`

---

## 3. Qdrant (Vector Database) — Optional

**Used for:** Semantic search over EDI documents (when `OPENAI_API_KEY` + `QDRANT_URL` set)

| Option | Cost | Notes |
|--------|------|-------|
| **Qdrant Cloud Free** | $0 | 1GB cluster, no credit card |
| **Qdrant Cloud Paid** | ~$25+/month | 4GB+ RAM, production |

**Environment variables:** `QDRANT_URL`, `QDRANT_API_KEY` (optional)

**Fallback:** MongoDB keyword search + embedding re-rank (no Qdrant needed)

---

## 4. Hugging Face (Self-Hosted AI — Alternative to OpenAI)

**Used for:** Partner chat (Qwen), local Whisper, document extraction (LayoutLM) — **requires GPU**

| Component | Model | Cost | Notes |
|-----------|-------|------|-------|
| **Hugging Face Token** | — | Free | For gated model access (Qwen, etc.) |
| **GPU Hosting** | — | $0.20–2/hr (Vast.ai, RunPod) | Qwen2.5-7B ~5GB VRAM, Whisper-medium ~5GB |
| **Inference API (Serverless)** | Pay-per-use | Varies | Alternative to self-host |

**Environment variable:** `HUGGINGFACE_API_TOKEN` (optional, for gated models)

**When to use:** Reduce OpenAI costs by running chat/voice locally on GPU. Not needed if using OpenAI for everything.

---

## 5. AWS S3 (Optional)

**Used for:** EDI file storage, SFTP/S3 transport for partner file exchange

| Option | Cost | Notes |
|--------|------|-------|
| **S3 Free Tier** | 5GB, 20K GET, 2K PUT | First 12 months |
| **S3 Pay-as-you-go** | ~$0.023/GB storage | After free tier |

**Environment variables:** `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `S3_BUCKET_NAME`

---

## 6. Slack (Optional)

**Used for:** Exception alerts, document status notifications

| Option | Cost | Notes |
|--------|------|-------|
| **Slack Free** | $0 | Incoming Webhooks included (up to 10 apps) |
| **Slack Pro** | $7.25/user/month | More integrations |

**Setup:** Create Incoming Webhook at [Slack Apps](https://api.slack.com/messaging/webhooks)

---

## 7. Hosting / Deployment

| Provider | Cost | Notes |
|----------|------|-------|
| **Render** | Free tier (spins down) / $7+/mo | Backend + MongoDB add-on |
| **Vercel/Netlify** | Free tier | Frontend only |
| **Vast.ai / RunPod** | $0.20–2/hr | GPU for self-hosted models |
| **AWS/GCP/Azure** | Variable | Full control, higher cost |

---

## 8. Redis (Optional)

**Used for:** Caching, Celery task queue (if enabled)

| Option | Cost |
|--------|------|
| **Local** | $0 |
| **Redis Cloud Free** | 30MB |
| **Redis Cloud Paid** | $5+/month |

**Environment variable:** `REDIS_URL`

---

## Summary: Minimum vs Full Production

### Minimum (Dev / Demo) — ~$0–15/month

| Item | Cost |
|------|------|
| OpenAI API (light usage) | $5–15 |
| MongoDB Atlas Free | $0 |
| Slack Free | $0 |
| Render/Vercel Free | $0 |
| **Total** | **~$5–15/month** |

### Full Production (API-Only, No GPU) — ~$100–250/month

| Item | Cost |
|------|------|
| OpenAI API (moderate–heavy) | $80–150 |
| MongoDB Atlas (Flex/Dedicated) | $30–60 |
| Qdrant Cloud (optional) | $0–25 |
| AWS S3 (optional) | $5–20 |
| Render/Backend hosting | $25–50 |
| **Total** | **~$140–305/month** |

### Full Production (API + Self-Hosted GPU) — ~$150–400/month

| Item | Cost |
|------|------|
| OpenAI API (reduced) | $30–80 |
| Hugging Face (free token) | $0 |
| GPU (Vast.ai 24/7) | $50–150 |
| MongoDB Atlas | $30–60 |
| Hosting | $25–50 |
| **Total** | **~$135–340/month** |

---

## Environment Variables Checklist

```bash
# Required for AI
OPENAI_API_KEY=sk-...

# Required for database
MONGODB_URL=mongodb+srv://...

# Optional for full AI
AI_MODEL=gpt-4o                    # or gpt-4o-mini for cheaper
QDRANT_URL=http://localhost:6333   # or Qdrant Cloud URL
QDRANT_API_KEY=                   # for Qdrant Cloud

# Optional for self-hosted GPU
HUGGINGFACE_API_TOKEN=hf_...      # for gated models (Qwen, etc.)
WHISPER_MODEL=openai/whisper-medium

# Optional for transport
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=us-east-1
S3_BUCKET_NAME=

# Optional for notifications
SLACK_WEBHOOK_URL=https://hooks.slack.com/...

# Optional for caching
REDIS_URL=redis://localhost:6379/0
```

---

## Cost Optimization Tips

1. **Use gpt-4o-mini** for most tasks (error explanation, suggestions, mapping) — 10–20x cheaper than gpt-4o.
2. **Use gpt-4o** only for canonical generation and complex schema analysis.
3. **Batch API** — save ~50% on OpenAI with 24-hour processing for non-real-time work.
4. **GPU self-host** — Run Qwen + Whisper locally to cut OpenAI voice/chat costs.
5. **MongoDB Free** — Sufficient for <10K documents; upgrade when needed.
6. **Skip Qdrant** — Use MongoDB + embedding re-rank for small/medium document collections.
