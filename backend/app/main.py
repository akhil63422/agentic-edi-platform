from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse, Response
from contextlib import asynccontextmanager
import logging

from app.core.config import settings
from app.core.database import connect_to_mongo, close_mongo_connection
from app.api.v1 import partners, documents, exceptions, audit, auth, mappings, process, websocket, analytics, exception_rules, partner_ai, playground, data, settings as settings_router, workflow, search, ai as ai_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events"""
    # Secrets validation (production)
    if settings.PRODUCTION:
        if settings.SECRET_KEY == "your-secret-key-change-in-production":
            raise ValueError("SECRET_KEY must be set in production. Set PRODUCTION=false for development.")
        if not settings.ENCRYPTION_KEY or len(settings.ENCRYPTION_KEY) < 32:
            raise ValueError("ENCRYPTION_KEY must be set (32+ chars) in production for credential encryption.")
        logger.info("Production mode: secrets validated")
    elif settings.SECRET_KEY == "your-secret-key-change-in-production":
        logger.warning("SECRET_KEY is default. Set SECRET_KEY in .env for production.")
    # Startup
    await connect_to_mongo()
    # Load settings from DB
    from app.core.database import get_database
    from app.services.slack_service import slack_service
    from app.services.partner_ai_service import partner_ai_service
    try:
        db = get_database()
        doc = await db.platform_settings.find_one({"_id": "platform"})
        if doc:
            if doc.get("slack_webhook_url"):
                slack_service.set_webhook(doc["slack_webhook_url"])
            ai_cfg = doc.get("partner_ai_config") or {}
            if ai_cfg.get("system_prompt"):
                partner_ai_service._system_prompt = ai_cfg["system_prompt"]
            if ai_cfg.get("name_synonyms"):
                partner_ai_service._name_synonyms = ai_cfg["name_synonyms"]
    except Exception as e:
        logger.debug(f"Could not load settings: {e}")
    logger.info("Application started")
    # Start background scheduler for ingestion polling
    try:
        from app.scheduler import start_scheduler
        start_scheduler()
    except Exception as e:
        logger.debug(f"Scheduler not started: {e}")
    yield
    # Shutdown
    try:
        from app.scheduler import stop_scheduler
        stop_scheduler()
    except Exception:
        pass
    await close_mongo_connection()
    logger.info("Application stopped")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Agent Eddy API",
    lifespan=lifespan
)

# Correlation ID middleware (for tracing)
from app.middleware.correlation_id import CorrelationIdMiddleware
app.add_middleware(CorrelationIdMiddleware)

# Rate limit middleware
from app.middleware.rate_limit import RateLimitMiddleware
app.add_middleware(RateLimitMiddleware, requests_per_minute=120)

# CORS middleware - allow explicit origins + regex for Netlify/Render/Cloudflare tunnels
_cors_origins = [x.strip() for x in settings.CORS_ORIGINS.split(",") if x.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_origin_regex=r"https://.*\.(netlify\.app|onrender\.com|vercel\.app|trycloudflare\.com)",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(partners.router, prefix=settings.API_V1_STR)
app.include_router(documents.router, prefix=settings.API_V1_STR)
app.include_router(exceptions.router, prefix=settings.API_V1_STR)
app.include_router(audit.router, prefix=settings.API_V1_STR)
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(mappings.router, prefix=settings.API_V1_STR)
app.include_router(process.router, prefix=settings.API_V1_STR)
app.include_router(websocket.router, prefix=settings.API_V1_STR)
app.include_router(analytics.router, prefix=settings.API_V1_STR)
app.include_router(exception_rules.router, prefix=settings.API_V1_STR)
app.include_router(partner_ai.router, prefix=settings.API_V1_STR)
app.include_router(playground.router, prefix=settings.API_V1_STR)
app.include_router(data.router, prefix=settings.API_V1_STR)
app.include_router(settings_router.router, prefix=settings.API_V1_STR)
app.include_router(workflow.router, prefix=settings.API_V1_STR)
app.include_router(search.router, prefix=settings.API_V1_STR)
app.include_router(ai_router.router, prefix=settings.API_V1_STR)

# Frontend static files (when SERVE_FRONTEND=true, e.g. vast.ai single-port)
FRONTEND_BUILD = Path(__file__).resolve().parent.parent.parent / "frontend" / "build"


@app.get("/")
async def root():
    """Root endpoint - serve frontend or API info"""
    if settings.SERVE_FRONTEND and (FRONTEND_BUILD / "index.html").exists():
        return FileResponse(FRONTEND_BUILD / "index.html")
    return {
        "message": "Agent Eddy API",
        "version": settings.APP_VERSION,
        "docs": "/docs"
    }


@app.get("/metrics")
async def metrics():
    """Prometheus metrics endpoint"""
    try:
        from app.metrics import get_metrics
        body, content_type = get_metrics()
        return Response(content=body, media_type=content_type)
    except Exception as e:
        logger.debug(f"Metrics error: {e}")
        return Response(content=b"# Metrics unavailable\n", media_type="text/plain")


@app.get("/health")
async def health_check(db_check: bool = False):
    """Health check endpoint. Use ?db_check=true to verify MongoDB connectivity."""
    out = {"status": "healthy"}
    if db_check:
        try:
            from app.core.database import get_database
            db = get_database()
            await db.command("ping")
            out["database"] = "connected"
        except Exception as e:
            out["database"] = "error"
            out["database_error"] = str(e)
            out["status"] = "degraded"
    return out


@app.get("/api/v1")
async def api_v1_root():
    """API v1 root - lists available endpoints"""
    return {
        "message": "Agent Eddy API",
        "version": settings.APP_VERSION,
        "docs": "/docs",
        "endpoints": {
            "partners": "/api/v1/partners",
            "documents": "/api/v1/documents",
            "exceptions": "/api/v1/exceptions",
            "audit": "/api/v1/audit",
            "health": "/health",
        }
    }


# Serve frontend static files and SPA routes (must be last)
if settings.SERVE_FRONTEND and FRONTEND_BUILD.exists():
    from fastapi.staticfiles import StaticFiles

    @app.get("/config.json")
    async def serve_config():
        """Override config.json when serving frontend - use relative API URL (same origin)"""
        return JSONResponse(
            content={"backendUrl": "/api/v1"},
            headers={"Cache-Control": "no-cache, no-store, must-revalidate", "Pragma": "no-cache"}
        )

    app.mount("/static", StaticFiles(directory=str(FRONTEND_BUILD / "static")), name="static")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        """Serve SPA - return index.html for non-API, non-file routes"""
        if full_path.startswith("api/"):
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Not found")
        file_path = (FRONTEND_BUILD / full_path).resolve()
        if not str(file_path).startswith(str(FRONTEND_BUILD.resolve())):
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Not found")
        if file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(FRONTEND_BUILD / "index.html")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
