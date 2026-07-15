import datetime
import os
from typing import List, Optional
import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from sqlalchemy.orm import Session
from services.gateway.database import get_db
from services.auth.models import User

# Configure secret key and token lifetimes
SECRET_KEY = os.getenv("AUTH_JWT_SECRET", "super-secret-key-smart-stadium-2026")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 15
REFRESH_TOKEN_EXPIRE_DAYS = 7

# Security scheme for JWT token extraction
security_scheme = HTTPBearer(auto_error=True)

# Password hashing utilities using bcrypt
def get_password_hash(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))

# JWT Creation helpers
def create_access_token(data: dict, expires_delta: Optional[datetime.timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.datetime.utcnow() + expires_delta
    else:
        expire = datetime.datetime.utcnow() + datetime.timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def create_refresh_token(data: dict, expires_delta: Optional[datetime.timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.datetime.utcnow() + expires_delta
    else:
        expire = datetime.datetime.utcnow() + datetime.timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

# Decodes token and returns payload, raises JWTError on invalid/expired signature
def decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError as e:
        raise e

# FastAPI Dependency to validate JWT token and return active user object
def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
    db: Session = Depends(get_db)
) -> User:
    token = credentials.credentials
    try:
        payload = decode_token(token)
        email: str = payload.get("sub")
        if email is None:
            exc = HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials: email missing",
                headers={"WWW-Authenticate": "Bearer"},
            )
            setattr(exc, "code", "INVALID_TOKEN")
            raise exc
    except JWTError:
        exc = HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials: token expired or signature invalid",
            headers={"WWW-Authenticate": "Bearer"},
        )
        setattr(exc, "code", "INVALID_TOKEN")
        raise exc

    user = db.query(User).filter(User.email == email).first()
    if user is None:
        exc = HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
        setattr(exc, "code", "USER_NOT_FOUND")
        raise exc
    return user

# RBAC Gate Dependency class to assert correct user role memberships
class RoleChecker:
    def __init__(self, allowed_roles: List[str]):
        self.allowed_roles = allowed_roles

    def __call__(self, current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in self.allowed_roles:
            exc = HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied: User role '{current_user.role}' is not authorized.",
                headers={"WWW-Authenticate": "Bearer"},
            )
            setattr(exc, "code", "FORBIDDEN")
            raise exc
        return current_user
