# WaterAlarmi API (v1)

Base URL: `http://<SERVER_IP>:5000` · JSON · no auth (local network only)
Units: grams (g), milliliters (ml). Times are ISO 8601.

| Method | Path | Caller | Purpose |
| --- | --- | --- | --- |
| POST | `/weight` | Firmware | Send a weight reading (about 2 per second) |
| GET | `/api/status` | App | Progress and lock decision (poll every 5 s) |
| GET / POST | `/api/settings` | App | Read / change settings |
| POST | `/api/bottle/empty` | App | Save the empty bottle weight (onboarding) |
| POST | `/api/speak` | Testing | Make the JBL speaker speak |
| POST | `/api/reset` | Demo | Reset today's total and the lock |
| POST | `/api/demo/override` | Demo | Force a status |

## POST /weight

```json
{ "grams": 312.5 }
```

Returns `{ "ok": true }`. Must answer fast; never wait for speech.

## GET /api/status

```json
{
  "total_ml": 800,
  "goal_ml": 2000,
  "status": "behind",
  "should_lock": false,
  "last_drink_at": "2026-10-23T13:18:00-04:00",
  "last_event": { "type": "drink", "ml": 250, "at": "2026-10-23T13:18:00-04:00" },
  "water_ml": 600,
  "empty_g": 200.0,
  "needs_refill": false
}
```

| Field | Notes |
| --- | --- |
| `status` | `ahead`, `ok`, `behind`, or `critical` (drives the mascot) |
| `should_lock` | **The app locks apps when this is `true`** (only if the user turned locking on) |
| `last_drink_at` | `null` if nothing drunk today |
| `last_event` | Latest `drink` or `refill`, or `null`. A refill has `ml` (added) and `drank_ml` (see below) |
| `water_ml` | Water in the bottle now. `null` until the empty weight is saved |
| `empty_g` | Saved empty bottle weight, or `null` |
| `needs_refill` | `true` when the bottle has less than 50 ml of water |

**Bottle flow:** the first stable reading of each day is the baseline, never a drink. Every later drop is a drink. When the bottle is refilled, the water left before the refill (if 100 ml or less) counts as drunk and is reported as `drank_ml`. Topping up a bottle that still has lots of water is not a drink. The empty weight must be saved first, or refills only move the baseline.

**Status** is based on pace: `expected_ml = goal_ml x share of active hours passed`, `ratio = total_ml / expected_ml`.

| Condition (first match) | `status` |
| --- | --- |
| `total_ml >= goal_ml` | `ahead` |
| Outside active hours, or `expected_ml < 300` | `ok` |
| `ratio >= 1.1` | `ahead` |
| `ratio >= 0.8` | `ok` |
| `ratio >= 0.5` | `behind` |
| otherwise | `critical` |

**Lock:** `should_lock` turns `true` when status becomes `critical`, and turns `false` on the next detected drink, when the goal is reached, or on reset.

## GET / POST /api/settings

```json
{ "goal_ml": 2000, "interval_min": 30, "start_hour": 9, "end_hour": 22,
  "message": "Time to drink some water!", "volume": 0.5 }
```

POST accepts any subset and returns the full object. Ranges: `goal_ml` 250 to 6000, `interval_min` 1 to 240, `start_hour` 0 to 23, `end_hour` 1 to 24, `volume` 0 to 1.

## POST /api/bottle/empty

No body. Saves the weight now on the scale as the empty bottle (include the lid if it is used). Returns `{ "ok": true, "empty_g": 200.0 }`, or `409 no_stable_reading` if no bottle is resting on the scale yet.

## POST /api/speak

`{ "text": "optional phrase" }` plays on the JBL speaker (default: saved `message`). Returns `202` after playback, or `502` if speech could not be generated or played.

## POST /api/reset

No body. Returns `{ "ok": true }`.

## POST /api/demo/override

`{ "status": "critical" }` forces a status. Send `{ "status": null }` to clear. Returns the same body as `/api/status`.

## Errors

```json
{ "error": { "code": "invalid_value", "message": "volume must be between 0 and 1" } }
```

Codes: `invalid_value` (400), `unknown_field` (400), `no_stable_reading` (409), `speaker_unavailable` (502).

---

Adding a field is fine. Renaming or removing one needs a team heads-up and an update here first.
