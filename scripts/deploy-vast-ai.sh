#!/bin/bash
# Run this script ON the vast.ai instance (after SSH)
# Usage: bash deploy-vast-ai.sh

set -e
echo "=== EDI Platform GPU Backend Setup ==="

# Install deps if needed
if ! command -v git &> /dev/null; then
    apt-get update && apt-get install -y git python3-pip
fi

# Clone or pull repo
REPO_DIR="/workspace/agentic-edi-platform"
if [ -d "$REPO_DIR" ]; then
    cd "$REPO_DIR" && git pull
else
    git clone https://github.com/akhil63422/agentic-edi-platform.git "$REPO_DIR"
    cd "$REPO_DIR"
fi

cd backend

# Create venv
python3 -m venv venv
source venv/bin/activate

# Install torch with CUDA first
pip install --upgrade pip
pip install torch --index-url https://download.pytorch.org/whl/cu121

# Install rest of requirements
pip install -r requirements.txt

# Create .env if not exists
if [ ! -f .env ]; then
    echo "Creating .env - EDIT with your values:"
    cat > .env << 'EOF'
MONGODB_URL=mongodb+srv://USER:PASS@cluster.mongodb.net/edi_platform?retryWrites=true&w=majority
CORS_ORIGINS=https://edi-frontend-xzel.onrender.com,https://tranquil-blancmange-af2279.netlify.app
HUGGINGFACE_API_TOKEN=
EOF
    echo "Edit .env with: nano .env"
fi

echo ""
echo "=== Ready. Start with: ==="
echo "  cd $REPO_DIR/backend"
echo "  source venv/bin/activate"
echo "  uvicorn app.main:app --host 0.0.0.0 --port 8001"
echo ""
echo "Then set REACT_APP_BACKEND_URL to http://YOUR_VAST_IP:8001/api/v1"
echo "Vast.ai exposes ports - check your instance's port mapping."
