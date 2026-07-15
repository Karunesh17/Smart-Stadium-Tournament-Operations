import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from libs.shared_schemas.risk import IncidentCreate, IncidentOverride, IncidentResponse
from services.gateway.database import get_db
from services.auth.models import User
from services.auth.security import get_current_user, RoleChecker
from services.crowd.models import Area, CrowdData
from services.staff.models import Staff, Task
from services.staff.router import ws_manager
from services.risk.models import Incident

router = APIRouter()

# Helper to compute severity score and map level
def compute_severity(area_id: int, incident_type: str, db: Session):
    # 1. Type multiplier
    type_multipliers = {
        "fire": 3.0,
        "medical": 2.5,
        "security": 2.0,
        "structural": 2.5,
        "general": 1.0
    }
    type_mult = type_multipliers.get(incident_type.lower(), 1.0)

    # 2. Crowd density multiplier
    area = db.query(Area).filter(Area.id == area_id).first()
    if not area:
        exc = HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Area sector not found.",
        )
        setattr(exc, "code", "AREA_NOT_FOUND")
        raise exc

    latest_reading = (
        db.query(CrowdData)
        .filter(CrowdData.area_id == area_id)
        .order_by(CrowdData.timestamp.desc(), CrowdData.id.desc())
        .first()
    )
    current_count = latest_reading.count if latest_reading else 0
    density_percentage = (current_count / area.capacity) * 100 if area.capacity > 0 else 0.0
    density_mult = 1.0 + (density_percentage / 100.0)

    # 3. Time of day multiplier (Night hours: 18:00 - 06:00 UTC get 1.5x)
    current_hour = datetime.datetime.utcnow().hour
    time_mult = 1.5 if (current_hour >= 18 or current_hour < 6) else 1.0

    # Calculate score
    score = type_mult * density_mult * time_mult
    
    # Map to level
    if score >= 6.0:
        level = "critical"
    elif score >= 4.0:
        level = "high"
    elif score >= 2.0:
        level = "medium"
    elif score >= 1.0:
        level = "low"
    else:
        level = "info"

    return round(score, 2), level


# Helper to auto-create and escalate tasks inside the Staff service
async def escalate_incident_task(incident: Incident, area_name: str, db: Session):
    # Check if a task was already created for this incident to avoid duplicates
    existing_task = db.query(Task).filter(Task.description.like(f"%Incident #{incident.id}%")).first()
    if existing_task:
        return

    # Attempt to auto-assign based on specialty matching
    assigned_staff_id = None
    specialty_mapping = {
        "medical": "medical",
        "security": "security"
    }
    
    target_specialty = specialty_mapping.get(incident.type.lower())
    if target_specialty:
        # Find staff member with this role specialty
        specialist = db.query(Staff).filter(Staff.role_specialty.ilike(target_specialty)).first()
        if specialist:
            assigned_staff_id = specialist.id

    # Create task
    task_desc = f"Incident #{incident.id} - Type: {incident.type.upper()} | Severity: {incident.severity_level.upper()} | Location: {area_name}. Details: {incident.description or 'None'}"
    new_task = Task(
        assigned_staff_id=assigned_staff_id,
        title=f"[ALERT] Auto-Escalated: {incident.title}",
        description=task_desc,
        status="open"
    )
    db.add(new_task)
    db.commit()
    db.refresh(new_task)

    # Trigger live WS push to staff if assigned
    if assigned_staff_id is not None:
        ws_payload = {
            "event": "task_assigned",
            "data": {
                "id": new_task.id,
                "title": new_task.title,
                "description": new_task.description,
                "status": new_task.status
            }
        }
        await ws_manager.broadcast_to_staff(assigned_staff_id, ws_payload)


@router.post(
    "/",
    response_model=IncidentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="File a new venue security incident report"
)
async def create_incident(
    incident_data: IncidentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify area exists and compute severity
    area = db.query(Area).filter(Area.id == incident_data.area_id).first()
    if not area:
        exc = HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Area sector not found.",
        )
        setattr(exc, "code", "AREA_NOT_FOUND")
        raise exc

    score, level = compute_severity(incident_data.area_id, incident_data.type, db)

    new_incident = Incident(
        title=incident_data.title,
        description=incident_data.description,
        type=incident_data.type.lower(),
        area_id=incident_data.area_id,
        severity_score=score,
        severity_level=level,
        status="reported",
        is_overridden=False
    )
    db.add(new_incident)
    db.commit()
    db.refresh(new_incident)

    # Auto-escalation checks
    if level in ["high", "critical"]:
        await escalate_incident_task(new_incident, area.name, db)

    return new_incident


@router.get(
    "/",
    response_model=List[IncidentResponse],
    status_code=status.HTTP_200_OK,
    summary="List active incident reports"
)
def list_incidents(
    status_filter: Optional[str] = Query(None, alias="status"),
    severity_filter: Optional[str] = Query(None, alias="severity"),
    db: Session = Depends(get_db)
):
    query = db.query(Incident)
    if status_filter is not None:
        query = query.filter(Incident.status == status_filter)
    if severity_filter is not None:
        query = query.filter(Incident.severity_level == severity_filter)
    return query.all()


@router.patch(
    "/{incident_id}/override",
    response_model=IncidentResponse,
    status_code=status.HTTP_200_OK,
    summary="Manually override risk severity level (resolves false negatives)"
)
async def override_severity(
    incident_id: int,
    override_data: IncidentOverride,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["admin", "security"]))
):
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        exc = HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Incident report not found.",
        )
        setattr(exc, "code", "INCIDENT_NOT_FOUND")
        raise exc

    new_level = override_data.severity_level.lower()
    incident.severity_level = new_level
    incident.is_overridden = True
    db.commit()
    db.refresh(incident)

    # Recheck auto-escalation based on manual level override
    if new_level in ["high", "critical"]:
        area = db.query(Area).filter(Area.id == incident.area_id).first()
        area_name = area.name if area else f"Area #{incident.area_id}"
        await escalate_incident_task(incident, area_name, db)

    return incident


@router.patch(
    "/{incident_id}/status",
    response_model=IncidentResponse,
    status_code=status.HTTP_200_OK,
    summary="Update incident resolution status"
)
def update_incident_status(
    incident_id: int,
    status_data: dict,  # Expects {"status": "reported/assigned/resolved"}
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["admin", "security"]))
):
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        exc = HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Incident report not found.",
        )
        setattr(exc, "code", "INCIDENT_NOT_FOUND")
        raise exc

    new_status = status_data.get("status")
    if new_status not in ["reported", "assigned", "resolved"]:
        exc = HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Status must be one of: reported, assigned, resolved",
        )
        setattr(exc, "code", "INVALID_STATUS")
        raise exc

    incident.status = new_status
    db.commit()
    db.refresh(incident)

    # If resolved, automatically resolve all related tasks to "done"
    if new_status == "resolved":
        tasks = db.query(Task).filter(Task.description.like(f"%Incident #{incident.id}%")).all()
        for t in tasks:
            t.status = "done"
        db.commit()

    return incident
