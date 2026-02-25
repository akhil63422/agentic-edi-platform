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
curl -fsSL https://www.mongodb.org/static/pgp/server-6.0.asc | gpg -o /usr/share/keyrings/mongodb-server-6.0.gpg --dearmor
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-6.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/6.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-6.0.list
apt-get update -qq
apt-get install -y -qq mongodb-org
# Start MongoDB (no systemd in container - use fork)
mkdir -p /tmp/mongodb_data
mongod --fork --logpath /tmp/mongod.log --dbpath /tmp/mongodb_data 2>/dev/null || true
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

# 4. Create .env for LOCAL MongoDB
echo ">>> Creating .env (local MongoDB)..."
cat > .env << 'EOF'
MONGODB_URL=mongodb://localhost:27017/edi_platform
CORS_ORIGINS=https://edi-frontend-xzel.onrender.com,https://tranquil-blancmange-af2279.netlify.app,http://localhost:3000
EOF

# 5. Seed sample data
echo ">>> Seeding sample data..."
cd /workspace/agentic-edi-platform/backend
python populate_sample_data.py 2>/dev/null || echo "Seed skipped (run manually: python populate_sample_data.py)"

echo ""
echo "=== Setup complete ==="
echo "Start backend: cd /workspace/agentic-edi-platform/backend && uvicorn app.main:app --host 0.0.0.0 --port 8001"
echo "Then expose port 8001 in vast.ai Tunnels"
echo "Set REACT_APP_BACKEND_URL to http://YOUR_VAST_IP:8001/api/v1"
