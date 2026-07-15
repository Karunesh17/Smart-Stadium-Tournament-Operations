import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, CheckConstraint
from services.gateway.database import Base

class Incident(Base):
    __tablename__ = "incident"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    type = Column(String, nullable=False)
    area_id = Column(Integer, ForeignKey("area.id", ondelete="RESTRICT"), nullable=False)
    severity_score = Column(Float, nullable=False)
    severity_level = Column(String, nullable=False)
    status = Column(String, default="reported", nullable=False)
    is_overridden = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    __table_args__ = (
        CheckConstraint("status IN ('reported', 'assigned', 'resolved')", name="check_valid_incident_status"),
        CheckConstraint("severity_level IN ('info', 'low', 'medium', 'high', 'critical')", name="check_valid_incident_severity"),
    )
