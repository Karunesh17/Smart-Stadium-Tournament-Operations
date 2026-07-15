import os
from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Retrieve database connection string from environment, fallback to SQLite locally
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./smart_stadium.db")

# SQLite needs special arguments to allow multi-threaded access in development/testing
connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(DATABASE_URL, connect_args=connect_args)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# FastAPI dependency to yield database sessions
def get_db() -> Generator:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
