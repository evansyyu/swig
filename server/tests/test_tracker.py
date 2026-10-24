import unittest
from datetime import datetime, timedelta

from tracker import Tracker, ValidationError


class FakeClock:
    def __init__(self, hour=13, minute=30):
        self.now = datetime(2026, 10, 23, hour, minute)

    def __call__(self):
        return self.now

    def advance(self, minutes):
        self.now += timedelta(minutes=minutes)


def feed(tracker, grams, n=6):
    event = None
    for _ in range(n):
        event = tracker.process(grams) or event
    return event


class DetectionTests(unittest.TestCase):
    def setUp(self):
        self.t = Tracker(clock=FakeClock())

    def test_drink_is_counted(self):
        feed(self.t, 500)
        event = feed(self.t, 450)
        self.assertEqual(event["type"], "drink")
        self.assertEqual(self.t.status()["total_ml"], 50)
        self.assertIsNotNone(self.t.status()["last_drink_at"])

    def test_movement_is_ignored(self):
        feed(self.t, 500)
        for g in (500, 320, 610, 280, 540, 90):  # bottle being carried
            self.t.process(g)
        self.assertEqual(self.t.status()["total_ml"], 0)

    def test_refill_is_not_a_drink(self):
        feed(self.t, 400)
        event = feed(self.t, 600)
        self.assertEqual(event["type"], "refill")
        self.assertEqual(self.t.status()["total_ml"], 0)

    def test_lift_and_return_counts_the_difference(self):
        feed(self.t, 500)
        feed(self.t, 0)        # bottle lifted off
        feed(self.t, 480)      # put back after a sip
        self.assertEqual(self.t.status()["total_ml"], 20)

    def test_small_change_is_ignored(self):
        feed(self.t, 500)
        feed(self.t, 495)
        self.assertEqual(self.t.status()["total_ml"], 0)

    def test_new_day_resets_total(self):
        feed(self.t, 500)
        feed(self.t, 450)
        self.t._clock.advance(24 * 60)
        self.assertEqual(self.t.status()["total_ml"], 0)


class BottleFlowTests(unittest.TestCase):
    """Empty bottle 200 g. Fill to 700 ml, drink, run low, refill."""

    def setUp(self):
        self.clock = FakeClock()
        self.t = Tracker(clock=self.clock)
        feed(self.t, 200)
        self.t.register_empty()

    def test_register_needs_a_bottle_on_the_scale(self):
        with self.assertRaises(ValidationError) as ctx:
            Tracker(clock=FakeClock()).register_empty()
        self.assertEqual(ctx.exception.code, "no_stable_reading")

    def test_first_fill_is_a_baseline_not_a_drink(self):
        feed(self.t, 900)
        s = self.t.status()
        self.assertEqual((s["water_ml"], s["total_ml"], s["needs_refill"]), (700, 0, False))

    def test_drinks_add_up_and_low_water_asks_for_refill(self):
        feed(self.t, 900)
        feed(self.t, 800)   # -100
        feed(self.t, 240)   # -560, 40 ml left
        s = self.t.status()
        self.assertEqual((s["total_ml"], s["water_ml"], s["needs_refill"]), (660, 40, True))

    def test_refill_counts_the_little_water_left(self):
        feed(self.t, 900)
        feed(self.t, 240)   # drank 660, 40 ml left
        event = feed(self.t, 1200)   # refilled to 1000 ml
        self.assertEqual(event["type"], "refill")
        self.assertEqual(event["drank_ml"], 40)
        s = self.t.status()
        self.assertEqual((s["total_ml"], s["water_ml"], s["needs_refill"]), (700, 1000, False))

    def test_topping_up_a_full_bottle_is_not_a_drink(self):
        feed(self.t, 800)   # 600 ml
        feed(self.t, 1200)  # topped up to 1000 ml
        self.assertEqual(self.t.status()["total_ml"], 0)

    def test_refill_without_empty_weight_only_moves_the_baseline(self):
        t = Tracker(clock=FakeClock())
        feed(t, 240)
        feed(t, 1200)
        self.assertEqual(t.status()["total_ml"], 0)

    def test_refill_prompt_fires_once_per_low_episode(self):
        feed(self.t, 900)
        self.assertFalse(self.t.refill_prompt_due())
        feed(self.t, 240)
        self.assertTrue(self.t.refill_prompt_due())
        self.assertFalse(self.t.refill_prompt_due())
        feed(self.t, 1200)
        self.assertFalse(self.t.refill_prompt_due())
        feed(self.t, 230)
        self.assertTrue(self.t.refill_prompt_due())

    def test_new_day_starts_from_a_fresh_baseline(self):
        feed(self.t, 900)
        self.clock.advance(24 * 60)        # overnight the bottle was emptied and refilled
        feed(self.t, 400)
        self.assertEqual(self.t.status()["total_ml"], 0)
        feed(self.t, 350)                  # a real sip the next time
        self.assertEqual(self.t.status()["total_ml"], 50)

    def test_reset_keeps_the_baseline_and_empty_weight(self):
        feed(self.t, 900)
        self.t.reset()
        feed(self.t, 850)
        s = self.t.status()
        self.assertEqual((s["total_ml"], s["empty_g"]), (50, 200.0))


class StatusTests(unittest.TestCase):
    def status_for(self, total, hour=13, minute=30):
        t = Tracker(clock=FakeClock(hour, minute))
        t.total_ml = total
        return t.status()["status"]

    def test_pace_rules(self):
        # 13:30 -> 4.5 of 13 active hours -> expected 692 ml
        self.assertEqual(self.status_for(800), "ahead")
        self.assertEqual(self.status_for(600), "ok")
        self.assertEqual(self.status_for(400), "behind")
        self.assertEqual(self.status_for(100), "critical")

    def test_goal_reached_is_ahead(self):
        self.assertEqual(self.status_for(2000), "ahead")

    def test_too_early_to_judge(self):
        self.assertEqual(self.status_for(0, 9, 30), "ok")

    def test_outside_active_hours(self):
        self.assertEqual(self.status_for(0, 23, 0), "ok")


class LockTests(unittest.TestCase):
    def setUp(self):
        self.t = Tracker(clock=FakeClock())  # 13:30, total 0 -> critical

    def test_critical_locks(self):
        self.assertTrue(self.t.status()["should_lock"])

    def test_drink_unlocks_and_stays_unlocked_while_still_critical(self):
        self.assertTrue(self.t.status()["should_lock"])
        feed(self.t, 500)
        feed(self.t, 450)
        first = self.t.status()
        self.assertEqual(first["status"], "critical")
        self.assertFalse(first["should_lock"])
        self.assertFalse(self.t.status()["should_lock"])

    def test_reaching_goal_unlocks(self):
        self.assertTrue(self.t.status()["should_lock"])
        self.t.total_ml = 2000
        self.assertFalse(self.t.status()["should_lock"])

    def test_reset_clears_lock(self):
        self.assertTrue(self.t.status()["should_lock"])
        self.t.reset()
        self.assertFalse(self.t.status()["should_lock"])

    def test_override(self):
        t = Tracker(clock=FakeClock(9, 30))
        self.assertFalse(t.status()["should_lock"])
        t.set_override("critical")
        self.assertTrue(t.status()["should_lock"])
        t.set_override(None)
        self.assertFalse(t.status()["should_lock"])
        with self.assertRaises(ValidationError):
            t.set_override("angry")


class SettingsTests(unittest.TestCase):
    def setUp(self):
        self.t = Tracker(clock=FakeClock())

    def test_partial_update(self):
        s = self.t.update_settings({"goal_ml": 2500})
        self.assertEqual(s["goal_ml"], 2500)
        self.assertEqual(s["interval_min"], 30)

    def test_rejects_bad_values(self):
        for bad in ({"volume": 1.5}, {"goal_ml": 100}, {"goal_ml": "2000"},
                    {"message": ""}, {"start_hour": 22, "end_hour": 9}):
            with self.assertRaises(ValidationError, msg=str(bad)):
                self.t.update_settings(bad)

    def test_rejects_unknown_field(self):
        with self.assertRaises(ValidationError) as ctx:
            self.t.update_settings({"min_drink_g": 5})
        self.assertEqual(ctx.exception.code, "unknown_field")


class ReminderTests(unittest.TestCase):
    def test_reminder_timing(self):
        clock = FakeClock(9, 0)
        t = Tracker(clock=clock)
        self.assertFalse(t.reminder_due())     # no time has passed yet
        clock.advance(31)
        self.assertTrue(t.reminder_due())
        self.assertFalse(t.reminder_due())     # not again right away
        clock.advance(31)
        self.assertTrue(t.reminder_due())

    def test_drink_delays_reminder(self):
        clock = FakeClock(10, 0)
        t = Tracker(clock=clock)
        feed(t, 500)
        clock.advance(31)
        feed(t, 450)                            # drank 50 ml
        self.assertFalse(t.reminder_due())

    def test_quiet_outside_hours_and_after_goal(self):
        clock = FakeClock(22, 30)
        t = Tracker(clock=clock)
        clock.advance(60)
        self.assertFalse(t.reminder_due())
        clock = FakeClock(10, 0)
        t = Tracker(clock=clock)
        t.total_ml = 2000
        clock.advance(60)
        self.assertFalse(t.reminder_due())


if __name__ == "__main__":
    unittest.main()
