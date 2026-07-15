import datetime
from typing import List, Dict, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from libs.shared_schemas.staff import StaffCreate, StaffResponse, ShiftCreate, ShiftResponse, TaskCreate, TaskUpdate, TaskResponse
from services.gateway.database import get_db
from services.auth.models import User
from services.auth.security import get_current_user, RoleChecker
from services.staff.models import Staff, Shift, Task

router = APIRouter()

# WebSocket active connection pool manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, List[WebSocket]] = {}

    async def connect(self, staff_id: int, websocket: WebSocket):
        await websocket.accept()
        if staff_id not in self.active_connections:
            self.active_connections[staff_id] = []
        self.active_connections[staff_id].append(websocket)

    def disconnect(self, staff_id: int, websocket: WebSocket):
        if staff_id in self.active_connections:
            if websocket in self.active_connections[staff_id]:
                self.active_connections[staff_id].remove(websocket)
            if not self.active_connections[staff_id]:
                del self.active_connections[staff_id]

    async def broadcast_to_staff(self, staff_id: int, message: dict):
        if staff_id in self.active_connections:
            for ws in self.active_connections[staff_id]:
                try:
                    await ws.send_json(message)
                except Exception:
                    pass

ws_manager = ConnectionManager()


@router.post(
    "/profile",
    response_model=StaffResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new staff member profile"
)
def create_staff_profile(
    staff_data: StaffCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["admin"]))
):
    # Verify user exists
    target_user = db.query(User).filter(User.id == staff_data.user_id).first()
    if not target_user:
        exc = HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )
        setattr(exc, "code", "USER_NOT_FOUND")
        raise exc

    # Verify user doesn't already have a staff profile
    existing = db.query(Staff).filter(Staff.user_id == staff_data.user_id).first()
    if existing:
        exc = HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A staff profile already exists for this user.",
        )
        setattr(exc, "code", "STAFF_ALREADY_EXISTS")
        raise exc

    new_staff = Staff(
        user_id=staff_data.user_id,
        role_specialty=staff_data.role_specialty
    )
    db.add(new_staff)
    db.commit()
    db.refresh(new_staff)
    return new_staff


@router.get(
    "/profile",
    response_model=StaffResponse,
    status_code=status.HTTP_200_OK,
    summary="Get current staff profile details"
)
def get_staff_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    profile = db.query(Staff).filter(Staff.user_id == current_user.id).first()
    if not profile:
        exc = HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Staff profile not found.",
        )
        setattr(exc, "code", "STAFF_NOT_FOUND")
        raise exc
    return profile


@router.post(
    "/shifts",
    response_model=ShiftResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Schedule a staff shift"
)
async def create_shift(
    shift_data: ShiftCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["admin"]))
):
    # Check if target staff exists
    staff = db.query(Staff).filter(Staff.id == shift_data.staff_id).first()
    if not staff:
        exc = HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Staff member not found.",
        )
        setattr(exc, "code", "STAFF_NOT_FOUND")
        raise exc

    new_shift = Shift(
        staff_id=shift_data.staff_id,
        start_time=shift_data.start_time,
        end_time=shift_data.end_time,
        zone=shift_data.zone
    )
    db.add(new_shift)
    db.commit()
    db.refresh(new_shift)

    # Push live notification of shift update over WebSocket
    ws_payload = {
        "event": "shift_assigned",
        "data": {
            "id": new_shift.id,
            "zone": new_shift.zone,
            "start_time": str(new_shift.start_time),
            "end_time": str(new_shift.end_time)
        }
    }
    await ws_manager.broadcast_to_staff(new_shift.staff_id, ws_payload)

    return new_shift



@router.get(
    "/shifts",
    response_model=List[ShiftResponse],
    status_code=status.HTTP_200_OK,
    summary="List active shift schedules"
)
def list_shifts(
    staff_id: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(Shift)
    if staff_id is not None:
        query = query.filter(Shift.staff_id == staff_id)
    return query.all()


@router.post(
    "/tasks",
    response_model=TaskResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create and allocate a task"
)
async def create_task(
    task_data: TaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["admin"]))
):
    # If assigned, check if target staff exists
    if task_data.assigned_staff_id is not None:
        staff = db.query(Staff).filter(Staff.id == task_data.assigned_staff_id).first()
        if not staff:
            exc = HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Staff member not found.",
            )
            setattr(exc, "code", "STAFF_NOT_FOUND")
            raise exc

    new_task = Task(
        assigned_staff_id=task_data.assigned_staff_id,
        title=task_data.title,
        description=task_data.description,
        status="open"
    )
    db.add(new_task)
    db.commit()
    db.refresh(new_task)

    # If assigned, push notification over WS
    if new_task.assigned_staff_id is not None:
        ws_payload = {
            "event": "task_assigned",
            "data": {
                "id": new_task.id,
                "title": new_task.title,
                "description": new_task.description,
                "status": new_task.status
            }
        }
        await ws_manager.broadcast_to_staff(new_task.assigned_staff_id, ws_payload)

    return new_task



@router.get(
    "/tasks",
    response_model=List[TaskResponse],
    status_code=status.HTTP_200_OK,
    summary="List assigned tasks"
)
def list_tasks(
    assigned_staff_id: Optional[int] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    db: Session = Depends(get_db)
):
    query = db.query(Task)
    if assigned_staff_id is not None:
        query = query.filter(Task.assigned_staff_id == assigned_staff_id)
    if status_filter is not None:
        query = query.filter(Task.status == status_filter)
    return query.all()


@router.patch(
    "/tasks/{task_id}",
    response_model=TaskResponse,
    status_code=status.HTTP_200_OK,
    summary="Update task status (validates state transition constraints)"
)
async def update_task_status(
    task_id: int,
    task_update: TaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        exc = HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found.",
        )
        setattr(exc, "code", "TASK_NOT_FOUND")
        raise exc

    # Find the current user's staff profile if not Admin
    current_staff = None
    if current_user.role != "admin":
        current_staff = db.query(Staff).filter(Staff.user_id == current_user.id).first()
        if not current_staff or task.assigned_staff_id != current_staff.id:
            exc = HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You are not assigned to this task.",
            )
            setattr(exc, "code", "FORBIDDEN")
            raise exc

    # Enforce strict transition constraint: open -> in-progress -> done
    valid_transitions = {
        "open": ["in-progress"],
        "in-progress": ["done"],
        "done": []
    }
    
    new_status = task_update.status
    if new_status not in valid_transitions.get(task.status, []):
        exc = HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid task status transition from '{task.status}' to '{new_status}'.",
        )
        setattr(exc, "code", "INVALID_STATUS_TRANSITION")
        raise exc

    # Apply update
    task.status = new_status
    db.commit()
    db.refresh(task)

    # Push event notifications
    if task.assigned_staff_id is not None:
        ws_payload = {
            "event": "task_status_updated",
            "data": {
                "id": task.id,
                "title": task.title,
                "status": task.status
            }
        }
        await ws_manager.broadcast_to_staff(task.assigned_staff_id, ws_payload)

    return task



@router.websocket("/ws/{staff_id}")
async def staff_websocket_endpoint(websocket: WebSocket, staff_id: int, db: Session = Depends(get_db)):
    # 1. Verify target staff member exists before accepting
    staff = db.query(Staff).filter(Staff.id == staff_id).first()
    if not staff:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    # 2. Add connection to pool
    await ws_manager.connect(staff_id, websocket)
    
    # 3. WebSocket sync fallback: immediately query and send unread/outstanding tasks
    outstanding_tasks = (
        db.query(Task)
        .filter(Task.assigned_staff_id == staff_id, Task.status.in_(["open", "in-progress"]))
        .all()
    )
    backlog_payload = {
        "event": "backlog_sync",
        "data": [
            {
                "id": t.id,
                "title": t.title,
                "description": t.description,
                "status": t.status
            }
            for t in outstanding_tasks
        ]
    }
    try:
        await websocket.send_json(backlog_payload)
    except Exception:
        ws_manager.disconnect(staff_id, websocket)
        return

    # 4. Connection listening loop
    try:
        while True:
            # Keep connection open, ignore incoming client telemetry messages
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        ws_manager.disconnect(staff_id, websocket)
