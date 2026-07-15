from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, Response, Request, status
from sqlalchemy.orm import Session
from libs.shared_schemas.auth import UserRegister, UserLogin, UserResponse, TokenResponse
from services.gateway.database import get_db
from services.auth.models import User
from services.auth.security import (
    get_password_hash,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
    ACCESS_TOKEN_EXPIRE_MINUTES,
    REFRESH_TOKEN_EXPIRE_DAYS
)
from jose import JWTError

router = APIRouter()

# Expose cookie setting configurations
REFRESH_COOKIE_NAME = "refresh_token"

def set_refresh_cookie(response: Response, token: str):
    import os
    # Default to Secure cookies in production, but allow override for local plain HTTP runs
    is_secure = os.getenv("AUTH_COOKIE_SECURE", "true").lower() == "true"
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=token,
        httponly=True,
        max_age=REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        expires=REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        samesite="strict",
        secure=is_secure,
    )


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user account"
)
def register(user_data: UserRegister, db: Session = Depends(get_db)):
    # Check if user already exists
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        exc = HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email address already exists.",
        )
        setattr(exc, "code", "USER_ALREADY_EXISTS")
        raise exc

    # Create new User
    hashed_pw = get_password_hash(user_data.password)
    new_user = User(
        name=user_data.name,
        email=user_data.email,
        password_hash=hashed_pw,
        role=user_data.role
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@router.post(
    "/login",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Log in using credentials and receive access + refresh tokens"
)
def login(login_data: UserLogin, response: Response, db: Session = Depends(get_db)):
    # Retrieve user by email
    user = db.query(User).filter(User.email == login_data.email).first()
    if not user or not verify_password(login_data.password, user.password_hash):
        exc = HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email address or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )
        setattr(exc, "code", "INVALID_CREDENTIALS")
        raise exc

    # Generate tokens
    access_token = create_access_token(data={"sub": user.email, "role": user.role})
    refresh_token = create_refresh_token(data={"sub": user.email})

    # Set refresh token in HttpOnly cookie
    set_refresh_cookie(response, refresh_token)

    return TokenResponse(access_token=access_token)

@router.post(
    "/refresh",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Refresh an expired access token using the refresh token cookie"
)
def refresh(request: Request, response: Response, db: Session = Depends(get_db)):
    refresh_token = request.cookies.get(REFRESH_COOKIE_NAME)
    if not refresh_token:
        exc = HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token is missing.",
            headers={"WWW-Authenticate": "Bearer"},
        )
        setattr(exc, "code", "MISSING_REFRESH_TOKEN")
        raise exc

    try:
        # Validate refresh token signature and expiration
        payload = decode_token(refresh_token)
        email: str = payload.get("sub")
        if email is None:
            exc = HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token payload.",
                headers={"WWW-Authenticate": "Bearer"},
            )
            setattr(exc, "code", "INVALID_REFRESH_TOKEN")
            raise exc
    except JWTError:
        exc = HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token is invalid or expired.",
            headers={"WWW-Authenticate": "Bearer"},
        )
        setattr(exc, "code", "INVALID_REFRESH_TOKEN")
        raise exc

    # Retrieve user linked to token
    user = db.query(User).filter(User.email == email).first()
    if not user:
        exc = HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User linked to this token was not found.",
            headers={"WWW-Authenticate": "Bearer"},
        )
        setattr(exc, "code", "USER_NOT_FOUND")
        raise exc

    # Generate rotated access and refresh tokens
    new_access_token = create_access_token(data={"sub": user.email, "role": user.role})
    new_refresh_token = create_refresh_token(data={"sub": user.email})

    # Set rotated refresh token cookie
    set_refresh_cookie(response, new_refresh_token)

    return TokenResponse(access_token=new_access_token)

@router.post(
    "/logout",
    status_code=status.HTTP_200_OK,
    summary="Log out by clearing refresh token cookie"
)
def logout(response: Response):
    response.delete_cookie(
        key=REFRESH_COOKIE_NAME,
        httponly=True,
        samesite="strict",
        secure=True,
    )
    return {"detail": "Logged out successfully"}
