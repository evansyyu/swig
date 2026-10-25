"""Per-user progress, streaks, leaderboard and offline sync. Database logic only, no HTTP.

Status and app lock follow the same rules as the single-scale tracker (docs/API.md),
computed from each user's intake history in their own timezone. The one physical
scale belongs to the user who last saved an empty bottle weight from it.
"""
import math
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import func, select

from models import DayLog, Intake, Meta, User, UserState
from tracker import ValidationError, compute_status, expected_ml

SCALE_OWNER_KEY = "scale_owner"
STREAK_LOOKBACK_DAYS = 400
INITIAL_INTAKE_DAYS = 35
INITIAL_HISTORY_DAYS = 120
MAX_BACKDATE = timedelta(days=7)
# Pulls re-send rows updated this long before the cursor, so a row committed by
# another request while this one was reading is never missed. The app upserts.
SYNC_OVERLAP = timedelta(seconds=10)

SETTINGS_RANGES = {"goal_ml": (250, 6000), "interval_min": (1, 240), "start_hour": (0, 23), "end_hour": (1, 24)}
SETTINGS_FIELDS = set(SETTINGS_RANGES) | {"lock_enabled", "timezone"}
TRACKER_FIELDS = ("goal_ml", "interval_min", "start_hour", "end_hour")


# ---- time helpers ----
def as_utc(dt):
    """SQLite drops tzinfo; everything is stored in UTC, so naive means UTC."""
    if dt is None:
        return None
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt.astimezone(timezone.utc)


def iso(dt):
    return None if dt is None else as_utc(dt).isoformat(timespec="seconds")


def parse_iso(value, field):
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (AttributeError, ValueError):
        raise ValidationError("invalid_value", f"{field} must be an ISO 8601 time") from None
    return as_utc(dt)


def check_timezone(name):
    try:
        ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError, TypeError):
        raise ValidationError("invalid_value", f"unknown timezone {name!r}") from None
    return name


def tz_of(user):
    try:
        return ZoneInfo(user.timezone)
    except (ZoneInfoNotFoundError, ValueError):
        return ZoneInfo("UTC")


def local_day(user, at):
    return as_utc(at).astimezone(tz_of(user)).date()


def _hour_float(local):
    return local.hour + local.minute / 60 + local.second / 3600


# ---- settings ----
def validate_settings(patch, user):
    if not isinstance(patch, dict):
        raise ValidationError("invalid_value", "settings must be a JSON object")
    unknown = set(patch) - SETTINGS_FIELDS
    if unknown:
        raise ValidationError("unknown_field", "unknown field(s): " + ", ".join(sorted(unknown)))
    for key, (lo, hi) in SETTINGS_RANGES.items():
        if key in patch:
            value = patch[key]
            if isinstance(value, bool) or not isinstance(value, int) or not lo <= value <= hi:
                raise ValidationError("invalid_value", f"{key} must be an integer from {lo} to {hi}")
    if "lock_enabled" in patch and not isinstance(patch["lock_enabled"], bool):
        raise ValidationError("invalid_value", "lock_enabled must be true or false")
    if "timezone" in patch:
        check_timezone(patch["timezone"])
    start = patch.get("start_hour", user.start_hour)
    end = patch.get("end_hour", user.end_hour)
    if end <= start:
        raise ValidationError("invalid_value", "end_hour must be greater than start_hour")


def apply_settings(session, user, patch, now):
    validate_settings(patch, user)
    for key, value in patch.items():
        setattr(user, key, value)
    # Today's goal follows the setting; earlier days keep the goal they had.
    log = _day_log(session, user, local_day(user, now))
    if log is not None:
        log.goal_ml = user.goal_ml
        _refresh_met(log, now)


def settings_of(user):
    return {key: getattr(user, key) for key in sorted(SETTINGS_FIELDS)}


def sync_tracker_settings(tracker, user):
    """The scale owner's goal and active hours drive the scale's status in tracker.py."""
    tracker.update_settings({key: getattr(user, key) for key in TRACKER_FIELDS})


# ---- scale ownership ----
def scale_owner_id(session):
    row = session.get(Meta, SCALE_OWNER_KEY)
    return row.value if row else None


def claim_scale(session, user, tracker, weight_g=None):
    """Save the empty bottle weight. Read from the scale (and take it over) unless `weight_g` is given."""
    if weight_g is None:
        empty = tracker.register_empty()
        row = session.get(Meta, SCALE_OWNER_KEY)
        if row is None:
            session.add(Meta(key=SCALE_OWNER_KEY, value=user.id))
        else:
            row.value = user.id
        sync_tracker_settings(tracker, user)
    else:
        if isinstance(weight_g, bool) or not isinstance(weight_g, (int, float)) or not 1 <= weight_g <= 5000:
            raise ValidationError("invalid_value", "weight_g must be a number from 1 to 5000")
        empty = float(weight_g)
    user.empty_g = round(empty, 1)
    return user.empty_g


# ---- intake ----
def _day_log(session, user, day, create=False):
    log = session.execute(
        select(DayLog).where(DayLog.user_id == user.id, DayLog.day == day)
    ).scalar_one_or_none()
    if log is None and create:
        log = DayLog(user_id=user.id, day=day, goal_ml=user.goal_ml, consumed_ml=0)
        session.add(log)
    return log


def _refresh_met(log, now):
    if log.consumed_ml >= log.goal_ml:
        log.met_at = log.met_at or now
    else:
        log.met_at = None


def _recompute_day(session, user, day, now):
    total = session.execute(
        select(func.coalesce(func.sum(Intake.amount_ml), 0)).where(
            Intake.user_id == user.id, Intake.day == day, Intake.voided.is_(False)
        )
    ).scalar_one()
    log = _day_log(session, user, day, create=True)
    log.consumed_ml = int(total)
    _refresh_met(log, now)


def _state(session, user, today):
    state = session.get(UserState, user.id)
    if state is None:
        state = UserState(user_id=user.id, day=today, was_critical=False, lock_apps=False)
        session.add(state)
    elif state.day != today:
        state.day, state.was_critical, state.lock_apps = today, False, False
        state.last_drink_at, state.last_event = None, None
    return state


def record_intake(session, user, *, kind, source, amount_ml, now, detail_ml=None, at=None, intake_id=None):
    """Add an intake event. Idempotent on `intake_id` (the app's outbox may retry)."""
    if intake_id is not None:
        existing = session.get(Intake, intake_id)
        if existing is not None:
            if existing.user_id != user.id:
                raise ValidationError("invalid_value", "id already used")
            return existing
    if isinstance(amount_ml, bool) or not isinstance(amount_ml, int) or not 0 <= amount_ml <= 3000:
        raise ValidationError("invalid_value", "amount_ml must be an integer from 0 to 3000")
    at = now if at is None else min(at, now)  # a phone clock running fast can't log the future
    if now - at > MAX_BACKDATE:
        raise ValidationError("invalid_value", "at can be at most 7 days ago")
    day = local_day(user, at)
    intake = Intake(user_id=user.id, day=day, kind=kind, source=source, amount_ml=amount_ml,
                    detail_ml=detail_ml, at=at, voided=False)
    if intake_id is not None:
        intake.id = intake_id
    session.add(intake)
    session.flush()
    _recompute_day(session, user, day, now)
    today = local_day(user, now)
    if day == today:
        state = _state(session, user, today)
        state.last_event = {"type": kind, "ml": amount_ml, "detail_ml": detail_ml, "at": iso(at)}
        if amount_ml > 0:
            if state.last_drink_at is None or as_utc(state.last_drink_at) < at:
                state.last_drink_at = at
            state.lock_apps = False  # the next drink unlocks
    return intake


def void_intake(session, user, intake_id, now):
    intake = session.get(Intake, intake_id)
    if intake is None or intake.user_id != user.id:
        raise ValidationError("not_found", "intake not found")
    if not intake.voided:
        intake.voided = True
        session.flush()
        _recompute_day(session, user, intake.day, now)
    return intake


SCALE_KINDS = {"drink": ("drink", "ml", None), "refill": ("refill", "drank_ml", "ml"),
               "baseline": ("baseline", None, "water_ml")}


def record_scale_event(session, event, now):
    """Tracker listener body: log a scale event for the scale's owner. Returns the owner's id."""
    owner_id = scale_owner_id(session)
    user = session.get(User, owner_id) if owner_id else None
    if user is None or event.get("type") not in SCALE_KINDS:
        return None
    kind, amount_key, detail_key = SCALE_KINDS[event["type"]]
    record_intake(session, user, kind=kind, source="scale", now=now,
                  amount_ml=int(event.get(amount_key) or 0) if amount_key else 0,
                  detail_ml=event.get(detail_key) if detail_key else None)
    return user.id


# ---- streaks and leaderboard ----
def _met_days(session, user_ids=None):
    since = datetime.now(timezone.utc).date() - timedelta(days=STREAK_LOOKBACK_DAYS)
    query = select(DayLog.user_id, DayLog.day).where(DayLog.consumed_ml >= DayLog.goal_ml, DayLog.day >= since)
    if user_ids is not None:
        query = query.where(DayLog.user_id.in_(user_ids))
    met = {}
    for user_id, day in session.execute(query):
        met.setdefault(user_id, set()).add(day)
    return met


def streaks(met, today):
    """(current, best). Today counts once the goal is met; a missed day resets to 0."""
    day = today if today in met else today - timedelta(days=1)
    current = 0
    while day in met:
        current += 1
        day -= timedelta(days=1)
    best = run = 0
    prev = None
    for day in sorted(met):
        run = run + 1 if prev is not None and day - prev == timedelta(days=1) else 1
        best = max(best, run)
        prev = day
    return current, max(best, current)


def leaderboard(session, me, now, limit=50):
    """Ranked by current streak, never by volume (ties share a rank)."""
    users = session.execute(select(User.id, User.username, User.timezone)).all()
    met = _met_days(session)
    rows = []
    for user_id, username, tz in users:
        try:
            today = now.astimezone(ZoneInfo(tz)).date()
        except (ZoneInfoNotFoundError, ValueError):
            today = now.date()
        current, best = streaks(met.get(user_id, set()), today)
        rows.append((user_id, username, current, best))
    rows.sort(key=lambda r: (-r[2], -r[3], r[1]))
    entries, rank, prev, mine = [], 0, None, None
    for i, (user_id, username, current, best) in enumerate(rows, start=1):
        if current != prev:
            rank, prev = i, current
        entry = {"rank": rank, "username": username, "streak": current, "best_streak": best,
                 "is_me": user_id == me.id}
        if entry["is_me"]:
            mine = entry
        if i <= limit:
            entries.append(entry)
    return {"entries": entries, "me": mine, "total": len(rows)}


# ---- views ----
def _next_reminder(user, state, local_now, total, goal):
    if total >= goal:
        return None
    midnight = local_now.replace(hour=0, minute=0, second=0, microsecond=0)
    start = midnight + timedelta(hours=user.start_hour)
    end = midnight + timedelta(hours=user.end_hour)
    last = state.last_drink_at and as_utc(state.last_drink_at).astimezone(local_now.tzinfo)
    interval = timedelta(minutes=user.interval_min)
    nxt = max(last or start, start) + interval
    if nxt <= local_now:
        nxt += interval * math.ceil((local_now - nxt) / interval + 1e-9)
    return iso(nxt) if nxt < end else None


def status(session, user, now, tracker=None):
    """Live snapshot for one user. Same fields as /api/status, plus pace, streak and the scale."""
    local_now = as_utc(now).astimezone(tz_of(user))
    today = local_now.date()
    log = _day_log(session, user, today)
    total = log.consumed_ml if log else 0
    goal = log.goal_ml if log else user.goal_ml
    hour = _hour_float(local_now)
    current = compute_status(total, goal, user.start_hour, user.end_hour, hour)
    state = _state(session, user, today)
    critical = current == "critical"
    if critical and not state.was_critical:
        state.lock_apps = True
    if not critical:
        state.lock_apps = False
    state.was_critical = critical

    owner = tracker is not None and scale_owner_id(session) == user.id
    live = tracker.live() if owner else None
    current_streak, best = streaks(_met_days(session, [user.id]).get(user.id, set()), today)
    return {
        "day": today.isoformat(),
        "total_ml": total,
        "goal_ml": goal,
        "expected_ml": expected_ml(goal, user.start_hour, user.end_hour, hour),
        "status": current,
        "should_lock": state.lock_apps,
        "last_drink_at": iso(state.last_drink_at),
        "last_event": state.last_event,
        "next_reminder_at": _next_reminder(user, state, local_now, total, goal),
        "streak": current_streak,
        "best_streak": best,
        "empty_g": user.empty_g,
        "scale": None if live is None else {
            "connected": live["connected"],
            "water_ml": live["water_ml"],
            "needs_refill": live["needs_refill"],
        },
    }


def profile(user, rank=None, owner=False):
    return {
        "id": user.id,
        "username": user.username,
        "created_at": iso(user.created_at),
        "empty_g": user.empty_g,
        "scale_owner": owner,
        "rank": rank,
        **settings_of(user),
    }


def intake_out(intake):
    return {
        "id": intake.id,
        "day": intake.day.isoformat(),
        "kind": intake.kind,
        "source": intake.source,
        "amount_ml": intake.amount_ml,
        "detail_ml": intake.detail_ml,
        "at": iso(intake.at),
        "voided": intake.voided,
        "updated_at": iso(intake.updated_at),
    }


def day_out(log):
    return {
        "day": log.day.isoformat(),
        "goal_ml": log.goal_ml,
        "consumed_ml": log.consumed_ml,
        "met": log.consumed_ml >= log.goal_ml,
        "met_at": iso(log.met_at),
        "updated_at": iso(log.updated_at),
    }


def history(session, user, days):
    since = local_day(user, datetime.now(timezone.utc)) - timedelta(days=days)
    rows = session.execute(
        select(DayLog).where(DayLog.user_id == user.id, DayLog.day >= since).order_by(DayLog.day)
    ).scalars()
    return [day_out(log) for log in rows]


def intakes_for_day(session, user, day):
    rows = session.execute(
        select(Intake).where(Intake.user_id == user.id, Intake.day == day).order_by(Intake.at)
    ).scalars()
    return [intake_out(i) for i in rows]


# ---- offline sync ----
MUTATIONS = ("intake.add", "intake.void", "settings.patch")


def apply_mutation(session, user, mutation, now, tracker=None):
    """Apply one queued change from the app's outbox. Raises ValidationError if it can never succeed."""
    if not isinstance(mutation, dict) or mutation.get("type") not in MUTATIONS:
        raise ValidationError("invalid_value", "type must be one of " + ", ".join(MUTATIONS))
    payload = mutation.get("payload") or {}
    if not isinstance(payload, dict):
        raise ValidationError("invalid_value", "payload must be a JSON object")
    kind = mutation["type"]
    if kind == "intake.add":
        intake_id = payload.get("id")
        if not isinstance(intake_id, str) or not 8 <= len(intake_id) <= 36:
            raise ValidationError("invalid_value", "id must be a client-generated UUID")
        at = parse_iso(payload["at"], "at") if payload.get("at") else None
        record_intake(session, user, kind="manual", source="app", amount_ml=payload.get("amount_ml"),
                      now=now, at=at, intake_id=intake_id)
    elif kind == "intake.void":
        void_intake(session, user, payload.get("id"), now)
    else:
        apply_settings(session, user, payload, now)
        if tracker is not None and scale_owner_id(session) == user.id:
            sync_tracker_settings(tracker, user)


def apply_mutations(session, user, mutations, now, tracker=None):
    """Each mutation runs in its own savepoint: one bad change doesn't block the rest of the queue."""
    if not isinstance(mutations, list) or len(mutations) > 200:
        raise ValidationError("invalid_value", "mutations must be a list of at most 200 items")
    results = []
    for mutation in mutations:
        mid = mutation.get("id") if isinstance(mutation, dict) else None
        try:
            with session.begin_nested():
                apply_mutation(session, user, mutation, now, tracker)
            results.append({"id": mid, "ok": True})
        except ValidationError as exc:
            results.append({"id": mid, "ok": False, "error": {"code": exc.code, "message": exc.message}})
    return results


def pull(session, user, now, since=None, tracker=None):
    """Everything the app caches. Full on first sync, else only rows changed since the cursor."""
    today = local_day(user, now)
    intakes = select(Intake).where(Intake.user_id == user.id)
    days = select(DayLog).where(DayLog.user_id == user.id)
    if since is None:
        intakes = intakes.where(Intake.day >= today - timedelta(days=INITIAL_INTAKE_DAYS))
        days = days.where(DayLog.day >= today - timedelta(days=INITIAL_HISTORY_DAYS))
    else:
        intakes = intakes.where(Intake.updated_at > since - SYNC_OVERLAP)
        days = days.where(DayLog.updated_at > since - SYNC_OVERLAP)
    board = leaderboard(session, user, now)
    owner = scale_owner_id(session) == user.id
    return {
        "server_time": iso(now),
        "full": since is None,
        "user": profile(user, rank=board["me"]["rank"] if board["me"] else None, owner=owner),
        "status": status(session, user, now, tracker),
        "days": [day_out(log) for log in session.execute(days.order_by(DayLog.day)).scalars()],
        "intakes": [intake_out(i) for i in session.execute(intakes.order_by(Intake.at)).scalars()],
        "leaderboard": board,
    }
