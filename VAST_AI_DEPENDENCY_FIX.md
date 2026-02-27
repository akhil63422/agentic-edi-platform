# Fix vast.ai Dependency Conflicts (vLLM + EDI)

If you see errors like:

```
ERROR: pip's dependency resolver does not currently take into account...
vllm 0.15.1 requires fastapi[standard]>=0.115.0, but fastapi 0.109.0 is installed
vllm 0.15.1 requires torch==2.9.1, but torch 2.10.0 is installed
```

**Cause:** You ran `pip install -r requirements.txt` on a vLLM image. That installs older versions that conflict with vLLM.

**Fix:** Use `requirements-vast.txt` (for vLLM images) and restore compatible versions.

## Quick fix (run on vast.ai)

```bash
cd /workspace/agentic-edi-platform
chmod +x scripts/fix-vast-ai-deps.sh
./scripts/fix-vast-ai-deps.sh
```

Or manually:

```bash
cd /workspace/agentic-edi-platform/backend

# Restore vLLM-compatible versions
pip install --no-cache-dir \
  'fastapi[standard]>=0.115.0' \
  'openai>=1.99.1' \
  'pydantic>=2.12.0' \
  'httpx>=0.27.1' \
  'starlette>=0.49.1'

# Install EDI deps (use requirements-vast.txt, NOT requirements.txt)
pip install --no-cache-dir -r requirements-vast.txt
```

## If torch/transformers still conflict

```bash
pip install --no-cache-dir 'torch==2.9.1' 'transformers>=4.56.0,<5' \
  --index-url https://download.pytorch.org/whl/cu121
```

Then reinstall EDI deps:

```bash
pip install --no-cache-dir -r requirements-vast.txt
```

## Rule of thumb

| Image type | Use | Do NOT use |
|------------|-----|------------|
| vLLM Jupyter | `requirements-vast.txt` | `requirements.txt` |
| Ubuntu 22.04 (plain) | `requirements.txt` | `requirements-vast.txt` |
