#!/bin/bash
# Start EDI Platform on vast.ai - ensures MongoDB is running before backend
# Run from: cd /workspace/agentic-edi-platform && ./scripts/start-vast-ai.sh

set -e
cd "$(dirname "$0")/.."

MONGODB_DATA="${MONGODB_DATA:-/workspace/mongodb_data}"
echo ">>> Checking MongoDB..."
if ! pgrep -x mongod >/dev/null 2>&1; then
  echo ">>> Starting MongoDB..."
  mkdir -p "$MONGODB_DATA"
  rm -f "$MONGODB_DATA/mongod.lock" 2>/dev/null || true
  mongod --fork --logpath /tmp/mongod.log --dbpath "$MONGODB_DATA" --bind_ip 127.0.0.1 2>/dev/null || \
    mongod --fork --logpath /tmp/mongod.log --dbpath /tmp/mongodb_data --bind_ip 127.0.0.1 2>/dev/null || true
  sleep 2
fi

if pgrep -x mongod >/dev/null 2>&1; then
  echo ">>> MongoDB is running"
else
  echo ">>> WARNING: MongoDB may not have started. Check: tail /tmp/mongod.log"
fi

echo ">>> Starting backend..."
cd backend
exec uvicorn app.main:app --host 0.0.0.0 --port 8001
