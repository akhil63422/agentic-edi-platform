# Agentic EDI Platform Backend

FastAPI backend for the Agentic EDI Platform.

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Copy `.env.example` to `.env` and configure:
```bash
cp .env.example .env
```

3. Start MongoDB:
```bash
# Using Docker
docker run -d -p 27017:27017 --name mongodb mongo:latest

# Or use your local MongoDB installation
```

4. Run the application:
```bash
uvicorn app.main:app --reload --port 8001
```

The API will be available at `http://localhost:8001`

API documentation: `http://localhost:8001/docs`

## API Endpoints

- `/api/v1/partners` - Trading partner management
- `/api/v1/documents` - EDI document processing
- `/api/v1/exceptions` - Exception management
- `/api/v1/audit` - Audit logs
- `/api/v1/auth` - Authentication
- `/api/v1/mappings` - Mapping configurations

## Development

Run with auto-reload:
```bash
uvicorn app.main:app --reload --port 8001
```

Run tests:
```bash
pytest
```
