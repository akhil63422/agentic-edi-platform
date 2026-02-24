from fastapi import APIRouter, HTTPException, Depends, status, Request
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from datetime import datetime, timedelta
from bson import ObjectId
from app.core.database import get_database
from app.core.security import verify_password, get_password_hash, create_access_token
from app.core.config import settings
from app.models.user import User, UserCreate, UserLogin, Token
from app.models.audit import AuditLogCreate
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login")


async def get_current_user(token: str = Depends(oauth2_scheme), db=Depends(get_database)):
    """Get current authenticated user"""
    from jose import JWTError, jwt
    
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if user is None:
        raise credentials_exception
    
    user["_id"] = str(user["_id"])
    return user


@router.post("/register", response_model=User, status_code=201)
async def register(user_data: UserCreate, db=Depends(get_database)):
    """Register a new user"""
    try:
        # Check if user already exists
        existing_user = await db.users.find_one({"$or": [
            {"email": user_data.email},
            {"username": user_data.username}
        ]})
        if existing_user:
            raise HTTPException(status_code=400, detail="User already exists")
        
        user_dict = user_data.model_dump()
        user_dict["hashed_password"] = get_password_hash(user_data.password)
        del user_dict["password"]
        user_dict["created_at"] = datetime.utcnow()
        user_dict["updated_at"] = datetime.utcnow()
        
        result = await db.users.insert_one(user_dict)
        user = await db.users.find_one({"_id": result.inserted_id})
        user["_id"] = str(user["_id"])
        del user["hashed_password"]
        
        return user
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error registering user: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db=Depends(get_database)):
    """Login and get access token"""
    try:
        user = await db.users.find_one({"username": form_data.username})
        if not user:
            raise HTTPException(status_code=401, detail="Incorrect username or password")
        
        if not verify_password(form_data.password, user["hashed_password"]):
            raise HTTPException(status_code=401, detail="Incorrect username or password")
        
        if not user.get("is_active", True):
            raise HTTPException(status_code=403, detail="User account is disabled")
        
        # Update last login
        await db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {"last_login": datetime.utcnow()}}
        )
        
        # Create audit log
        audit_log = AuditLogCreate(
            action_type="Security",
            action="Login",
            entity_type="User",
            entity_id=str(user["_id"]),
            user_id=str(user["_id"]),
            user_type="Human",
            description=f"User {form_data.username} logged in"
        )
        await db.audit_logs.insert_one(audit_log.model_dump())
        
        # Create audit log
        audit_log = AuditLogCreate(
            action_type="Security",
            action="Login",
            entity_type="User",
            entity_id=str(user["_id"]),
            user_id=str(user["_id"]),
            user_type="Human",
            description=f"User {form_data.username} logged in"
        )
        await db.audit_logs.insert_one(audit_log.model_dump())
        
        # Create access token
        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": str(user["_id"])}, expires_delta=access_token_expires
        )
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user_id": str(user["_id"]),
            "username": user["username"],
            "role": user.get("role", "Viewer")
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error during login: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/me", response_model=User)
async def get_current_user_info(current_user: dict = Depends(get_current_user)):
    """Get current user information"""
    del current_user["hashed_password"]
    return current_user
