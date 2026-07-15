import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from libs.shared_schemas.pricing import ForecastRequest, ForecastResponse, PriceHistoryResponse
from libs.shared_schemas.vendor import ItemResponse
from services.gateway.database import get_db
from services.auth.models import User
from services.auth.security import get_current_user, RoleChecker
from services.inventory.models import Item, Sale
from services.pricing.models import PriceHistory
from services.gateway.redis_client import redis_manager

router = APIRouter()

# Pricing Recalculation Engine
def run_recalculation(item: Item, db: Session) -> float:
    # 1. Enforce 30-second re-pricing cooldown check
    now = datetime.datetime.utcnow()
    latest_log = (
        db.query(PriceHistory)
        .filter(PriceHistory.item_id == item.id)
        .order_by(PriceHistory.timestamp.desc())
        .first()
    )
    if latest_log:
        elapsed = (now - latest_log.timestamp).total_seconds()
        if elapsed < 30.0:
            # Cooldown active: skip update and return current price
            return item.base_price

    # 2. Demand Velocity Heuristics (sales in last 5 minutes)
    five_minutes_ago = now - datetime.timedelta(minutes=5)
    recent_sales = (
        db.query(Sale)
        .filter(Sale.item_id == item.id, Sale.timestamp >= five_minutes_ago)
        .all()
    )
    sales_count = sum(s.quantity for s in recent_sales)
    # Velocity = units per minute
    velocity = sales_count / 5.0

    # 3. Stock Scarcity Factor
    # If stock is low, scale up to 1.5x price
    scarcity_factor = 1.0
    if item.stock < 50:
        scarcity_factor = 1.0 + (50 - item.stock) * 0.01

    # 4. Demand Velocity Factor
    # Scale up to 2.0x based on speed of checkout events
    demand_factor = 1.0 + min(velocity * 0.2, 1.0)

    # 5. Base Price Floor
    # Fallback to current base_price if original_price is not initialized
    base_floor = item.original_price if item.original_price is not None else item.base_price
    
    # Calculate target dynamic price
    new_price = base_floor * scarcity_factor * demand_factor
    
    # Enforce Price Bounds: Floor = 1.0x original, Ceiling = 2.5x original
    new_price = max(base_floor, min(new_price, base_floor * 2.5))
    new_price = round(new_price, 2)

    # 6. Apply & Log changes if changed
    if abs(new_price - item.base_price) >= 0.01:
        reason_parts = []
        if velocity > 0:
            reason_parts.append(f"Demand velocity at {round(velocity, 2)} units/min")
        if item.stock < 50:
            reason_parts.append(f"Stock scarcity at {item.stock} units left")
        reason = ", ".join(reason_parts) if reason_parts else "Periodic dynamic pricing recalculation"

        history_log = PriceHistory(
            item_id=item.id,
            old_price=item.base_price,
            new_price=new_price,
            reason=reason,
            timestamp=now
        )
        db.add(history_log)
        
        # Apply updated price directly to the item catalog
        item.base_price = new_price
        db.commit()

        # Publish update event to Redis channel
        redis_manager.publish("price.updated", {
            "item_id": item.id,
            "new_price": new_price,
            "timestamp": str(now)
        })

    return item.base_price


@router.post(
    "/recalculate/{item_id}",
    response_model=ItemResponse,
    status_code=status.HTTP_200_OK,
    summary="Trigger dynamic price recalculation for a concessions item"
)
def trigger_recalculation(item_id: int, db: Session = Depends(get_db)):
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        exc = HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found in catalog.",
        )
        setattr(exc, "code", "ITEM_NOT_FOUND")
        raise exc

    run_recalculation(item, db)
    db.refresh(item)
    return item


@router.post(
    "/forecast",
    response_model=ForecastResponse,
    status_code=status.HTTP_200_OK,
    summary="Compute projected dynamic pricing based on simulated demand parameters"
)
def get_price_forecast(
    forecast_data: ForecastRequest,
    db: Session = Depends(get_db)
):
    item = db.query(Item).filter(Item.id == forecast_data.item_id).first()
    if not item:
        exc = HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found in catalog.",
        )
        setattr(exc, "code", "ITEM_NOT_FOUND")
        raise exc

    # Compute projected calculations
    projected_velocity = forecast_data.projected_sales_quantity / 5.0
    projected_stock = max(0, item.stock - forecast_data.projected_sales_quantity)

    # Scarcity factor
    projected_scarcity = 1.0
    if projected_stock < 50:
        projected_scarcity = 1.0 + (50 - projected_stock) * 0.01

    # Demand factor
    projected_demand = 1.0 + min(projected_velocity * 0.2, 1.0)

    # Calculate projected price
    base_floor = item.original_price if item.original_price is not None else item.base_price
    projected_price = base_floor * projected_scarcity * projected_demand
    projected_price = max(base_floor, min(projected_price, base_floor * 2.5))
    projected_price = round(projected_price, 2)

    # Build confidence metric indicators
    confidence_basis = (
        f"Forecast based on simulated checkouts of {forecast_data.projected_sales_quantity} items. "
        f"Velocity shifts to {round(projected_velocity, 2)} units/min, with projected inventory depletion to {projected_stock}."
    )
    confidence_score = 0.85 if item.stock >= forecast_data.projected_sales_quantity else 0.40

    return ForecastResponse(
        projected_price=projected_price,
        confidence_basis=confidence_basis,
        confidence_score=confidence_score
    )


@router.get(
    "/history",
    response_model=List[PriceHistoryResponse],
    status_code=status.HTTP_200_OK,
    summary="Query audit history logs for dynamic price updates"
)
def list_pricing_history(
    item_id: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(PriceHistory)
    if item_id is not None:
        query = query.filter(PriceHistory.item_id == item_id)
    return query.all()
