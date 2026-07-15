import logging
import json
import time
from typing import Any, Dict
from fastapi import FastAPI, Request, status, Depends
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

from services.gateway.database import Base, engine
from services.auth.router import router as auth_router
from services.vendor.router import router as vendor_router
from services.inventory.router import router as inventory_router
from services.crowd.router import router as crowd_router
from services.auth.security import get_current_user, RoleChecker
from libs.shared_schemas.auth import UserResponse

# Create database tables at startup for local SQLite development and testing
Base.metadata.create_all(bind=engine)



# Setup structured logging
class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        log_data: Dict[str, Any] = {
            "timestamp": self.formatTime(record, self.datefmt),
            "service": "gateway",
            "level": record.levelname,
            "message": record.getMessage(),
        }
        if hasattr(record, "context"):
            log_data["context"] = record.context
        elif record.exc_info:
            log_data["context"] = {"exception": self.formatException(record.exc_info)}
        else:
            log_data["context"] = {}
        return json.dumps(log_data)

logger = logging.getLogger("gateway")
handler = logging.StreamHandler()
handler.setFormatter(JsonFormatter())
logger.addHandler(handler)
logger.setLevel(logging.INFO)

app = FastAPI(
    title="AI Smart Stadium Gateway",
    description="API Gateway for the AI Smart Stadium Operations Platform",
    version="1.0.0",
)

@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    duration = time.time() - start_time
    logger.info(
        f"Request {request.method} {request.url.path} finished with status {response.status_code}",
        extra={
            "context": {
                "method": request.method,
                "path": request.url.path,
                "status_code": response.status_code,
                "duration_ms": int(duration * 1000),
            }
        }
    )
    return response

# Error handlers enforcing consistent error shape { "detail": string, "code": string }
@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "detail": exc.detail,
            "code": getattr(exc, "code", "HTTP_EXCEPTION")
        }
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "detail": str(exc.errors()),
            "code": "VALIDATION_ERROR"
        }
    )

@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logger.error(
        f"Unhandled exception occurred: {str(exc)}",
        exc_info=True
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": "An internal server error occurred.",
            "code": "INTERNAL_SERVER_ERROR"
        }
    )

# Include Routers
app.include_router(auth_router, prefix="/api/v1/auth", tags=["Authentication"])
app.include_router(vendor_router, prefix="/api/v1/vendors", tags=["Vendors"])
app.include_router(inventory_router, prefix="/api/v1", tags=["Inventory"])
app.include_router(crowd_router, prefix="/api/v1/crowd", tags=["Crowd"])



# Health Check route
@app.get("/health", status_code=status.HTTP_200_OK)
async def health_check():
    return {
        "status": "healthy",
        "timestamp": int(time.time()),
        "services": {
            "gateway": "up"
        }
    }

# RBAC / Authenticated test endpoints
@app.get("/api/v1/auth/me", response_model=UserResponse, tags=["Authentication"])
async def get_me(current_user: UserResponse = Depends(get_current_user)):
    return current_user

@app.get("/api/v1/auth/admin-only", tags=["Authentication"])
async def admin_only_route(current_user: UserResponse = Depends(RoleChecker(["admin"]))):
    return {
        "message": f"Hello Admin {current_user.name}! Access verified.",
        "role": current_user.role
    }

