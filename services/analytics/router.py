import json
import datetime
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from libs.shared_schemas.analytics import (
    DashboardAnalyticsResponse,
    SalesAnalytics,
    SalesByItem,
    CrowdAnalytics,
    AreaOccupancy,
    StaffAnalytics,
    IncidentAnalytics
)
from services.gateway.database import get_db
from services.auth.models import User
from services.auth.security import RoleChecker
from services.inventory.models import Item, Sale
from services.crowd.models import Area, CrowdData
from services.staff.models import Staff, Shift, Task
from services.risk.models import Incident
from services.gateway.redis_client import redis_manager

router = APIRouter()

@router.get(
    "/dashboard",
    response_model=DashboardAnalyticsResponse,
    status_code=status.HTTP_200_OK,
    summary="Fetch aggregated cross-module KPI analytics reports for stadium operators"
)
def get_analytics_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["admin", "security"]))
):
    # 1. Enforce Caching Layer check
    cache_key = "analytics:dashboard:cache"
    try:
        cached_data = redis_manager.get(cache_key)
        if cached_data:
            data = json.loads(cached_data)
            data["cached"] = True
            return data
    except Exception as ce:
        print(f"Redis cache retrieve bypass: {ce}")

    now = datetime.datetime.utcnow()

    # 2. Concession Sales Aggregation Queries
    sales = db.query(Sale).all()
    items = db.query(Item).all()
    item_map = {item.id: item.name for item in items}

    total_revenue = sum(s.quantity * s.price_at_sale for s in sales)
    total_transactions = len(sales)
    items_sold = sum(s.quantity for s in sales)

    # Group sales by item name
    sales_by_item_map = {}
    for s in sales:
        item_name = item_map.get(s.item_id, f"Item #{s.item_id}")
        if item_name not in sales_by_item_map:
            sales_by_item_map[item_name] = {"revenue": 0.0, "quantity_sold": 0}
        sales_by_item_map[item_name]["revenue"] += s.quantity * s.price_at_sale
        sales_by_item_map[item_name]["quantity_sold"] += s.quantity

    sales_by_item_list = [
        SalesByItem(
            item_name=name,
            revenue=round(stats["revenue"], 2),
            quantity_sold=stats["quantity_sold"]
        )
        for name, stats in sales_by_item_map.items()
    ]

    sales_analytics = SalesAnalytics(
        total_revenue=round(total_revenue, 2),
        total_transactions=total_transactions,
        items_sold=items_sold,
        sales_by_item=sales_by_item_list
    )

    # 3. Crowd Heatmap Occupancy Queries
    areas = db.query(Area).all()
    occupancy_by_area = []
    total_stadium_occupancy = 0

    for area in areas:
        # Get latest telemetry swept crowd count
        latest_telemetry = (
            db.query(CrowdData)
            .filter(CrowdData.area_id == area.id)
            .order_by(CrowdData.timestamp.desc())
            .first()
        )
        count = latest_telemetry.count if latest_telemetry else 0
        total_stadium_occupancy += count
        density = (count / area.capacity) if area.capacity > 0 else 0.0

        occupancy_by_area.append(
            AreaOccupancy(
                area_name=area.name,
                current_count=count,
                capacity=area.capacity,
                density=round(density, 4)
            )
        )

    crowd_analytics = CrowdAnalytics(
        total_stadium_occupancy=total_stadium_occupancy,
        occupancy_by_area=occupancy_by_area
    )

    # 4. Staff Utilization Queries
    total_volunteers = db.query(Staff).count()
    active_shifts = db.query(Shift).filter(Shift.end_time >= now, Shift.start_time <= now).count()

    tasks = db.query(Task).all()
    tasks_count = len(tasks)
    done_tasks_count = sum(1 for t in tasks if t.status == "done")
    task_completion_rate = (done_tasks_count / tasks_count) if tasks_count > 0 else 0.0

    tasks_by_status = {"open": 0, "in-progress": 0, "done": 0}
    for t in tasks:
        if t.status in tasks_by_status:
            tasks_by_status[t.status] += 1

    staff_analytics = StaffAnalytics(
        total_volunteers=total_volunteers,
        active_shifts=active_shifts,
        task_completion_rate=round(task_completion_rate, 4),
        tasks_by_status=tasks_by_status
    )

    # 5. Incident Frequency Queries
    incidents = db.query(Incident).all()
    total_incidents = len(incidents)

    incidents_by_severity = {"info": 0, "low": 0, "medium": 0, "high": 0, "critical": 0}
    incidents_by_status = {"reported": 0, "assigned": 0, "resolved": 0}

    for inc in incidents:
        if inc.severity_level in incidents_by_severity:
            incidents_by_severity[inc.severity_level] += 1
        if inc.status in incidents_by_status:
            incidents_by_status[inc.status] += 1

    incident_analytics = IncidentAnalytics(
        total_incidents=total_incidents,
        incidents_by_severity=incidents_by_severity,
        incidents_by_status=incidents_by_status
    )

    # Combine response
    response_payload = DashboardAnalyticsResponse(
        sales=sales_analytics,
        crowd=crowd_analytics,
        staff=staff_analytics,
        incidents=incident_analytics,
        cached=False
    )

    # Cache payload in Redis with 5 seconds TTL
    try:
        redis_manager.set(cache_key, json.dumps(response_payload.model_dump()), ex=5)
    except Exception as ce:
        print(f"Redis cache save bypass: {ce}")

    return response_payload
