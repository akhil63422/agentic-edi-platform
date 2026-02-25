from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import ConnectionFailure
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

class Database:
    client: AsyncIOMotorClient = None

db = Database()

async def connect_to_mongo():
    """Create database connection"""
    try:
        # Local MongoDB (mongodb://) - no TLS. Atlas (mongodb+srv://) - use certifi for SSL
        is_local = settings.MONGODB_URL.strip().lower().startswith("mongodb://localhost") or settings.MONGODB_URL.strip().lower().startswith("mongodb://127.0.0.1")
        kwargs = {"serverSelectionTimeoutMS": 30000}
        if not is_local:
            import certifi
            kwargs["tlsCAFile"] = certifi.where()
        db.client = AsyncIOMotorClient(settings.MONGODB_URL, **kwargs)
        # Test connection
        await db.client.admin.command('ping')
        logger.info("Connected to MongoDB")
    except ConnectionFailure as e:
        logger.error(f"Failed to connect to MongoDB: {e}")
        raise

async def close_mongo_connection():
    """Close database connection"""
    if db.client:
        db.client.close()
        logger.info("Disconnected from MongoDB")

def get_database():
    """Get database instance"""
    return db.client[settings.MONGODB_DB_NAME]
