#!/bin/bash
# Full EDI Platform setup on vast.ai - MongoDB + Backend (no Atlas SSL issues)
# Run this ON the vast.ai instance via Jupyter Terminal

set -e
echo "=== EDI Platform - Full Setup on vast.ai ==="

# 1. Install MongoDB (local - no SSL needed)
echo ">>> Installing MongoDB..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq gnupg curl wget
# MongoDB 6.0 for broader compatibility
curl -fsSL https://www.mongodb.org/static/pgp/server-6.0.asc | gpg --batch --yes -o /usr/share/keyrings/mongodb-server-6.0.gpg --dearmor
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-6.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/6.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-6.0.list
apt-get update -qq
apt-get install -y -qq mongodb-org
# Start MongoDB - use /workspace for dbpath (more space), remove stale lock, use smallfiles for containers
MONGODB_DATA=/workspace/mongodb_data
mkdir -p "$MONGODB_DATA"
rm -f "$MONGODB_DATA/mongod.lock" 2>/dev/null
pkill -9 mongod 2>/dev/null || true
sleep 1
mongod --fork --logpath /tmp/mongod.log --dbpath "$MONGODB_DATA" --bind_ip 127.0.0.1 2>/dev/null || \
  mongod --fork --logpath /tmp/mongod.log --dbpath /tmp/mongodb_data --bind_ip 127.0.0.1 2>/dev/null || true
sleep 2

# 2. Clone repo
echo ">>> Cloning repo..."
cd /workspace
if [ -d "agentic-edi-platform" ]; then
  cd agentic-edi-platform && git pull
else
  git clone https://github.com/akhil63422/agentic-edi-platform.git
  cd agentic-edi-platform
fi

# 3. Install Python deps (use local MongoDB - no heavy deps needed)
echo ">>> Installing backend deps..."
cd backend
pip install --no-cache-dir -q -r requirements-vast.txt

# 4. Create .env for LOCAL MongoDB + serve frontend
echo ">>> Creating .env (local MongoDB + serve frontend)..."
cat > .env << 'EOF'
MONGODB_URL=mongodb://localhost:27017/edi_platform
CORS_ORIGINS=https://edi-frontend-xzel.onrender.com,https://tranquil-blancmange-af2279.netlify.app,http://localhost:3000
SERVE_FRONTEND=true
EOF

# 5. Build frontend (served from backend - same origin, no CORS)
echo ">>> Building frontend..."
if ! command -v node >/dev/null 2>&1; then
  echo "Installing Node.js..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
cd /workspace/agentic-edi-platform/frontend
echo '{"backendUrl":"/api/v1"}' > public/config.json
npm install --legacy-peer-deps 2>/dev/null || npm install
npm run build 2>/dev/null || echo "Frontend build failed - run manually: cd frontend && npm install && npm run build"

# 6. Seed sample data
echo ">>> Seeding sample data..."
cd /workspace/agentic-edi-platform/backend
python populate_sample_data.py 2>/dev/null || echo "Seed skipped (run manually: python populate_sample_data.py)"

echo ""
echo "=== Setup complete ==="
echo "Start backend (serves API + frontend on port 8001):"
echo "  cd /workspace/agentic-edi-platform/backend && uvicorn app.main:app --host 0.0.0.0 --port 8001"
echo "Create tunnel for localhost:8001 in vast.ai"
echo "Open the tunnel URL in browser - full app with no CORS issues!"
