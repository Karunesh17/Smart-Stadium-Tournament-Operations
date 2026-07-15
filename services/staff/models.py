import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, CheckConstraint
from services.gateway.database import Base

class Staff(Base):
    __tablename__ = "staff"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("user.id", ondelete="CASCADE"), unique=True, nullable=False)
    role_specialty = Column(String, nullable=False)

class Shift(Base):
    __tablename__ = "shift"

    id = Column(Integer, primary_key=True, index=True)
    staff_id = Column(Integer, ForeignKey("staff.id", ondelete="CASCADE"), nullable=False)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    zone = Column(String, nullable=False)

class Task(Base):
    __tablename__ = "task"

    id = Column(Integer, primary_key=True, index=True)
    assigned_staff_id = Column(Integer, ForeignKey("staff.id", ondelete="SET NULL"), nullable=True)
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    status = Column(String, default="open", nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    __table_args__ = (
        CheckConstraint("status IN ('open', 'in-progress', 'done')", name="check_valid_task_status"),
    )
