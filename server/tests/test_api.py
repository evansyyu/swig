import unittest
from datetime import datetime

import app as app_module
from tracker import Tracker


class ApiTests(unittest.TestCase):
    def setUp(self):
        app_module.tracker = Tracker(clock=lambda: datetime(2026, 10, 23, 13, 30))
        self.client = app_module.app.test_client()

    def test_weight_accepts_number(self):
        r = self.client.post("/weight", json={"grams": 312.5})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.get_json(), {"ok": True, "event": None, "needs_refill": False})

    def test_weight_returns_the_detected_drink(self):
        for _ in range(6):
            self.client.post("/weight", json={"grams": 900})
        for _ in range(5):
            self.client.post("/weight", json={"grams": 800})
        data = self.client.post("/weight", json={"grams": 800}).get_json()
        self.assertEqual((data["event"]["type"], data["event"]["ml"]), ("drink", 100))

    def test_weight_reports_a_low_bottle(self):
        for grams in (200, 240):
            for _ in range(6):
                data = self.client.post("/weight", json={"grams": grams}).get_json()
            if grams == 200:
                self.client.post("/api/bottle/empty")
        self.assertTrue(data["needs_refill"])

    def test_weight_rejects_bad_input(self):
        for body in ({}, {"grams": "x"}, {"grams": 99999}, {"grams": True}):
            r = self.client.post("/weight", json=body)
            self.assertEqual(r.status_code, 400, msg=str(body))
            self.assertEqual(r.get_json()["error"]["code"], "invalid_value")

    def test_status_shape(self):
        data = self.client.get("/api/status").get_json()
        self.assertEqual(
            set(data), {"total_ml", "goal_ml", "status", "should_lock", "last_drink_at", "last_event",
                    "water_ml", "empty_g", "needs_refill"})
        self.assertEqual(data["status"], "critical")
        self.assertTrue(data["should_lock"])

    def test_settings_roundtrip(self):
        r = self.client.post("/api/settings", json={"goal_ml": 2500, "volume": 0.8})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.get_json()["goal_ml"], 2500)
        self.assertEqual(self.client.get("/api/settings").get_json()["volume"], 0.8)

    def test_settings_errors(self):
        r = self.client.post("/api/settings", json={"volume": 2})
        self.assertEqual((r.status_code, r.get_json()["error"]["code"]), (400, "invalid_value"))
        r = self.client.post("/api/settings", json={"nope": 1})
        self.assertEqual((r.status_code, r.get_json()["error"]["code"]), (400, "unknown_field"))

    def test_override_and_reset(self):
        r = self.client.post("/api/demo/override", json={"status": "ahead"})
        self.assertEqual(r.get_json()["status"], "ahead")
        self.assertFalse(r.get_json()["should_lock"])
        self.client.post("/api/demo/override", json={"status": None})
        self.assertEqual(self.client.post("/api/reset").get_json(), {"ok": True})

    def test_speak_returns_502_when_speaker_fails(self):
        def fail(*_args, **_kwargs):
            raise app_module.speaker.SpeakerUnavailable("not found")
        original = app_module.speaker.speak
        app_module.speaker.speak = fail
        try:
            r = self.client.post("/api/speak", json={"text": "hi"})
        finally:
            app_module.speaker.speak = original
        self.assertEqual((r.status_code, r.get_json()["error"]["code"]), (502, "speaker_unavailable"))

    def test_bottle_empty_needs_a_stable_reading(self):
        r = self.client.post("/api/bottle/empty")
        self.assertEqual((r.status_code, r.get_json()["error"]["code"]), (409, "no_stable_reading"))

    def test_bottle_empty_then_water_level(self):
        for _ in range(6):
            self.client.post("/weight", json={"grams": 200})
        r = self.client.post("/api/bottle/empty")
        self.assertEqual((r.status_code, r.get_json()["empty_g"]), (200, 200.0))
        for _ in range(6):
            self.client.post("/weight", json={"grams": 900})
        data = self.client.get("/api/status").get_json()
        self.assertEqual((data["water_ml"], data["needs_refill"], data["total_ml"]), (700, False, 0))

    def test_index_page(self):
        self.assertEqual(self.client.get("/").status_code, 200)


if __name__ == "__main__":
    unittest.main()
