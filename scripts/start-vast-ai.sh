#!/bin/bash
# Start EDI Platform on vast.ai - ensures MongoDB is running before backend
# Run from: cd /workspace/agentic-edi-platform && ./scripts/start-vast-ai.sh
# Usage: ./scripts/start-vast-ai.sh [--seed]  (--seed = run populate_sample_data first)

set -e
cd "$(dirname "$0")/.."

SEED_DATA=false
[[ "${1:-}" == "--seed" ]] && SEED_DATA=true

MONGODB_DATA="${MONGODB_DATA:-/workspace/mongodb_data}"

# Kill any stale mongod (fixes "Address already in use")
echo ">>> Stopping any existing MongoDB..."
pkill -9 mongod 2>/dev/null || true
sleep 2

echo ">>> Starting MongoDB..."
mkdir -p "$MONGODB_DATA"
rm -f "$MONGODB_DATA/mongod.lock" 2>/dev/null || true
if mongod --fork --logpath /tmp/mongod.log --dbpath "$MONGODB_DATA" --bind_ip 127.0.0.1 2>/dev/null; then
  echo ">>> MongoDB started"
elif mongod --fork --logpath /tmp/mongod.log --dbpath /tmp/mongodb_data --bind_ip 127.0.0.1 2>/dev/null; then
  echo ">>> MongoDB started (using /tmp/mongodb_data)"
else
  echo ">>> MongoDB failed. Try: mongod --logpath /tmp/mongod.log --dbpath $MONGODB_DATA --bind_ip 127.0.0.1 (no --fork) to see error"
  exit 1
fi
sleep 2

# Optional: seed sample data
if $SEED_DATA; then
  echo ">>> Seeding sample data..."
  cd backend && python populate_sample_data.py 2>/dev/null || true
  cd ..
fi

# Stop any existing backend
pkill -f uvicorn 2>/dev/null || true
sleep 1

echo ">>> Starting backend..."
cd backend
# Voice: whisper-medium (default) for better accuracy. Set WHISPER_MODEL=openai/whisper-large-v3 for best (needs ~10GB VRAM).
# Optional: OPENAI_API_KEY for cloud Whisper (highest accuracy, no GPU needed).
export WHISPER_MODEL="${WHISPER_MODEL:-openai/whisper-medium}"
exec uvicorn app.main:app --host 0.0.0.0 --port 8001
