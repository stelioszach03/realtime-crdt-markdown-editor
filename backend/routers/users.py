"""
User authentication and management routes
"""
from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer
from sqlalchemy.orm import Session
from slowapi import Limiter
from slowapi.util import get_remote_address
import models
import schemas
import auth
from database import get_db

router = APIRouter(prefix="/api/users", tags=["users"])
security = HTTPBearer()
limiter = Limiter(key_func=get_remote_address)


@router.post("/signup", response_model=schemas.User, status_code=status.HTTP_201_CREATED)
@limiter.limit("5 per minute")
async def signup(
    request: Request,
    user: schemas.UserCreate,
    db: Session = Depends(get_db)
):
    """Register a new user"""
    try:
        db_user = auth.create_user(db, user)
        return db_user
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create user"
        )


@router.post("/login", response_model=schemas.Token)
@limiter.limit("10 per minute")
async def login(
    request: Request,
    user_credentials: schemas.UserLogin,
    db: Session = Depends(get_db)
):
    """Authenticate user and return access token"""
    user = auth.authenticate_user(db, user_credentials.username, user_credentials.password)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(hours=auth.ACCESS_TOKEN_EXPIRE_HOURS)
    access_token = auth.create_access_token(
        data={"sub": user.username}, 
        expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": int(access_token_expires.total_seconds())
    }


@router.get("/me", response_model=schemas.User)
async def get_current_user_info(
    current_user: models.User = Depends(auth.get_current_active_user)
):
    """Get current user information"""
    return current_user


@router.post("/guest-token", response_model=schemas.Token)
@limiter.limit("20 per minute")
async def create_guest_token(request: Request):
    """Create a temporary token for guest access"""
    import uuid
    site_id = str(uuid.uuid4())
    access_token = auth.create_guest_token(site_id)
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": 24 * 3600  # 24 hours
    }


@router.put("/me", response_model=schemas.User)
async def update_current_user(
    user_update: schemas.UserCreate,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update current user information"""
    # Check if new username is already taken (if different)
    if user_update.username != current_user.username:
        existing_user = auth.get_user_by_username(db, user_update.username)
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already taken"
            )
    
    # Check if new email is already taken (if different and provided)
    if user_update.email and user_update.email != current_user.email:
        existing_user = auth.get_user_by_email(db, user_update.email)
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already taken"
            )
    
    # Update user
    current_user.username = user_update.username
    current_user.email = user_update.email
    
    # Update password if provided
    if user_update.password:
        current_user.hashed_password = auth.get_password_hash(user_update.password)
    
    db.commit()
    db.refresh(current_user)
    
    return current_user


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_current_user(
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete current user account"""
    # Mark user as inactive instead of deleting
    current_user.is_active = False
    db.commit()
    
    return None