import datetime
from sqlalchemy import Column, Integer, String, DateTime, CheckConstraint
from services.gateway.database import Base

class User(Base):
    __tablename__ = "user"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    __table_args__ = (
        CheckConstraint(
            "role IN ('fan', 'staff', 'vendor', 'security', 'admin')",
            name="check_valid_role"
        ),
    )
