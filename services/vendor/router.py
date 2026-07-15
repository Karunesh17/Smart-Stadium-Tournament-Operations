from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from libs.shared_schemas.vendor import VendorCreate, VendorResponse
from services.gateway.database import get_db
from services.auth.models import User
from services.auth.security import get_current_user, RoleChecker
from services.vendor.models import Vendor

router = APIRouter()

@router.post(
    "/",
    response_model=VendorResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new vendor profile"
)
def create_vendor(
    vendor_data: VendorCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["admin", "vendor"]))
):
    # Check if a vendor profile with same name exists
    existing = db.query(Vendor).filter(Vendor.name == vendor_data.name).first()
    if existing:
        exc = HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A vendor profile with this name already exists.",
        )
        setattr(exc, "code", "VENDOR_ALREADY_EXISTS")
        raise exc

    new_vendor = Vendor(
        name=vendor_data.name,
        type=vendor_data.type,
        rating=None,
        owner_user_id=current_user.id
    )
    db.add(new_vendor)
    db.commit()
    db.refresh(new_vendor)
    return new_vendor

@router.get(
    "/",
    response_model=List[VendorResponse],
    status_code=status.HTTP_200_OK,
    summary="List all vendor profiles"
)
def list_vendors(
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db)
):
    vendors = db.query(Vendor).offset(offset).limit(limit).all()
    return vendors

@router.get(
    "/{vendor_id}",
    response_model=VendorResponse,
    status_code=status.HTTP_200_OK,
    summary="Get vendor profile details by ID"
)
def get_vendor(vendor_id: int, db: Session = Depends(get_db)):
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not vendor:
        exc = HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor profile not found.",
        )
        setattr(exc, "code", "VENDOR_NOT_FOUND")
        raise exc
    return vendor
