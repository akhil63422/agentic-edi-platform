"""
Dependencies for API routes
"""
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer, HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional
from bson import ObjectId
from app.core.database import get_database
from app.core.config import settings
from app.core.security import decode_access_token
from app.api.v1.auth import get_current_user
from app.models.user import User
import logging

logger = logging.getLogger(__name__)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)


async def require_auth_if_enabled(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False)),
    db=Depends(get_database),
):
    """When AUTH_REQUIRED=True, enforce authentication. Otherwise allow anonymous."""
    if not settings.AUTH_REQUIRED:
        return None
    if not credentials:
        raise HTTPException(status_code=401, detail="Authentication required")
    return await get_current_user(credentials.credentials, db)


async def get_current_active_user(current_user: dict = Depends(get_current_user)) -> dict:
    """Get current active user"""
    if not current_user.get("is_active", True):
        raise HTTPException(status_code=403, detail="User account is disabled")
    return current_user


async def require_admin(current_user: dict = Depends(get_current_active_user)) -> dict:
    """Require admin role"""
    if current_user.get("role") != "Admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


async def require_operator(current_user: dict = Depends(get_current_active_user)) -> dict:
    """Require operator or admin role"""
    role = current_user.get("role")
    if role not in ["Admin", "Operator"]:
        raise HTTPException(status_code=403, detail="Operator access required")
    return current_user


async def get_optional_user(request: Request) -> Optional[dict]:
    """Get current user if authenticated, otherwise return None"""
    try:
        authorization = request.headers.get("Authorization")
        if authorization and authorization.startswith("Bearer "):
            token = authorization.split(" ")[1]
            if token:
                return await get_current_user(token)
    except Exception as e:
        logger.debug(f"Optional auth failed: {e}")
        pass
    return None
