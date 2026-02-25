from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # Application
    APP_NAME: str = "Agentic EDI Platform"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    
    # API
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # Database
    MONGODB_URL: str = "mongodb://localhost:27017"
    MONGODB_DB_NAME: str = "edi_platform"
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # AWS S3
    AWS_ACCESS_KEY_ID: Optional[str] = None
    AWS_SECRET_ACCESS_KEY: Optional[str] = None
    AWS_REGION: str = "us-east-1"
    S3_BUCKET_NAME: Optional[str] = None
    
    # AI/ML
    OPENAI_API_KEY: Optional[str] = None
    AI_MODEL: str = "gpt-4"
    AI_CONFIDENCE_THRESHOLD_HIGH: float = 0.90
    AI_CONFIDENCE_THRESHOLD_MEDIUM: float = 0.75
    
    # CORS (env: comma-separated string, e.g. "https://app.onrender.com,http://localhost:3000")
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000,http://127.0.0.1:3001,https://tranquil-blancmange-af2279.netlify.app,https://edi-frontend-xzel.onrender.com"
    
    # File Upload
    MAX_UPLOAD_SIZE: int = 10 * 1024 * 1024  # 10MB
    
    # Serve frontend from backend (vast.ai single-port deployment)
    SERVE_FRONTEND: bool = False
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
