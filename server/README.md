# Server

Flask server implementing [`docs/API.md`](../docs/API.md).

| File | What it does |
| --- | --- |
| `app.py` | v1 routes, validation, reminder loop; `python3 app.py` starts everything |
| `api.py` | v2 (FastAPI): accounts, history, leaderboard, offline sync, WebSocket; mounts `app.py` |
| `accounts.py` | Per-user status, streaks, leaderboard and sync logic |
| `db.py`, `models.py`, `security.py` | Database (Postgres or SQLite), tables, passwords and tokens |
| `seed_demo.py` | Fills the leaderboard with demo users |
| `tracker.py` | Drink detection, status, lock logic (pure Python, easy to test) |
| `speaker.py` | Plays speech on the JBL speaker (ElevenLabs + local playback) |
| `templates/index.html` | Simple settings and progress page |
| `simulate.py` | Sends fake weights so you can test without the scale |

## Run

```bash
pip3 install -r requirements.txt
cp .env.example .env      # PowerShell: Copy-Item .env.example .env
# Fill in .env as described below before testing speech.
python3 app.py
```

It prints the server IP. Put it in the firmware's `secrets.h`.

### ElevenLabs and JBL speaker setup

1. Pair the JBL with the server computer over Bluetooth and select it as the
   sound output (macOS: Control Center → Sound; Windows: Settings → Sound).
2. Copy `server/.env.example` to `server/.env` and fill in
   `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID`.
   Choose a voice available to your ElevenLabs account. Keep the key on the
   server; never put it in firmware, the phone app, or a commit.
3. Start with `python3 app.py` (or `python app.py` on Windows). Use this entry
   point to start both Flask and the background reminder loop.

The server loads `.env` from this folder regardless of the working directory.
Existing environment variables take precedence. ElevenLabs generates the MP3 and
the computer plays it on its default output: `afplay` on macOS, Windows Media
Player through PowerShell on Windows, `ffplay` or `mpg123` on Linux.

See the [ElevenLabs quickstart](https://elevenlabs.io/docs/eleven-api/quickstart/).

| Env var | Default | Use |
| --- | --- | --- |
| `ELEVENLABS_API_KEY` | none | Required to generate new speech |
| `ELEVENLABS_VOICE_ID` | none | Required; voice available to your ElevenLabs account |
| `SERVER_IP` | auto-detected | Set it if the wrong IP is printed for the firmware |
| `PORT` | `5000` | Use `5001` on macOS (AirPlay Receiver holds 5000) |
| `DEBUG_WEIGHT` | off | `DEBUG_WEIGHT=1` prints every reading |

## Deploy on Railway

Railway runs tracking, the settings API, and the test page. Speech does not
work there (no speaker), so reminders are only logged.

1. Railway → **New Project → Deploy from GitHub repo** → `WaterAlarmi`.
2. **Settings → Root Directory:** `server`. `railway.json` sets the start command.
3. **Settings → Networking → Generate Domain.**
4. Leave `PORT` unset; Railway provides it. ElevenLabs variables are not needed.
5. **Add the PostgreSQL plugin** and set `DATABASE_URL=${{Postgres.DATABASE_URL}}` on the
   service. Without it, accounts live in a SQLite file that every redeploy wipes.
6. Set `JWT_SECRET` (`python3 -c "import secrets; print(secrets.token_urlsafe(48))"`) and,
   optionally, `DEFAULT_TIMEZONE` (default `America/New_York`).
7. Check `https://<domain>/health`, then set the firmware `SERVER_URL` to
   `https://<domain>/weight` and point the app at `https://<domain>`.

Accounts, intake history and streaks (v2) are stored in the database. The scale's live
detection state (v1) is still in memory, so a restart resets the in-progress reading
window. The v1 routes have no auth: anyone with the URL can post weights, so keep it private.

## Test

```bash
python3 -m unittest discover -s tests -t .
```

Try it by hand:

```bash
python3 simulate.py 200                                       # empty bottle on the scale
curl -X POST localhost:5000/api/bottle/empty                  # save it as the empty weight
python3 simulate.py 900 800 240 1200                          # fill, drink, run low, refill
curl localhost:5000/api/status
curl -X POST localhost:5000/api/demo/override -H 'Content-Type: application/json' -d '{"status":"critical"}'
curl -X POST localhost:5000/api/speak -H 'Content-Type: application/json' -d '{"text":"Time to drink!"}'
```

### Test speech from PowerShell

With the server running, open another PowerShell window:

```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:5000/api/speak" `
  -ContentType "application/json" `
  -Body '{"text":"Hello! WaterAlarmi is connected. Time to drink some water!"}'
```

Expected: the JBL plays the phrase and the endpoint returns `{ "ok": true }`
with HTTP 202 once playback finishes.
Repeat the request to reuse cached audio without another ElevenLabs request.

| Symptom | Check |
| --- | --- |
| `could not generate speech` | `.env` values, voice access, API credits, and internet connection |
| `playback failed` | Audio player missing (Linux: install `ffplay` or `mpg123`) |
| Returns 202 but silent | JBL still paired and selected as the output, system and JBL volume |

Both scheduled drinking reminders and refill prompts use this speech path.
Sip detection does not currently trigger spoken congratulations. Status overrides
change the status only; use `/api/speak` to test speech immediately.

## Notes

- We moved from a Google Nest Mini to a JBL because the venue Wi-Fi blocked the Nest.
- Speech plays on the server computer's sound output, so it only works when the server runs locally.
- MP3s use `eleven_multilingual_v2` and are cached in `server/audio/` by provider, voice, model, and text. Changing the voice generates fresh audio; old gTTS files are not reused. Cache hits do not call ElevenLabs or need its API key (keep the same voice ID configured). **Generate the demo phrases before the event.** First-time generation needs internet.
- Failed or empty generations are not cached. Speech errors return `502 speaker_unavailable`. Phrases play one at a time, never overlapping.
- `.env` and generated audio are gitignored; `.env.example` contains placeholders only.
- State is in memory. A restart resets today's total and the settings.
- Detection thresholds (10 g drink, 30 g refill, 15 g bottle present) and status thresholds live as constants at the top of `tracker.py`.
