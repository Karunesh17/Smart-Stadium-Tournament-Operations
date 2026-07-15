from typing import List, Dict, Any
from pydantic import BaseModel

class SalesByItem(BaseModel):
    item_name: str
    revenue: float
    quantity_sold: int

class SalesAnalytics(BaseModel):
    total_revenue: float
    total_transactions: int
    items_sold: int
    sales_by_item: List[SalesByItem]

class AreaOccupancy(BaseModel):
    area_name: str
    current_count: int
    capacity: int
    density: float

class CrowdAnalytics(BaseModel):
    total_stadium_occupancy: int
    occupancy_by_area: List[AreaOccupancy]

class StaffAnalytics(BaseModel):
    total_volunteers: int
    active_shifts: int
    task_completion_rate: float
    tasks_by_status: Dict[str, int]

class IncidentAnalytics(BaseModel):
    total_incidents: int
    incidents_by_severity: Dict[str, int]
    incidents_by_status: Dict[str, int]

class DashboardAnalyticsResponse(BaseModel):
    sales: SalesAnalytics
    crowd: CrowdAnalytics
    staff: StaffAnalytics
    incidents: IncidentAnalytics
    cached: bool = False
