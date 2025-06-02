"""
Database configuration and session management
"""
from sqlalchemy import create_engine, event
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import QueuePool, NullPool
import os
import logging

logger = logging.getLogger(__name__)

# Database URL from environment variable
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./db.sqlite3")

# Create engine with proper pooling configuration
if DATABASE_URL.startswith("sqlite"):
    # SQLite doesn't benefit from connection pooling
    engine = create_engine(
        DATABASE_URL, 
        connect_args={"check_same_thread": False},
        echo=False,
        poolclass=NullPool  # No connection pooling for SQLite
    )
    
    # Configure SQLite for better concurrent access
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")  # Write-Ahead Logging
        cursor.execute("PRAGMA synchronous=NORMAL")  # Better performance
        cursor.execute("PRAGMA busy_timeout=5000")  # 5 second timeout
        cursor.execute("PRAGMA temp_store=MEMORY")  # Use memory for temp tables
        cursor.close()
else:
    # For PostgreSQL, MySQL, etc.
    engine = create_engine(
        DATABASE_URL, 
        echo=False,
        poolclass=QueuePool,
        pool_size=20,  # Number of connections to maintain
        max_overflow=40,  # Maximum overflow connections
        pool_timeout=30,  # Timeout for getting connection from pool
        pool_recycle=3600,  # Recycle connections after 1 hour
        pool_pre_ping=True  # Verify connections before using
    )

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for models
Base = declarative_base()


def get_db():
    """Dependency to get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    """Create all tables"""
    import models
    models.Base.metadata.create_all(bind=engine)