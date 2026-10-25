# WaterAlarmi API (v1)

Base URL: `http://<SERVER_IP>:5000` · JSON · no auth (local network only)
Units: grams (g), milliliters (ml). Times are ISO 8601.

| Method | Path | Caller | Purpose |
| --- | --- | --- | --- |
| POST | `/weight` | App (scale relay) | Send a weight reading (about 2 per second) |
| GET | `/api/status` | Test page | Progress and lock decision (the app uses v2 `/me/status`) |
| GET / POST | `/api/settings` | Test page | Read / change settings |
| POST | `/api/bottle/empty` | Test page | Save the empty bottle weight |
| POST | `/api/reset` | Demo | Reset today's total and the lock |
| POST | `/api/demo/override` | Demo | Force a status |

## The scale (BLE)

The scale doesn't talk to the server itself. It advertises as `SWIG-SCALE` with service
`12345678-1234-1234-1234-1234567890ab`, and the phone app relays each reading to `POST /weight`.

| Characteristic | Properties | Content |
| --- | --- | --- |
| `abcd1234-5678-90ab-cdef-1234567890ab` | read, notify | Weight in grams as text (`"312.50"`), about twice a second once calibrated |
| `abcd1235-5678-90ab-cdef-1234567890ab` | write | Commands: `t` tare, `c` calibrate, then the answers to its prompts (`ok`, the known grams, or `x` to cancel) |
| `abcd1236-5678-90ab-cdef-1234567890ab` | read, notify | Calibration step: `cal:empty`, `cal:weight`, `cal:done`, `cal:cancelled`, `cal:failed` (no steady known weight; old factor kept) (`ready` at boot) |

## POST /weight

```json
{ "grams": 312.5 }
```

Returns `{ "ok": true, "event": null, "needs_refill": false, "stable": true, "stable_g": 312.4 }`. `event` is the
drink or refill this reading completed (same shape as `last_event`), so the relaying phone can react at once.
`stable` and `stable_g` are the same as in `GET /scale/live` (the weight has settled with a bottle on the scale,
and the settled weight), so the relaying phone's setup screens update with every reading instead of polling.
Must answer fast; never wait for speech.

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
| `status` | `ahead`, `ok`, `behind`, or `critical` |
| `should_lock` | **The app locks apps when this is `true`** (only if the user turned locking on) |
| `last_drink_at` | `null` if nothing drunk today |
| `last_event` | Latest `drink` or `refill`, or `null`. A refill has `ml` (added) and `drank_ml` (see below) |
| `water_ml` | Water in the bottle now. `null` until the empty weight is saved |
| `empty_g` | Saved empty bottle weight, or `null` |
| `needs_refill` | `true` when the bottle has less than 50 ml of water |

**Bottle flow:** the first stable reading of each day is the baseline, never a drink. Every later drop is a drink. When the bottle is refilled, the water left before the refill (if 100 ml or less) counts as drunk and is reported as `drank_ml`. Topping up a bottle that still has lots of water is not a drink. The empty weight must be saved first, or refills only move the baseline.

**Status** is based on pace: `expected_ml = goal_ml x share of active hours passed`, `ratio = total_ml / expected_ml`,
and `hours_behind = (expected_ml - total_ml) / (goal_ml / active hours)`, how many hours of pace the intake trails by.

| Condition (first match) | `status` |
| --- | --- |
| `total_ml >= goal_ml` | `ahead` |
| Outside active hours, or `expected_ml < 300` | `ok` |
| `ratio >= 1.1` | `ahead` |
| `hours_behind >= 4` | `critical` |
| `ratio >= 0.8` | `ok` |
| otherwise | `behind` |

**Lock:** `should_lock` turns `true` when status becomes `critical`, and turns `false` on the next detected drink, when the goal is reached, or on reset.

## GET / POST /api/settings

```json
{ "goal_ml": 2000, "interval_min": 30, "start_hour": 9, "end_hour": 22 }
```

POST accepts any subset and returns the full object. Ranges: `goal_ml` 250 to 6000, `interval_min` 1 to 240, `start_hour` 0 to 23, `end_hour` 1 to 24.

## POST /api/bottle/empty

No body. Saves the weight now on the scale as the empty bottle (include the lid if it is used). Returns `{ "ok": true, "empty_g": 200.0 }`, or `409 no_stable_reading` if no bottle is resting on the scale yet.

## POST /api/reset

No body. Returns `{ "ok": true }`.

## POST /api/demo/override

`{ "status": "critical" }` forces a status. Send `{ "status": null }` to clear. Returns the same body as `/api/status`.

## Errors

```json
{ "error": { "code": "invalid_value", "message": "goal_ml must be an integer from 250 to 6000" } }
```

Codes: `invalid_value` (400), `unknown_field` (400), `no_stable_reading` (409).


# v2: accounts, history, leaderboard, offline sync

Served by the same process (`server/api.py`, FastAPI; v1 above is unchanged). Interactive docs: `GET /v2/docs`.
App endpoints need `Authorization: Bearer <token>`. Errors use the same shape as v1, plus `unauthorized` (401),
`username_taken` (409) and `not_found` (404). Times are UTC ISO 8601; "day" is the user's local date.

**The scale** belongs to the user who last called `POST /me/bottle/empty` with no body. Its drinks, refills and
daily baseline are logged to that user, and that user's goal, interval and active hours drive its status.
`/weight` stays unauthenticated.

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/auth/register` | `{username, password, goal_ml?, interval_min?, start_hour?, end_hour?, lock_enabled?, timezone?}` → `201 {token, user}` |
| POST | `/auth/login` | `{username, password}` → `{token, user}` |
| GET | `/me` | Profile: settings, `empty_g`, `rank`, `scale_owner` |
| GET | `/me/status` | Like `/api/status` for this user, plus `day`, `expected_ml`, `next_reminder_at`, `streak`, `best_streak`, `scale` |
| PATCH | `/me/settings` | Any of `goal_ml, interval_min, start_hour, end_hour, lock_enabled, timezone` (v1 ranges) |
| GET | `/me/history?days=30` | Day logs: `{day, goal_ml, consumed_ml, met, met_at}` |
| GET | `/me/intake?day=YYYY-MM-DD` | Intake events for a day (default today) |
| POST | `/me/intake` | Manual log `{id?, amount_ml, at?}`. Send your own UUID `id` so retries are safe. `at` (default now) may be up to 7 days back or ahead, and sets the day |
| DELETE | `/me/intake/{id}` | Undo (marks it `voided`) |
| POST | `/me/bottle/empty` | No body: weigh the bottle on the scale and take the scale. `{weight_g}`: save as given |
| GET | `/scale/live` | `{connected, grams, stable, water_ml, empty_g, needs_refill, owner}` for the setup screen |
| GET | `/leaderboard?limit=50` | `{entries: [{rank, username, streak, best_streak, is_me}], me, total}` |
| GET | `/sync?since=` | Pull (see below) |
| POST | `/sync` | `{mutations: [...], since?}` → push the outbox, then pull, in one round trip |
| WS | `/ws?token=` | Pushes `{"type":"state","changed":bool,"status":{...}}` on every change and every 30 s. `changed: true` means pull |
| GET | `/health` | `{ok, time}` |

**Intake event:** `{id, day, kind, source, amount_ml, detail_ml, at, voided, updated_at}`. `kind` is `drink`, `refill`,
`baseline` or `manual`; `amount_ml` counts toward the day (0 for a baseline); `detail_ml` is the water in the
bottle (baseline) or the water added (refill).

**Streak:** consecutive days with `consumed_ml >= goal_ml`. Today counts once the goal is met; a missed day resets
it to 0. Met days ahead of today (only possible with the app's developer clock, see `at` above) extend it. The
leaderboard ranks by current streak (ties share a rank), never by volume.

## Offline sync

The app keeps a local copy and an outbox, and syncs with `POST /sync`:

```json
{ "since": "2026-10-24T18:00:00+00:00",
  "mutations": [
    { "id": "m-1", "type": "intake.add", "payload": { "id": "<uuid>", "amount_ml": 250, "at": "2026-10-24T17:55:12Z" } },
    { "id": "m-2", "type": "intake.void", "payload": { "id": "<uuid>" } },
    { "id": "m-3", "type": "settings.patch", "payload": { "goal_ml": 2500 } } ] }
```

Response: `{results: [{id, ok, error?}], server_time, full, user, status, days, intakes, leaderboard}`.

- Mutations apply in order. `intake.add` is idempotent on its `id`, so resending after a lost response is safe.
- A result with `ok: false` will never succeed (bad value): drop it. A 5xx or network error: keep it and retry.
- Store `server_time` and send it as `since` next time. Without `since` you get a full snapshot (35 days of
  intake, 120 days of day logs); with it, only rows changed since then (with a small overlap; upsert by key).
- Rows are never deleted; undone intake comes back with `voided: true`.

---

Adding a field is fine. Renaming or removing one needs a team heads-up and an update here first.
