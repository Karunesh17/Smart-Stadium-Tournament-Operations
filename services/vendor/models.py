from sqlalchemy import Column, Integer, String, Float, ForeignKey
from services.gateway.database import Base

class Vendor(Base):
    __tablename__ = "vendor"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    type = Column(String, nullable=False)
    rating = Column(Float, nullable=True)
    owner_user_id = Column(Integer, ForeignKey("user.id", ondelete="RESTRICT"), nullable=False)
