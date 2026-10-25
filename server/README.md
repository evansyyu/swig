# Server

Flask server implementing [`docs/API.md`](../docs/API.md).

| File | What it does |
| --- | --- |
| `app.py` | v1 routes and validation; `python3 app.py` starts everything |
| `api.py` | v2 (FastAPI): accounts, history, leaderboard, offline sync, WebSocket; mounts `app.py` |
| `accounts.py` | Per-user status, streaks, leaderboard and sync logic |
| `db.py`, `models.py`, `security.py` | Database (Postgres or SQLite), tables, passwords and tokens |
| `seed_demo.py` | Fills the leaderboard with demo users |
| `tracker.py` | Drink detection, status, lock logic (pure Python, easy to test) |
| `templates/index.html` | Simple settings and progress page |
| `simulate.py` | Sends fake weights so you can test without the scale |

## Run

```bash
pip3 install -r requirements.txt
cp .env.example .env      # PowerShell: Copy-Item .env.example .env
python3 app.py
```

It prints the server's LAN address. To use a local server from the phone, set
`EXPO_PUBLIC_API_URL=http://<that IP>:<PORT>` in `mobile/.env`.

The scale reaches the server through the phone: the app relays each BLE reading to `POST /weight`.

The server loads `.env` from this folder regardless of the working directory.
Existing environment variables take precedence.

| Env var | Default | Use |
| --- | --- | --- |
| `SERVER_IP` | auto-detected | Set it if the wrong LAN IP is printed |
| `PORT` | `5000` | Use `5001` on macOS (AirPlay Receiver holds 5000) |
| `DEBUG_WEIGHT` | off | `DEBUG_WEIGHT=1` prints every reading |

## Deploy on Railway

Railway runs tracking, accounts, sync, and the test page.

1. Railway → **New Project → Deploy from GitHub repo** → `swig` (this monorepo).
   For the existing service: **Settings → Source** → connect `swig`, branch `main`.
2. **Settings → Root Directory:** `server`. `railway.json` sets the start command.
3. **Settings → Networking → Generate Domain.**
4. Leave `PORT` unset; Railway provides it.
5. **Add the PostgreSQL plugin** and set `DATABASE_URL=${{Postgres.DATABASE_URL}}` on the
   service. Without it, accounts live in a SQLite file that every redeploy wipes.
6. Set `JWT_SECRET` (`python3 -c "import secrets; print(secrets.token_urlsafe(48))"`) and,
   optionally, `DEFAULT_TIMEZONE` (default `America/New_York`).
7. Check `https://<domain>/health`, then point the app at `https://<domain>` (`EXPO_PUBLIC_API_URL`).

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
```

## Notes

- `.env` is gitignored; `.env.example` contains placeholders only.
- Accounts, intake and streaks are in the database. The scale's detection state is in memory, so a restart resets the in-progress reading window.
- Detection thresholds (10 g drink, 30 g refill, 15 g bottle present) and status thresholds live as constants at the top of `tracker.py`.
