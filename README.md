# WaterAlarmi

SBUHacks 2026 · Hardware UI/UX track

Put any cup or bottle on a smart scale and WaterAlarmi tracks every sip. A friendly mascot, speaking through a Google Nest Mini, cheers you on when you keep pace and nags you when you fall behind. Fall too far behind and your comfort apps (Instagram, TikTok) lock until you drink water.

Phone reminders are easy to ignore and can't tell whether you drank. A weight sensor can.

## How it works

```
Load cell → HX711 → XIAO ESP32C3 ──WiFi──► Server (Flask) ──Cast──► Nest Mini
                                               ▲
                                               └──HTTP── iOS app (progress, settings, app lock)
```

The ESP32 only sends weight. The server detects drinks and refills, decides the status, and plays speech. The app reads the status and locks apps when told to.

## Repo layout

| Folder | What | Owner |
| --- | --- | --- |
| `firmware/` | Arduino sketches for the scale | Hardware |
| `server/` | Flask server: drink detection, status, Nest Mini | Hardware / server |
| `ios-app/` | Expo iOS app: mascot, progress, app blocking | App |
| `docs/` | `API.md`, the contract between all three | Everyone |

**`docs/API.md` is the contract.** Change it first, then the code, and tell the team.

## Quick start

**Server** (Python 3.10+)

```bash
cd server
pip3 install -r requirements.txt
python3 app.py            # prints the IP to put in the firmware
```

Open `http://<server-ip>:5000/` on a phone for a test page. No scale yet? `python3 simulate.py 500 450` fakes a sip.

**Firmware:** see [`firmware/README.md`](firmware/README.md). **App:** see [`ios-app/README.md`](ios-app/README.md).

**Network:** the server, ESP32, Nest Mini, and phone must share one 2.4 GHz network. Venue WiFi often blocks device-to-device traffic, so use a phone hotspot (turn on Maximize Compatibility on iPhone) or a small router.

## Secrets

This repo is public. Never commit WiFi names or passwords, API keys, or Apple signing files. `firmware/scale_firmware/secrets.h` and `.env` files are gitignored.

## Project docs

- [PRD](https://docs.google.com/document/d/1Nam2ALsrk16Ci24TDqdAEjSiVzpwnchIcs6OA0Z5d7w/edit)
- [System documentation](https://docs.google.com/document/d/1TIse47zRC7wrYSXRJBiZn49XmpIwtrPf876fU5obkOE/edit)

## Status

- [x] Load cell wiring test and calibration sketches
- [x] Server implementing `docs/API.md` (40 tests passing)
- [x] Scale firmware: WiFi, auto tare, BOOT button tare
- [x] Bottle flow: empty weight, daily baseline, refill alert, refill counting
- [ ] Calibrate the scale and run the full loop on real hardware
- [ ] Nest Mini playback on the demo network
- [ ] iOS app talking to the server
- [ ] Save state to a file so a restart keeps today's total
- [ ] Fallback when the Nest Mini is unavailable (buzzer or laptop speaker)
