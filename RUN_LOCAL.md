# Run EDI Platform on Localhost

**See [UI_WORKFLOW_GUIDE.md](./UI_WORKFLOW_GUIDE.md) for how the UI connects to the backend and how the 10-step pipeline works.**

## Prerequisites

1. **MongoDB** – Either:
   - **Docker**: Start Docker Desktop, then run `docker run -d --name edi-mongo -p 27017:27017 mongo:6`
   - **Homebrew**: `brew tap mongodb/brew && brew install mongodb-community` then `brew services start mongodb-community`

2. **Node.js** (v18+)
3. **Python** (3.10+)

---

## Quick Start (one script)

```bash
./scripts/run-local.sh
```

Requires Docker to be running for MongoDB.

---

## Manual Steps

### 1. Start MongoDB

```bash
# Option A: Docker
docker run -d --name edi-mongo -p 27017:27017 mongo:6

# Option B: Homebrew
brew services start mongodb-community
```

### 2. Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate   # On Windows: .venv\Scripts\activate
pip install -r requirements-vast.txt
python populate_sample_data.py   # Seed sample data (first time only)
uvicorn app.main:app --host 0.0.0.0 --port 8001
```

### 3. Frontend (new terminal)

```bash
cd frontend
cp public/config.local.json public/config.json   # Use localhost API
npm install --legacy-peer-deps
npm run start
```

### 4. Open

- **Frontend**: http://localhost:3000
- **API**: http://localhost:8001/api/v1
- **Docs**: http://localhost:8001/docs
