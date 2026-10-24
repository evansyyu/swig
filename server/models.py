"""Tables for accounts. The scale's live detection state stays in tracker.py (memory)."""
import uuid
from datetime import date, datetime, timezone

from sqlalchemy import JSON, Boolean, Date, DateTime, Float, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from db import Base


def utcnow():
    return datetime.now(timezone.utc)


def new_id():
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    username: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    # Settings (same names and ranges as /api/settings)
    timezone: Mapped[str] = mapped_column(String(64), default="America/New_York")
    goal_ml: Mapped[int] = mapped_column(Integer, default=2000)
    interval_min: Mapped[int] = mapped_column(Integer, default=60)
    start_hour: Mapped[int] = mapped_column(Integer, default=9)
    end_hour: Mapped[int] = mapped_column(Integer, default=22)
    lock_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    empty_g: Mapped[float | None] = mapped_column(Float, nullable=True)


class UserState(Base):
    """Per-user lock state machine and last event, reset each day (mirrors tracker.py)."""

    __tablename__ = "user_states"

    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    day: Mapped[date] = mapped_column(Date)
    was_critical: Mapped[bool] = mapped_column(Boolean, default=False)
    lock_apps: Mapped[bool] = mapped_column(Boolean, default=False)
    last_drink_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_event: Mapped[dict | None] = mapped_column(JSON, nullable=True)


class DayLog(Base):
    """One row per user per local day. `goal_ml` is a snapshot so later goal changes don't rewrite history."""

    __tablename__ = "day_logs"
    __table_args__ = (UniqueConstraint("user_id", "day"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    day: Mapped[date] = mapped_column(Date, index=True)
    goal_ml: Mapped[int] = mapped_column(Integer)
    consumed_ml: Mapped[int] = mapped_column(Integer, default=0)
    met_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, index=True)


class Intake(Base):
    """A drink, refill or baseline from the scale, or a manual log from the app.

    `id` is a UUID. The app generates it for manual logs so retries from its offline
    outbox are idempotent. `amount_ml` is what counts toward the day; `detail_ml` is
    the water in the bottle (baseline) or the water added (refill).
    """

    __tablename__ = "intakes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    day: Mapped[date] = mapped_column(Date, index=True)
    kind: Mapped[str] = mapped_column(String(16))  # drink | refill | baseline | manual
    source: Mapped[str] = mapped_column(String(16))  # scale | app
    amount_ml: Mapped[int] = mapped_column(Integer, default=0)
    detail_ml: Mapped[int | None] = mapped_column(Integer, nullable=True)
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    voided: Mapped[bool] = mapped_column(Boolean, default=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, index=True)


class Meta(Base):
    """Small server-wide values, e.g. which user owns the (single) scale."""

    __tablename__ = "meta"

    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    value: Mapped[str] = mapped_column(String(255))
