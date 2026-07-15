import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, CheckConstraint
from services.gateway.database import Base

class Area(Base):
    __tablename__ = "area"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True)
    capacity = Column(Integer, nullable=False)

    __table_args__ = (
        CheckConstraint("capacity > 0", name="check_positive_capacity"),
    )

class CrowdData(Base):
    __tablename__ = "crowd_data"

    id = Column(Integer, primary_key=True, index=True)
    area_id = Column(Integer, ForeignKey("area.id", ondelete="RESTRICT"), nullable=False)
    count = Column(Integer, nullable=False)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    __table_args__ = (
        CheckConstraint("count >= 0", name="check_positive_count"),
    )
