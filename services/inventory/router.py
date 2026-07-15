import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import update
from sqlalchemy.orm import Session
from libs.shared_schemas.vendor import ItemCreate, ItemUpdate, ItemResponse, SaleCreate, SaleResponse
from services.gateway.database import get_db
from services.auth.models import User
from services.auth.security import get_current_user, RoleChecker
from services.vendor.models import Vendor
from services.inventory.models import Item, Sale
from services.gateway.redis_client import redis_manager

router = APIRouter()

# Helper function to check if user owns a specific vendor
def verify_vendor_ownership(vendor_id: int, user: User, db: Session):
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not vendor:
        exc = HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor profile not found.",
        )
        setattr(exc, "code", "VENDOR_NOT_FOUND")
        raise exc
    if user.role != "admin" and vendor.owner_user_id != user.id:
        exc = HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You do not own this vendor profile.",
        )
        setattr(exc, "code", "FORBIDDEN")
        raise exc

@router.post(
    "/items",
    response_model=ItemResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add a new catalog item to a vendor"
)
def create_item(
    item_data: ItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["admin", "vendor"]))
):
    # Verify ownership of the vendor profile
    verify_vendor_ownership(item_data.vendor_id, current_user, db)

    # Check if item name already exists for this vendor
    existing = db.query(Item).filter(
        Item.vendor_id == item_data.vendor_id,
        Item.name == item_data.name
    ).first()
    if existing:
        exc = HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An item with this name already exists in this vendor's catalog.",
        )
        setattr(exc, "code", "ITEM_ALREADY_EXISTS")
        raise exc

    new_item = Item(
        vendor_id=item_data.vendor_id,
        name=item_data.name,
        base_price=item_data.base_price,
        original_price=item_data.base_price,
        stock=item_data.stock,
        updated_at=datetime.datetime.utcnow()
    )
    db.add(new_item)
    db.commit()
    db.refresh(new_item)
    return new_item


@router.get(
    "/items",
    response_model=List[ItemResponse],
    status_code=status.HTTP_200_OK,
    summary="List catalog items"
)
def list_items(
    vendor_id: Optional[int] = Query(None),
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db)
):
    query = db.query(Item)
    if vendor_id is not None:
        query = query.filter(Item.vendor_id == vendor_id)
    items = query.offset(offset).limit(limit).all()
    return items

@router.patch(
    "/items/{item_id}",
    response_model=ItemResponse,
    status_code=status.HTTP_200_OK,
    summary="Update details of a catalog item"
)
def update_item(
    item_id: int,
    item_data: ItemUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["admin", "vendor"]))
):
    # Retrieve the item
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        exc = HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found.",
        )
        setattr(exc, "code", "ITEM_NOT_FOUND")
        raise exc

    # Verify ownership of the item's vendor profile
    verify_vendor_ownership(item.vendor_id, current_user, db)

    # Perform updates
    update_dict = item_data.model_dump(exclude_unset=True)
    for key, value in update_dict.items():
        setattr(item, key, value)
    
    item.updated_at = datetime.datetime.utcnow()
    db.commit()
    db.refresh(item)

    # If stock was updated, emit an event
    if "stock" in update_dict:
        redis_manager.publish("stock.updated", {
            "item_id": item.id,
            "vendor_id": item.vendor_id,
            "new_stock": item.stock,
            "timestamp": str(datetime.datetime.utcnow())
        })

    return item

@router.post(
    "/sales",
    response_model=SaleResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Record a concessions sales transaction (atomically decrements stock)"
)
def record_sale(
    sale_data: SaleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Perform transaction-level locking and updating
    try:
        # Atomic update statement: decrements stock iff stock >= quantity
        stmt = (
            update(Item)
            .where(Item.id == sale_data.item_id, Item.stock >= sale_data.quantity)
            .values(stock=Item.stock - sale_data.quantity, updated_at=datetime.datetime.utcnow())
        )
        result = db.execute(stmt)
        
        # If no row was matched and updated, it's either missing or insufficient stock
        if result.rowcount == 0:
            item = db.query(Item).filter(Item.id == sale_data.item_id).first()
            if not item:
                exc = HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Item not found.",
                )
                setattr(exc, "code", "ITEM_NOT_FOUND")
                raise exc
            else:
                exc = HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Insufficient stock. Available: {item.stock}, Requested: {sale_data.quantity}.",
                )
                setattr(exc, "code", "INSUFFICIENT_STOCK")
                raise exc

        # Read the item to retrieve base price and details
        item = db.query(Item).filter(Item.id == sale_data.item_id).first()
        
        new_sale = Sale(
            item_id=item.id,
            quantity=sale_data.quantity,
            price_at_sale=item.base_price,
            timestamp=datetime.datetime.utcnow()
        )
        db.add(new_sale)
        
        # Commit the transaction atomically
        db.commit()
        db.refresh(new_sale)

        # Trigger Dynamic Price Recalculation (triggers pricing logs and updates in place)
        try:
            from services.pricing.router import run_recalculation
            run_recalculation(item, db)
        except Exception as pe:
            # Pricing failure should not block the core POS sale checkout from succeeding
            print(f"Dynamic pricing notification bypass: {pe}")

    except Exception as e:

        db.rollback()
        if isinstance(e, HTTPException):
            raise e
        # Raise generic internal error
        logger_exc = HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Transaction failed. Database rollback triggered.",
        )
        setattr(logger_exc, "code", "TRANSACTION_FAILED")
        raise logger_exc


    # Publish stock updated event asynchronously
    redis_manager.publish("stock.updated", {
        "item_id": item.id,
        "vendor_id": item.vendor_id,
        "new_stock": item.stock,
        "timestamp": str(new_sale.timestamp)
    })

    return new_sale
