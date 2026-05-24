from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from app.core.config import settings


def _build_engine():
    url = settings.database_url

    # Normalise Neon / Heroku postgres:// → postgresql+psycopg:// (psycopg v3)
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+psycopg://", 1)
    elif url.startswith("postgresql://") and "+psycopg" not in url and "+psycopg2" not in url:
        url = url.replace("postgresql://", "postgresql+psycopg://", 1)

    if url.startswith("sqlite"):
        # SQLite: disable same-thread check so FastAPI threads share one file
        return create_engine(url, connect_args={"check_same_thread": False})

    # PostgreSQL (Neon, Railway Postgres, etc.)
    # pool_pre_ping drops stale connections — critical for Neon serverless which
    # pauses compute after 5 min idle and closes existing TCP connections.
    return create_engine(
        url,
        pool_size=5,       # persistent connections per worker
        max_overflow=10,   # burst headroom
        pool_pre_ping=True,
        pool_recycle=300,  # recycle every 5 min (before Neon's idle timeout)
    )


engine = _build_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
