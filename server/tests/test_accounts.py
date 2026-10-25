import os
import tempfile
import unittest
import uuid
from datetime import date, datetime, timedelta, timezone

_tmp = tempfile.mkdtemp()
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp}/test.db"
os.environ["REMINDERS"] = "0"

from fastapi.testclient import TestClient  # noqa: E402

import accounts  # noqa: E402
import api  # noqa: E402
import app as legacy  # noqa: E402
from db import Base, engine, session_scope  # noqa: E402
from models import DayLog, User  # noqa: E402
from tracker import Tracker  # noqa: E402

# 13:30 in New York (the default timezone), like the v1 tests.
NOW = datetime(2026, 10, 23, 17, 30, tzinfo=timezone.utc)


class AccountTests(unittest.TestCase):
    def setUp(self):
        Base.metadata.drop_all(engine)
        api.clock = lambda: NOW
        legacy.tracker = Tracker(clock=lambda: datetime(2026, 10, 23, 13, 30))
        self.client = TestClient(api.api)
        self.client.__enter__()

    def tearDown(self):
        self.client.__exit__(None, None, None)

    def register(self, username="alex.water", **extra):
        r = self.client.post("/auth/register", json={"username": username, "password": "hydrate123", **extra})
        self.assertEqual(r.status_code, 201, r.text)
        return {"Authorization": f"Bearer {r.json()['token']}"}

    def sync(self, auth, mutations=(), since=None):
        body = {"mutations": list(mutations)} | ({"since": since} if since else {})
        r = self.client.post("/sync", json=body, headers=auth)
        self.assertEqual(r.status_code, 200, r.text)
        return r.json()

    def add_met_days(self, username, days_back):
        with session_scope() as session:
            user = session.query(User).filter_by(username=username).one()
            for n in days_back:
                session.add(DayLog(user_id=user.id, day=date(2026, 10, 23) - timedelta(days=n),
                                   goal_ml=2000, consumed_ml=2100))

    # ---- auth ----
    def test_register_login_and_me(self):
        auth = self.register(goal_ml=2500, interval_min=90)
        me = self.client.get("/me", headers=auth).json()
        self.assertEqual((me["username"], me["goal_ml"], me["interval_min"], me["rank"]), ("alex.water", 2500, 90, 1))
        r = self.client.post("/auth/login", json={"username": "Alex.Water", "password": "hydrate123"})
        self.assertEqual(r.status_code, 200)

    def test_auth_errors(self):
        self.register()
        r = self.client.post("/auth/register", json={"username": "alex.water", "password": "hydrate123"})
        self.assertEqual((r.status_code, r.json()["error"]["code"]), (409, "username_taken"))
        r = self.client.post("/auth/register", json={"username": "bo", "password": "short"})
        self.assertEqual((r.status_code, r.json()["error"]["code"]), (400, "invalid_value"))
        r = self.client.post("/auth/login", json={"username": "alex.water", "password": "nope-nope"})
        self.assertEqual((r.status_code, r.json()["error"]["code"]), (401, "unauthorized"))
        self.assertEqual(self.client.get("/me").status_code, 401)

    # ---- sync ----
    def test_outbox_mutations_are_idempotent(self):
        auth = self.register()
        sip = {"id": "m1", "type": "intake.add", "payload": {"id": str(uuid.uuid4()), "amount_ml": 250}}
        first = self.sync(auth, [sip])
        again = self.sync(auth, [sip])  # retried after a dropped response
        self.assertTrue(first["results"][0]["ok"])
        self.assertEqual(again["status"]["total_ml"], 250)
        self.assertEqual(len(again["intakes"]), 1)

    def test_bad_mutation_does_not_block_the_queue(self):
        auth = self.register()
        data = self.sync(auth, [
            {"id": "a", "type": "intake.add", "payload": {"id": str(uuid.uuid4()), "amount_ml": -5}},
            {"id": "b", "type": "settings.patch", "payload": {"goal_ml": 3000}},
        ])
        self.assertEqual([r["ok"] for r in data["results"]], [False, True])
        self.assertEqual(data["user"]["goal_ml"], 3000)
        self.assertEqual(data["status"]["goal_ml"], 3000)

    def test_void_and_incremental_pull(self):
        auth = self.register()
        intake_id = str(uuid.uuid4())
        full = self.sync(auth, [{"id": "1", "type": "intake.add", "payload": {"id": intake_id, "amount_ml": 300}}])
        self.assertTrue(full["full"])
        api.clock = lambda: NOW + timedelta(minutes=5)
        delta = self.sync(auth, [{"id": "2", "type": "intake.void", "payload": {"id": intake_id}}],
                          since=full["server_time"])
        self.assertFalse(delta["full"])
        self.assertEqual([(i["id"], i["voided"]) for i in delta["intakes"]], [(intake_id, True)])
        self.assertEqual(delta["status"]["total_ml"], 0)

    def test_offline_log_from_yesterday_lands_on_yesterday(self):
        auth = self.register()
        at = (NOW - timedelta(days=1)).isoformat()
        data = self.sync(auth, [{"id": "1", "type": "intake.add",
                                 "payload": {"id": str(uuid.uuid4()), "amount_ml": 500, "at": at}}])
        self.assertEqual(data["status"]["total_ml"], 0)
        self.assertEqual([(d["day"], d["consumed_ml"]) for d in data["days"]], [("2026-10-22", 500)])

    # ---- status, streaks, leaderboard ----
    def test_lock_turns_on_when_critical_and_off_after_a_drink(self):
        auth = self.register()
        status = self.client.get("/me/status", headers=auth).json()
        self.assertEqual((status["status"], status["should_lock"]), ("critical", True))
        r = self.client.post("/me/intake", json={"amount_ml": 100}, headers=auth)
        self.assertFalse(r.json()["status"]["should_lock"])
        self.assertIsNotNone(r.json()["status"]["next_reminder_at"])

    def test_streaks_and_leaderboard_ranks(self):
        auth = self.register()
        self.register("mira.sips")
        self.register("noah.blue")
        self.add_met_days("mira.sips", [1, 2, 3])
        self.add_met_days("noah.blue", [1, 2, 3, 5, 6, 7, 8])
        board = self.client.get("/leaderboard", headers=auth).json()
        self.assertEqual([(e["username"], e["rank"], e["streak"]) for e in board["entries"]],
                         [("noah.blue", 1, 3), ("mira.sips", 1, 3), ("alex.water", 3, 0)])  # ties share a rank
        self.assertEqual(board["entries"][0]["best_streak"], 4)
        self.assertEqual(board["me"]["rank"], 3)

    def test_meeting_the_goal_extends_the_streak_today(self):
        auth = self.register()
        self.add_met_days("alex.water", [1, 2])
        self.assertEqual(self.client.get("/me/status", headers=auth).json()["streak"], 2)
        r = self.client.post("/me/intake", json={"amount_ml": 2000}, headers=auth)
        self.assertEqual((r.json()["status"]["streak"], r.json()["status"]["status"]), (3, "ahead"))

    def test_settings_validation(self):
        auth = self.register()
        r = self.client.patch("/me/settings", json={"start_hour": 20, "end_hour": 8}, headers=auth)
        self.assertEqual(r.status_code, 400)
        r = self.client.patch("/me/settings", json={"lock_enabled": True, "timezone": "Asia/Seoul"}, headers=auth)
        self.assertEqual((r.status_code, r.json()["settings"]["timezone"]), (200, "Asia/Seoul"))

    # ---- scale ----
    def test_scale_events_go_to_the_owner(self):
        auth = self.register()
        for _ in range(6):
            self.client.post("/weight", json={"grams": 200})
        live = self.client.get("/scale/live", headers=auth).json()
        self.assertEqual((live["connected"], live["stable"], live["owner"]), (True, True, False))
        r = self.client.post("/me/bottle/empty", headers=auth)
        self.assertEqual(r.json()["empty_g"], 200.0)
        for grams in (950, 700):  # refill to full, then a 250 ml drink
            for _ in range(6):
                self.client.post("/weight", json={"grams": grams})
        # The day's baseline (200 g) came before the user owned the scale, so it isn't theirs.
        today = self.client.get("/me/intake", headers=auth).json()
        self.assertEqual([(i["kind"], i["amount_ml"]) for i in today], [("refill", 0), ("drink", 250)])
        status = self.client.get("/me/status", headers=auth).json()
        self.assertEqual((status["total_ml"], status["scale"]["water_ml"]), (250, 500))
        self.assertEqual(self.client.get("/api/status").json()["total_ml"], 250)  # v1 view of the same scale

    def test_bottle_empty_without_a_reading(self):
        auth = self.register()
        r = self.client.post("/me/bottle/empty", headers=auth)
        self.assertEqual((r.status_code, r.json()["error"]["code"]), (409, "no_stable_reading"))
        r = self.client.post("/me/bottle/empty", json={"weight_g": 180}, headers=auth)
        self.assertEqual(r.json()["empty_g"], 180.0)

    # ---- plumbing ----
    def test_v1_routes_still_served(self):
        self.assertEqual(self.client.get("/api/settings").json()["goal_ml"], 2000)
        self.assertEqual(self.client.get("/").status_code, 200)
        self.assertEqual(self.client.get("/health").json()["ok"], True)

    def test_websocket_pushes_state(self):
        auth = self.register()
        token = auth["Authorization"].split()[1]
        with self.client.websocket_connect(f"/ws?token={token}") as ws:
            first = ws.receive_json()
            self.assertEqual((first["type"], first["status"]["total_ml"]), ("state", 0))
            self.client.post("/me/intake", json={"amount_ml": 150}, headers=auth)
            pushed = ws.receive_json()
            self.assertEqual((pushed["changed"], pushed["status"]["total_ml"]), (True, 150))


class StreakUnitTests(unittest.TestCase):
    def test_streak_counts_back_from_yesterday_until_today_is_met(self):
        today = date(2026, 10, 23)
        met = {today - timedelta(days=n) for n in (1, 2, 3, 6, 7)}
        self.assertEqual(accounts.streaks(met, today), (3, 3))
        self.assertEqual(accounts.streaks(met | {today}, today), (4, 4))
        self.assertEqual(accounts.streaks({today - timedelta(days=2)}, today), (0, 1))


if __name__ == "__main__":
    unittest.main()
