"""Database for accounts, intake history and streaks (SQLAlchemy).

DATABASE_URL picks the database: Railway's Postgres in production, or a SQLite
file in server/data/ when it is unset. Tables are created on startup.
"""
import os
from contextlib import contextmanager
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker


def database_url():
    url = os.environ.get("DATABASE_URL")
    if not url:
        data = Path(__file__).resolve().parent / "data"
        data.mkdir(exist_ok=True)
        return f"sqlite:///{data / 'water.db'}"
    # Railway hands out postgres:// URLs; SQLAlchemy needs the driver named.
    for prefix in ("postgres://", "postgresql://"):
        if url.startswith(prefix):
            return "postgresql+psycopg://" + url[len(prefix):]
    return url


class Base(DeclarativeBase):
    pass


_url = database_url()
engine = create_engine(
    _url,
    connect_args={"check_same_thread": False} if _url.startswith("sqlite") else {},
    pool_pre_ping=not _url.startswith("sqlite"),
)
SessionLocal = sessionmaker(engine, expire_on_commit=False)


def init_db():
    import models  # noqa: F401  (registers the tables)

    Base.metadata.create_all(engine)


@contextmanager
def session_scope():
    """One unit of work: commits on success, rolls back on error."""
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except BaseException:
        session.rollback()
        raise
    finally:
        session.close()
