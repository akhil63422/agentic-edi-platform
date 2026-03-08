#!/bin/bash
# Run EDI Platform on localhost
set -e
cd "$(dirname "$0")/.."

echo "=== EDI Platform - Local Run ==="

# 1. Start MongoDB (Docker)
if docker ps 2>/dev/null | grep -q mongo; then
  echo ">>> MongoDB already running"
elif docker run -d --name edi-mongo -p 27017:27017 mongo:6 2>/dev/null || docker start edi-mongo 2>/dev/null; then
  echo ">>> Started MongoDB (Docker)"
  sleep 2
else
  echo ">>> MongoDB not running. Start Docker Desktop, or run: brew services start mongodb-community"
  echo ">>> Then run this script again."
  exit 1
fi

# 2. Backend .env
if [ ! -f backend/.env ]; then
  echo ">>> Creating backend/.env..."
  cat > backend/.env << 'EOF'
MONGODB_URL=mongodb://localhost:27017/edi_platform
CORS_ORIGINS=http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000
EOF
fi

# 3. Install deps if needed
echo ">>> Checking backend deps..."
cd backend
if [ -d .venv ]; then
  source .venv/bin/activate
elif python3 -m venv .venv 2>/dev/null; then
  source .venv/bin/activate
  pip install -q -r requirements-vast.txt 2>/dev/null || pip install -q -r requirements.txt
else
  pip install -q -r requirements-vast.txt 2>/dev/null || pip install -q -r requirements.txt
fi
cd ..

echo ">>> Checking frontend deps..."
cd frontend
# Use localhost config for local run (copy so we don't overwrite deployed config)
cp -f public/config.local.json public/config.json 2>/dev/null || echo '{"backendUrl":"http://localhost:8001/api/v1"}' > public/config.json
npm install --legacy-peer-deps 2>/dev/null || npm install
cd ..

# 4. No auto-seed (run: python clear_demo_data.py to reset, python populate_sample_data.py to seed)
echo ""
echo "=== Starting services ==="
echo "Backend: http://localhost:8001"
echo "Frontend: http://localhost:3000"
echo "API: http://localhost:8001/api/v1"
echo "Docs: http://localhost:8001/docs"
echo ""
echo "Press Ctrl+C to stop."

# Run backend and frontend in parallel
trap 'kill 0' EXIT
(cd backend && (source .venv/bin/activate 2>/dev/null || true) && uvicorn app.main:app --host 0.0.0.0 --port 8001) &
(cd frontend && npm run start) &
wait
