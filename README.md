# Swig (WaterAlarmi)

SBUHacks 2026 · Hardware UI/UX track

Put any cup or bottle on a smart scale and Swig tracks every sip. A friendly mascot, speaking through a JBL speaker paired to your phone, cheers you on when you keep pace and nags you when you fall behind. Fall too far behind and your comfort apps (Instagram, TikTok) lock until you drink water. Streaks put you on a leaderboard.

Phone reminders are easy to ignore and can't tell whether you drank. A weight sensor can.

## How it works

```
Load cell → HX711 → XIAO ESP32C3 ──BLE──► Phone app (Expo) ──POST /weight──► Server (FastAPI + Flask) ── Postgres
                                            │      ▲                               │
                                            │      └──── /sync, WS /ws ────────────┘
                                            └── notifications with ElevenLabs clips ──Bluetooth──► JBL speaker
```

- The **scale** only weighs. It notifies the weight over BLE about twice a second.
- The **app** relays each reading to the server, keeps an offline copy of your data, locks apps when told to, and speaks: reminders are scheduled notifications whose sounds are bundled ElevenLabs clips, so they play through the JBL even with the app closed.
- The **server** detects drinks and refills, computes pace, status, lock and streaks, and stores accounts and history.

## Repo layout

| Folder | What |
| --- | --- |
| `mobile/` | Expo app (iOS first): progress, history, leaderboard, BLE relay, app lock, spoken reminders |
| `server/` | Python server: drink detection, accounts, sync, leaderboard. Deployed on Railway (root `server/`) |
| `firmware/` | Arduino sketches for the scale |
| `docs/` | `API.md`, the contract between all three |

**`docs/API.md` is the contract.** Change it first, then the code, and tell the team.

## Quick start

**Server** (Python 3.10+): see [`server/README.md`](server/README.md).

```bash
cd server
pip3 install -r requirements.txt
cp .env.example .env     # PowerShell: Copy-Item .env.example .env
python3 app.py
```

No scale yet? `python3 simulate.py 500 450` fakes a sip.

**Voice clips:** put `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID` in `server/.env`, then `python3 server/make_phrases.py`. It writes one pack per voice in `voices.json` (`mobile/assets/sounds/<voice>_<phrase>.wav`); commit them. The app bundles every complete pack, and Settings › Voice picks one.

**App:** `cd mobile && npm install`. It needs a development build on a real iPhone (Bluetooth and Screen Time don't work in Expo Go or the simulator): `npx expo run:ios --device` on a Mac. Ad-hoc and TestFlight builds need Apple's approval for the Family Controls entitlement. `EXPO_PUBLIC_API_URL` picks the server (default: the Railway deployment). See [`mobile/AGENTS.md`](mobile/AGENTS.md).

**Firmware:** see [`firmware/README.md`](firmware/README.md).

## Secrets

This repo is public. Never commit API keys or Apple signing files. `.env` files are gitignored.

## Project docs

- [PRD](https://docs.google.com/document/d/1Nam2ALsrk16Ci24TDqdAEjSiVzpwnchIcs6OA0Z5d7w/edit)
- [System documentation](https://docs.google.com/document/d/1TIse47zRC7wrYSXRJBiZn49XmpIwtrPf876fU5obkOE/edit)

## Changelog

- Merged the app (`evansyyu/swig`) and the server and firmware (`yoobinchang/WaterAlarmi`) into one repo, keeping both histories.
- The scale now talks BLE to the phone, which relays readings to the server (was WiFi straight to the server).
- Speech moved from the server's speaker to the phone: bundled ElevenLabs clips as notification sounds.
- Choice of voices: one clip pack per ElevenLabs voice, picked per phone in Settings.
- Switched from Google Nest Mini to a Bluetooth JBL speaker. The venue Wi-Fi blocked device-to-device traffic, so the Nest couldn't connect.

## Status

- [x] Server: drink detection, accounts, offline sync, streaks, leaderboard (68 tests passing)
- [x] Firmware: BLE weight, calibration from the app, auto tare, BOOT button tare
- [x] App: accounts, offline sync, app lock, BLE relay, spoken reminders
- [ ] Generate the voice clips and run the full loop on real hardware (iPhone + scale + JBL)
- [ ] Save the scale's detection state so a server restart keeps the in-progress reading window
