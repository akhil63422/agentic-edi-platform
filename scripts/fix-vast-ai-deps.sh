#!/bin/bash
# Fix dependency conflicts on vast.ai vLLM image after running wrong requirements
# Run this ON the vast.ai instance if you see vllm/torch/transformers conflicts

set -e
echo "=== Fixing vast.ai dependencies for EDI + AI models ==="

cd /workspace/agentic-edi-platform/backend 2>/dev/null || cd /workspace/agentic-edi-platform-source/backend 2>/dev/null || {
  echo "Error: Run from workspace with agentic-edi-platform cloned"
  exit 1
}

echo ">>> Restoring vLLM-compatible versions (fastapi, pydantic, openai, httpx)..."
pip install --no-cache-dir -q \
  'fastapi[standard]>=0.115.0' \
  'openai>=1.99.1' \
  'pydantic>=2.12.0' \
  'httpx>=0.27.1' \
  'starlette>=0.49.1'

echo ">>> Restoring torch/transformers for vLLM compatibility..."
echo "    (If vLLM conflicts persist, try: pip install 'torch==2.9.1' 'transformers>=4.56.0,<5' --index-url https://download.pytorch.org/whl/cu121)"
pip install --no-cache-dir -q 'transformers>=4.56.0,<5' 2>/dev/null || true

echo ">>> Installing EDI backend deps (requirements-vast.txt)..."
pip install --no-cache-dir -q -r requirements-vast.txt

echo ""
echo "=== Done ==="
echo "Restart backend: cd $(pwd) && pkill -f uvicorn 2>/dev/null; uvicorn app.main:app --host 0.0.0.0 --port 8001"
