from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import ConnectionFailure
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

class Database:
    client = None

db = Database()

async def connect_to_mongo():
    """Create database connection — falls back to in-memory mock if MongoDB is unavailable"""
    try:
        is_local = settings.MONGODB_URL.strip().lower().startswith("mongodb://localhost") or settings.MONGODB_URL.strip().lower().startswith("mongodb://127.0.0.1")
        kwargs = {"serverSelectionTimeoutMS": 5000}
        if not is_local:
            import certifi
            kwargs["tlsCAFile"] = certifi.where()
        db.client = AsyncIOMotorClient(settings.MONGODB_URL, **kwargs)
        await db.client.admin.command('ping')
        logger.info("Connected to MongoDB")
    except Exception as e:
        logger.warning(f"MongoDB unavailable ({e}), falling back to in-memory mock database")
        try:
            import mongomock_motor
            db.client = mongomock_motor.AsyncMongoMockClient()
            logger.info("Using in-memory mock database (data will not persist)")
        except ImportError:
            logger.error("mongomock_motor not installed — cannot start without MongoDB")
            raise

async def close_mongo_connection():
    """Close database connection"""
    if db.client:
        db.client.close()
        logger.info("Disconnected from MongoDB")

def get_database():
    """Get database instance"""
    return db.client[settings.MONGODB_DB_NAME]
