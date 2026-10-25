"""Accounts, history, leaderboard and offline sync for the app (FastAPI). See docs/API.md (v2).

The Flask app from app.py is mounted underneath, so the firmware, the test page
and every v1 route keep working unchanged. Start with `python3 app.py`.
"""
import asyncio
import contextlib
import json
import logging
import os
import threading
from contextlib import asynccontextmanager
from datetime import date, datetime, timezone

from a2wsgi import WSGIMiddleware
from fastapi import Body, FastAPI, Header, Query, WebSocket, WebSocketDisconnect
from fastapi.concurrency import run_in_threadpool
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import select
from starlette.exceptions import HTTPException as StarletteHTTPException

import accounts
import app as legacy
import security
from db import init_db, session_scope
from models import User
from tracker import ValidationError

log = logging.getLogger("api")
USERNAME_CHARS = set("abcdefghijklmnopqrstuvwxyz0123456789._-")
TICK_SECONDS = float(os.environ.get("TICK_SECONDS", "30"))
HTTP_FOR_CODE = {"no_stable_reading": 409, "username_taken": 409, "not_found": 404, "unauthorized": 401}


def clock():
    return datetime.now(timezone.utc)


class ApiError(ValidationError):
    pass


# ---- live push (WebSocket) ----
class Hub:
    """Pushes a user's fresh status to their open sockets. `notify` is safe from any thread."""

    def __init__(self):
        self.sockets = {}
        self.loop = None

    def notify(self, user_id, changed=True):
        if self.loop is not None and user_id in self.sockets:
            self.loop.call_soon_threadsafe(lambda: self.loop.create_task(self.push(user_id, changed)))

    async def push(self, user_id, changed):
        sockets = list(self.sockets.get(user_id, ()))
        if not sockets:
            return
        message = await run_in_threadpool(state_message, user_id, changed)
        for ws in sockets:
            try:
                await ws.send_text(message)
            except Exception:
                self.sockets.get(user_id, set()).discard(ws)

    async def tick_forever(self):
        """Status also changes with time alone (pace, lock), so connected apps get it every tick."""
        while True:
            await asyncio.sleep(TICK_SECONDS)
            for user_id in list(self.sockets):
                await self.push(user_id, changed=False)


hub = Hub()


def state_message(user_id, changed):
    with session_scope() as session:
        user = session.get(User, user_id)
        if user is None:
            return json.dumps({"type": "error", "error": {"code": "unauthorized", "message": "account deleted"}})
        data = accounts.status(session, user, clock(), legacy.tracker)
    # `changed` tells the app to pull new rows; a plain tick only refreshes the status.
    return json.dumps({"type": "state", "changed": changed, "status": data})


def on_scale_event(event):
    """Tracker listener: runs in the request thread that received the weight."""
    try:
        with session_scope() as session:
            user_id = accounts.record_scale_event(session, event, clock())
    except Exception:
        log.exception("could not record scale event %s", event)
        return
    if user_id:
        hub.notify(user_id)


def restore_scale_owner():
    """After a restart, give the tracker back its owner's settings and empty bottle weight."""
    with session_scope() as session:
        owner_id = accounts.scale_owner_id(session)
        user = session.get(User, owner_id) if owner_id else None
        if user is None:
            return
        accounts.sync_tracker_settings(legacy.tracker, user)
        if user.empty_g is not None and legacy.tracker.empty_g is None:
            legacy.tracker.empty_g = user.empty_g


@asynccontextmanager
async def lifespan(_app):
    if security.JWT_SECRET == security.INSECURE_SECRET:
        log.warning("JWT_SECRET is not set; using an insecure development secret")
    init_db()
    legacy.tracker.listeners.append(on_scale_event)
    restore_scale_owner()
    # The phone app plays reminders now; set REMINDERS=1 to also speak them on this computer.
    if os.environ.get("REMINDERS", "0") == "1":
        threading.Thread(target=legacy.reminder_loop, daemon=True).start()
    hub.loop = asyncio.get_running_loop()
    ticker = hub.loop.create_task(hub.tick_forever())
    yield
    ticker.cancel()
    with contextlib.suppress(asyncio.CancelledError):
        await ticker
    with contextlib.suppress(ValueError):
        legacy.tracker.listeners.remove(on_scale_event)


api = FastAPI(title="WaterAlarmi", version="2.0", lifespan=lifespan, docs_url="/v2/docs", redoc_url=None,
             openapi_url="/v2/openapi.json")
api.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


# ---- errors: same shape as v1 ----
def error_response(code, message, http):
    return JSONResponse({"error": {"code": code, "message": message}}, status_code=http)


@api.exception_handler(ValidationError)
async def on_validation_error(_request, exc):
    return error_response(exc.code, exc.message, HTTP_FOR_CODE.get(exc.code, 400))


@api.exception_handler(RequestValidationError)
async def on_bad_request(_request, exc):
    first = exc.errors()[0] if exc.errors() else {}
    where = ".".join(str(p) for p in first.get("loc", ()) if p != "body")
    return error_response("invalid_value", f"{where}: {first.get('msg', 'invalid request')}".strip(": "), 400)


@api.exception_handler(StarletteHTTPException)
async def on_http_error(_request, exc):
    return error_response("not_found" if exc.status_code == 404 else "http_error", str(exc.detail), exc.status_code)


# ---- auth ----
def current_user(session, authorization):
    token = authorization[7:] if authorization and authorization[:7].lower() == "bearer " else None
    user_id = security.decode_token(token) if token else None
    user = session.get(User, user_id) if user_id else None
    if user is None:
        raise ApiError("unauthorized", "invalid or missing token")
    return user


def token_response(session, user):
    board = accounts.leaderboard(session, user, clock())
    owner = accounts.scale_owner_id(session) == user.id
    return {"token": security.create_token(user.id),
            "user": accounts.profile(user, rank=board["me"]["rank"], owner=owner)}


@api.post("/auth/register", status_code=201, tags=["auth"])
def register(body: dict = Body(...)):
    username = str(body.get("username", "")).strip().lower()
    password = body.get("password")
    if not 3 <= len(username) <= 32 or not set(username) <= USERNAME_CHARS:
        raise ApiError("invalid_value", "username must be 3 to 32 letters, numbers, dots, dashes or underscores")
    if not isinstance(password, str) or not 8 <= len(password) <= 128:
        raise ApiError("invalid_value", "password must be 8 to 128 characters")
    settings = {k: v for k, v in body.items() if k not in ("username", "password")}
    with session_scope() as session:
        if session.execute(select(User.id).where(User.username == username)).first():
            raise ApiError("username_taken", "that username is taken")
        user = User(username=username, password_hash=security.hash_password(password), goal_ml=2000,
                    interval_min=60, start_hour=9, end_hour=22, lock_enabled=False,
                    timezone=os.environ.get("DEFAULT_TIMEZONE", "America/New_York"))
        accounts.validate_settings(settings, user)
        for key, value in settings.items():
            setattr(user, key, value)
        session.add(user)
        session.flush()
        return token_response(session, user)


@api.post("/auth/login", tags=["auth"])
def login(body: dict = Body(...)):
    with session_scope() as session:
        user = session.execute(
            select(User).where(User.username == str(body.get("username", "")).strip().lower())
        ).scalar_one_or_none()
        if user is None or not security.verify_password(str(body.get("password", "")), user.password_hash):
            raise ApiError("unauthorized", "wrong username or password")
        return token_response(session, user)


# ---- me ----
@api.get("/me", tags=["me"])
def get_me(authorization: str | None = Header(None)):
    with session_scope() as session:
        user = current_user(session, authorization)
        board = accounts.leaderboard(session, user, clock())
        return accounts.profile(user, rank=board["me"]["rank"], owner=accounts.scale_owner_id(session) == user.id)


@api.get("/me/status", tags=["me"])
def get_status(authorization: str | None = Header(None)):
    with session_scope() as session:
        user = current_user(session, authorization)
        return accounts.status(session, user, clock(), legacy.tracker)


@api.patch("/me/settings", tags=["me"])
def patch_settings(body: dict = Body(...), authorization: str | None = Header(None)):
    with session_scope() as session:
        user = current_user(session, authorization)
        accounts.apply_mutation(session, user, {"type": "settings.patch", "payload": body}, clock(), legacy.tracker)
        result = {"settings": accounts.settings_of(user), "status": accounts.status(session, user, clock(), legacy.tracker)}
    hub.notify(user.id)
    return result


@api.get("/me/history", tags=["me"])
def get_history(days: int = Query(30, ge=1, le=365), authorization: str | None = Header(None)):
    with session_scope() as session:
        return accounts.history(session, current_user(session, authorization), days)


@api.get("/me/intake", tags=["me"])
def list_intake(day: date | None = None, authorization: str | None = Header(None)):
    with session_scope() as session:
        user = current_user(session, authorization)
        return accounts.intakes_for_day(session, user, day or accounts.local_day(user, clock()))


@api.post("/me/intake", status_code=201, tags=["me"])
def add_intake(body: dict = Body(...), authorization: str | None = Header(None)):
    """Manual log. Send your own `id` (UUID) to make retries safe."""
    with session_scope() as session:
        user = current_user(session, authorization)
        at = accounts.parse_iso(body["at"], "at") if body.get("at") else None
        intake = accounts.record_intake(session, user, kind="manual", source="app", amount_ml=body.get("amount_ml"),
                                        now=clock(), at=at, intake_id=body.get("id"))
        result = {"intake": accounts.intake_out(intake), "status": accounts.status(session, user, clock(), legacy.tracker)}
    hub.notify(user.id)
    return result


@api.delete("/me/intake/{intake_id}", tags=["me"])
def delete_intake(intake_id: str, authorization: str | None = Header(None)):
    with session_scope() as session:
        user = current_user(session, authorization)
        intake = accounts.void_intake(session, user, intake_id, clock())
        result = {"intake": accounts.intake_out(intake), "status": accounts.status(session, user, clock(), legacy.tracker)}
    hub.notify(user.id)
    return result


@api.post("/me/bottle/empty", tags=["me"])
def bottle_empty(body: dict | None = Body(None), authorization: str | None = Header(None)):
    """Onboarding. No body: weigh the bottle on the scale now and take over the scale. `{weight_g}`: save as given."""
    with session_scope() as session:
        user = current_user(session, authorization)
        empty = accounts.claim_scale(session, user, legacy.tracker, (body or {}).get("weight_g"))
        result = {"empty_g": empty, "status": accounts.status(session, user, clock(), legacy.tracker)}
    hub.notify(user.id)
    return result


@api.get("/scale/live", tags=["me"])
def scale_live(authorization: str | None = Header(None)):
    """Live weight for the bottle setup screen (poll about once a second while it is open)."""
    with session_scope() as session:
        user = current_user(session, authorization)
        return {**legacy.tracker.live(), "owner": accounts.scale_owner_id(session) == user.id}


@api.get("/leaderboard", tags=["leaderboard"])
def get_leaderboard(limit: int = Query(50, ge=1, le=200), authorization: str | None = Header(None)):
    with session_scope() as session:
        return accounts.leaderboard(session, current_user(session, authorization), clock(), limit)


# ---- offline sync ----
@api.get("/sync", tags=["sync"])
def sync_pull(since: str | None = None, authorization: str | None = Header(None)):
    with session_scope() as session:
        user = current_user(session, authorization)
        cursor = accounts.parse_iso(since, "since") if since else None
        return accounts.pull(session, user, clock(), cursor, legacy.tracker)


@api.post("/sync", tags=["sync"])
def sync_push(body: dict = Body(...), authorization: str | None = Header(None)):
    """Push the outbox, then pull, in one round trip: `{mutations: [...], since?}`."""
    with session_scope() as session:
        user = current_user(session, authorization)
        cursor = accounts.parse_iso(body["since"], "since") if body.get("since") else None
        results = accounts.apply_mutations(session, user, body.get("mutations", []), clock(), legacy.tracker)
        session.flush()
        result = {"results": results, **accounts.pull(session, user, clock(), cursor, legacy.tracker)}
    if any(r["ok"] for r in results):
        hub.notify(user.id)
    return result


@api.websocket("/ws")
async def ws(websocket: WebSocket, token: str = ""):
    user_id = security.decode_token(token) if token else None
    if user_id is None:
        await websocket.close(code=4401)
        return
    await websocket.accept()
    hub.sockets.setdefault(user_id, set()).add(websocket)
    try:
        await websocket.send_text(await run_in_threadpool(state_message, user_id, True))
        while True:
            if await websocket.receive_text() == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        pass
    finally:
        sockets = hub.sockets.get(user_id, set())
        sockets.discard(websocket)
        if not sockets:
            hub.sockets.pop(user_id, None)


@api.get("/health", tags=["meta"])
def health():
    return {"ok": True, "time": accounts.iso(clock())}


# Everything else (firmware, /api/*, the test page) is the v1 Flask app.
api.mount("/", WSGIMiddleware(legacy.app))
