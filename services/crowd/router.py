import datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from libs.shared_schemas.crowd import AreaCreate, AreaResponse, TelemetryIngest, CrowdDataResponse, HeatmapResponse, HeatmapArea
from services.gateway.database import get_db
from services.auth.models import User
from services.auth.security import get_current_user, RoleChecker
from services.crowd.models import Area, CrowdData
from services.gateway.redis_client import redis_manager

router = APIRouter()

@router.post(
    "/areas",
    response_model=AreaResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Define a new stadium physical monitoring area"
)
def create_area(
    area_data: AreaCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["admin", "security"]))
):
    existing = db.query(Area).filter(Area.name == area_data.name).first()
    if existing:
        exc = HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An area with this name already exists.",
        )
        setattr(exc, "code", "AREA_ALREADY_EXISTS")
        raise exc

    new_area = Area(
        name=area_data.name,
        capacity=area_data.capacity
    )
    db.add(new_area)
    db.commit()
    db.refresh(new_area)
    return new_area

@router.get(
    "/areas",
    response_model=List[AreaResponse],
    status_code=status.HTTP_200_OK,
    summary="List all defined monitoring areas"
)
def list_areas(
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db)
):
    areas = db.query(Area).offset(offset).limit(limit).all()
    return areas

@router.post(
    "/telemetry",
    response_model=CrowdDataResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Ingest simulated BLE/CCTV sensor crowd headcount aggregate counts"
)
def ingest_telemetry(
    telemetry_data: TelemetryIngest,
    db: Session = Depends(get_db)
):
    # Verify the target area exists
    area = db.query(Area).filter(Area.id == telemetry_data.area_id).first()
    if not area:
        exc = HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Area sector not found.",
        )
        setattr(exc, "code", "AREA_NOT_FOUND")
        raise exc

    new_data = CrowdData(
        area_id=telemetry_data.area_id,
        count=telemetry_data.count,
        timestamp=datetime.datetime.utcnow()
    )
    db.add(new_data)
    db.commit()
    db.refresh(new_data)

    # Publish crowd updated event to Redis
    redis_manager.publish("crowd.updated", {
        "area_id": new_data.area_id,
        "count": new_data.count,
        "timestamp": str(new_data.timestamp)
    })

    return new_data

@router.get(
    "/heatmap",
    response_model=HeatmapResponse,
    status_code=status.HTTP_200_OK,
    summary="Retrieve calculated real-time zone occupancies and densities"
)
def get_heatmap(db: Session = Depends(get_db)):
    areas = db.query(Area).all()
    heatmap_areas = []

    for area in areas:
        # Retrieve the latest occupancy reading for this area
        latest_reading = (
            db.query(CrowdData)
            .filter(CrowdData.area_id == area.id)
            .order_by(CrowdData.timestamp.desc(), CrowdData.id.desc())
            .first()
        )
        current_count = latest_reading.count if latest_reading else 0
        
        # Calculate density percentage
        density = (current_count / area.capacity) * 100 if area.capacity > 0 else 0.0
        
        # Determine status pill color gating
        if density >= 90.0:
            status_label = "danger"
        elif density >= 70.0:
            status_label = "warning"
        else:
            status_label = "safe"

        heatmap_areas.append(
            HeatmapArea(
                area_id=area.id,
                name=area.name,
                capacity=area.capacity,
                current_count=current_count,
                density_percentage=round(density, 2),
                status=status_label
            )
        )

    return HeatmapResponse(
        areas=heatmap_areas,
        updated_at=datetime.datetime.utcnow()
    )
