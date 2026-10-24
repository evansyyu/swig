"""Drink detection and status logic. Pure Python: no Flask, no network.

Implements the rules in docs/API.md. All time comes from the injected `clock`
so the logic can be tested without waiting.
"""
import threading
from datetime import datetime

# ---- Detection tuning (internal, not part of the API) ----
WINDOW = 6               # readings in the stability window (about 3 seconds)
MOVE_TOLERANCE_G = 3.0   # more spread than this in the window = being moved
MIN_BOTTLE_G = 15.0      # below this the bottle counts as lifted off
MIN_DRINK_G = 10.0       # weight drop that counts as a drink
MIN_REFILL_G = 30.0      # weight rise that counts as a refill
REFILL_ALERT_ML = 50     # less water than this in the bottle: ask for a refill
REFILL_COUNT_MAX_ML = 100  # water left before a refill counts as drunk only up to this much

# ---- Status tuning ----
MIN_EXPECTED_ML = 300    # before this much is expected, it is too early to judge
AHEAD_RATIO = 1.1
OK_RATIO = 0.8
BEHIND_RATIO = 0.5

STATUSES = ("ahead", "ok", "behind", "critical")

DEFAULT_SETTINGS = {
    "goal_ml": 2000,
    "interval_min": 30,
    "start_hour": 9,
    "end_hour": 22,
    "message": "Time to drink some water!",
    "volume": 0.5,
}


class ValidationError(ValueError):
    def __init__(self, code, message):
        super().__init__(message)
        self.code = code
        self.message = message


def validate_settings(patch, current):
    """Return a new settings dict with `patch` applied, or raise ValidationError."""
    unknown = set(patch) - set(DEFAULT_SETTINGS)
    if unknown:
        raise ValidationError("unknown_field", "unknown field(s): " + ", ".join(sorted(unknown)))

    def is_int(v):
        return isinstance(v, int) and not isinstance(v, bool)

    def is_num(v):
        return isinstance(v, (int, float)) and not isinstance(v, bool)

    int_ranges = {
        "goal_ml": (250, 6000),
        "interval_min": (1, 240),
        "start_hour": (0, 23),
        "end_hour": (1, 24),
    }
    new = dict(current)
    for key, value in patch.items():
        if key in int_ranges:
            lo, hi = int_ranges[key]
            if not is_int(value) or not lo <= value <= hi:
                raise ValidationError("invalid_value", f"{key} must be an integer from {lo} to {hi}")
        elif key == "volume":
            if not is_num(value) or not 0 <= value <= 1:
                raise ValidationError("invalid_value", "volume must be between 0 and 1")
        elif key == "message":
            if not isinstance(value, str) or not 1 <= len(value) <= 200:
                raise ValidationError("invalid_value", "message must be 1 to 200 characters")
        new[key] = value
    if new["end_hour"] <= new["start_hour"]:
        raise ValidationError("invalid_value", "end_hour must be greater than start_hour")
    return new


class Tracker:
    def __init__(self, clock=datetime.now):
        self._clock = clock
        self._lock = threading.RLock()
        self.settings = dict(DEFAULT_SETTINGS)
        self._started_at = clock()
        self.empty_g = None          # weight of the empty bottle, set by register_empty()
        self.stable_g = None
        self.bottle_present = False
        self.recent = []
        self.last_reminder_at = None
        self._refill_prompted = False
        self._reset_day(clock())

    # ---- internals ----
    def _reset_day(self, now, keep_baseline=False):
        self.day = now.date()
        if not keep_baseline:
            # A new day starts from a fresh baseline: the first stable reading is
            # never counted as a drink (the user puts a full bottle on the scale).
            self.stable_g = None
            self.bottle_present = False
            self.recent = []
        self._refill_prompted = False
        self.total_ml = 0.0
        self.last_drink_at = None
        self.last_event = None
        self._lock_apps = False
        self._was_critical = False
        self.override = None

    def _iso(self, dt):
        return dt.astimezone().isoformat(timespec="seconds") if dt.tzinfo is None else dt.isoformat(timespec="seconds")

    def _hour_float(self, now):
        return now.hour + now.minute / 60 + now.second / 3600

    def _in_active_hours(self, now):
        return self.settings["start_hour"] <= self._hour_float(now) < self.settings["end_hour"]

    def _expected_ml(self, now):
        start, end = self.settings["start_hour"], self.settings["end_hour"]
        fraction = (self._hour_float(now) - start) / (end - start)
        fraction = min(1.0, max(0.0, fraction))
        return round(self.settings["goal_ml"] * fraction)

    def _water_ml(self):
        if self.empty_g is None or self.stable_g is None:
            return None
        return max(0.0, self.stable_g - self.empty_g)

    def _needs_refill(self):
        water = self._water_ml()
        return water is not None and water < REFILL_ALERT_ML

    def _computed_status(self, now):
        goal = self.settings["goal_ml"]
        if self.total_ml >= goal:
            return "ahead"
        expected = self._expected_ml(now)
        if not self._in_active_hours(now) or expected < MIN_EXPECTED_ML:
            return "ok"
        ratio = self.total_ml / expected
        if ratio >= AHEAD_RATIO:
            return "ahead"
        if ratio >= OK_RATIO:
            return "ok"
        if ratio >= BEHIND_RATIO:
            return "behind"
        return "critical"

    # ---- weight input ----
    def process(self, grams):
        """Feed one calibrated reading. Returns the event dict if a drink or refill was detected."""
        with self._lock:
            now = self._clock()
            if now.date() != self.day:
                self._reset_day(now)
            self.recent.append(float(grams))
            del self.recent[:-WINDOW]
            if len(self.recent) < WINDOW or max(self.recent) - min(self.recent) > MOVE_TOLERANCE_G:
                return None  # moving: not stable yet
            stable = sum(self.recent) / len(self.recent)
            if stable < MIN_BOTTLE_G:
                self.bottle_present = False  # lifted off: keep the last stable weight
                return None
            self.bottle_present = True
            event = None
            prev = self.stable_g
            if prev is not None:
                diff = prev - stable
                if diff >= MIN_DRINK_G:
                    self.total_ml += diff
                    self.last_drink_at = now
                    self.last_event = {"type": "drink", "ml": round(diff), "at": self._iso(now)}
                    self._lock_apps = False  # the next drink unlocks
                    event = self.last_event
                elif -diff >= MIN_REFILL_G:
                    # Refill. The little water left before it is counted as drunk
                    # (needs the empty bottle weight, and only if it was nearly empty).
                    drank = 0
                    if self.empty_g is not None:
                        left = prev - self.empty_g
                        if 0 < left <= REFILL_COUNT_MAX_ML:
                            drank = left
                            self.total_ml += drank
                            self.last_drink_at = now
                            self._lock_apps = False
                    self.last_event = {"type": "refill", "ml": round(-diff), "drank_ml": round(drank),
                                       "at": self._iso(now)}
                    event = self.last_event
            self.stable_g = stable
            return event

    # ---- API views ----
    def status(self):
        with self._lock:
            now = self._clock()
            if now.date() != self.day:
                self._reset_day(now)
            status = self.override or self._computed_status(now)
            critical = status == "critical"
            if critical and not self._was_critical:
                self._lock_apps = True
            if not critical:
                self._lock_apps = False
            self._was_critical = critical
            return {
                "total_ml": round(self.total_ml),
                "goal_ml": self.settings["goal_ml"],
                "status": status,
                "should_lock": self._lock_apps,
                "last_drink_at": self._iso(self.last_drink_at) if self.last_drink_at else None,
                "last_event": self.last_event,
                "water_ml": None if self._water_ml() is None else round(self._water_ml()),
                "empty_g": None if self.empty_g is None else round(self.empty_g, 1),
                "needs_refill": self._needs_refill(),
            }

    def update_settings(self, patch):
        with self._lock:
            self.settings = validate_settings(patch, self.settings)
            return dict(self.settings)

    def reset(self):
        with self._lock:
            self._reset_day(self._clock(), keep_baseline=True)
            self._was_critical = self._computed_status(self._clock()) == "critical"

    def register_empty(self):
        """Remember the current stable weight as the empty bottle weight."""
        with self._lock:
            if self.stable_g is None or not self.bottle_present:
                raise ValidationError("no_stable_reading", "put the empty bottle on the scale and wait a few seconds")
            self.empty_g = self.stable_g
            return self.empty_g

    def refill_prompt_due(self):
        """True once each time the bottle runs low. Cleared after a refill."""
        with self._lock:
            if not self._needs_refill():
                self._refill_prompted = False
                return False
            if self._refill_prompted:
                return False
            self._refill_prompted = True
            return True

    def set_override(self, status):
        if status is not None and status not in STATUSES:
            raise ValidationError("invalid_value", "status must be one of " + ", ".join(STATUSES) + " or null")
        with self._lock:
            self.override = status

    # ---- reminders ----
    def reminder_due(self):
        """True if a reminder should play now. Marks it as sent."""
        with self._lock:
            now = self._clock()
            interval = self.settings["interval_min"] * 60
            if not self._in_active_hours(now) or self.total_ml >= self.settings["goal_ml"]:
                return False
            since_drink = (now - (self.last_drink_at or self._started_at)).total_seconds()
            since_reminder = (now - self.last_reminder_at).total_seconds() if self.last_reminder_at else float("inf")
            if since_drink < interval or since_reminder < interval:
                return False
            self.last_reminder_at = now
            return True
