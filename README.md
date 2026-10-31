# Swig (WaterAlarmi)

SBUHacks 2026 · Hardware UI/UX track

Put a water bottle on the **Balance**, a Bluetooth smart scale, and the **Sip** app tracks every sip by weight.
Reminders nudge you when you fall behind your pace. Fall too far behind and your comfort apps
(Instagram, TikTok) lock until you drink. Daily-goal streaks put you on a leaderboard.

Phone reminders are easy to ignore and can't tell whether you drank. A weight sensor can.

## How it works

```
Load cell → HX711 → XIAO ESP32C3 ──BLE──► Sip app (Expo) ──POST /weight──► Server (FastAPI + Flask) ── Postgres
                                                ▲                                │
                                                └────── POST /sync, WS /ws ──────┘
```

The scale only weighs. The phone is its only link to the server: it relays every reading, and the
server decides what was a drink.

### Scale (`firmware/`)

- Sends the weight over BLE as `SWIG-SCALE`, about twice a second, once calibrated.
- Calibrates from the app or from the Arduino Serial Monitor, and saves the factor in flash.
- Re-zeros itself after about 3 seconds steady and nearly empty (under 12 g), so drift doesn't
  build up. Waits 3 s after power-up before zeroing, and keeps the saved zero if a bottle is
  already on it at power-up.
- Tare by hand: the BOOT button, Serial `t`, or the app.

### App (`mobile/`, iOS first)

- **Sign up / log in**, then onboarding: daily goal, reminder interval, comfort apps to lock,
  and weighing the empty bottle (which links the Balance to your account).
- **Today:** progress ring, the Balance's live state and water left in the bottle, the next reminder,
  and the day's intake log (with undo). Each morning it asks you to put the full bottle on to set the
  starting weight.
- **Progress:** weekly chart, month calendar, current and best streak.
- **Community:** leaderboard ranked by current streak.
- **Settings:** goal, interval, active hours, app lock, bottle setup and scale calibration.
- Relays BLE readings to the server, including in the background (iOS Bluetooth background mode).
- Works offline: a local SQLite copy plus an outbox of changes, synced with `POST /sync`; live
  updates over the WebSocket.
- Schedules reminder notifications on the phone, so they arrive with the app closed. Also notifies
  when you fall behind, the apps lock, the bottle runs low, or you reach your goal.
- Locks the chosen apps with Screen Time (FamilyControls) while the server says `should_lock`, and
  unlocks on the next drink. A background task keeps the lock in step while the app isn't open.
  Android has no equivalent, so there the lock is off.
- Dev builds add a dev panel (Settings): shift the app clock, log a test sip, see why the apps are
  or aren't locked.

### Server (`server/`)

- **v1 (Flask, `app.py`):** `POST /weight`, drink and refill detection (`tracker.py`), and a test
  page at `/` for settings, status and demo overrides.
- **v2 (FastAPI, `api.py`):** accounts with JWT auth, status and pace per user, intake history,
  streaks, leaderboard, offline sync and the WebSocket. Mounts the v1 app, so one process
  (`python3 app.py`) serves both.
- Postgres in production, a SQLite file locally. Deployed on Railway.

**Detection in short:** the first steady weight each day is the baseline. Every later drop of 10 g
or more is a drink, a rise of 30 g or more is a refill. Status (`ahead`, `ok`, `behind`, `critical`)
comes from your pace through your active hours, and `critical` (4 hours of pace behind) locks the
apps. Full rules in [`docs/API.md`](docs/API.md).

## Repo layout

| Folder | What |
| --- | --- |
| `mobile/` | Expo app (SDK 58, Expo Router). `modules/screen-time/` and `targets/` are the native Screen Time module and shield extensions |
| `server/` | Python server: drink detection, accounts, sync, leaderboard |
| `firmware/` | Arduino sketches: `scale_firmware/` (the real one), plus wiring test and standalone calibration sketches |
| `docs/` | `API.md`: the contract between all three, including the scale's BLE characteristics |

**`docs/API.md` is the contract.** Change it first, then the code, and tell the team.

## Quick start

**Server** (Python 3.10+): see [`server/README.md`](server/README.md).

```bash
cd server
pip3 install -r requirements.txt
cp .env.example .env     # PowerShell: Copy-Item .env.example .env
python3 app.py
```

No scale yet? `python3 simulate.py 500 450` fakes a sip. `python3 seed_demo.py` fills the leaderboard
with demo users.

**App:** `cd mobile && npm install`. Bluetooth and Screen Time need a development build on a real
iPhone (not Expo Go or the simulator): `npx expo run:ios --device` on a Mac, or
`npx eas-cli@latest build --profile development`. Ad-hoc and TestFlight builds need Apple's
approval for the Family Controls entitlement. `EXPO_PUBLIC_API_URL` in `mobile/.env` picks the
server (default: the Railway deployment). See [`mobile/AGENTS.md`](mobile/AGENTS.md).

**Firmware:** see [`firmware/README.md`](firmware/README.md) for wiring, board setup and calibration.

## Secrets

This repo is public. Never commit API keys or Apple signing files. `.env` files are gitignored.

## Changelog

- Merged the app (`evansyyu/swig`) and the server and firmware (`yoobinchang/WaterAlarmi`) into one repo, keeping both histories.
- The scale now talks BLE to the phone, which relays readings to the server (was WiFi straight to the server).
- Dropped spoken reminders (ElevenLabs voices on a JBL speaker): reminders are plain notifications now.
- Firmware: fixed readings drifting negative (steady-only auto tare, power-up warm-up and saved zero,
  calibration rejects an unsteady known weight and the app shows it as failed).
