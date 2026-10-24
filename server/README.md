# Server

Flask server implementing [`docs/API.md`](../docs/API.md).

| File | What it does |
| --- | --- |
| `app.py` | Routes, validation, reminder loop |
| `tracker.py` | Drink detection, status, lock logic (pure Python, easy to test) |
| `nest.py` | Plays speech on the Nest Mini (gTTS + pychromecast) |
| `templates/index.html` | Simple settings and progress page |
| `simulate.py` | Sends fake weights so you can test without the scale |

## Run

```bash
pip3 install -r requirements.txt
python3 app.py
```

It prints the server IP. Put it in the firmware's `secrets.h`.

| Env var | Default | Use |
| --- | --- | --- |
| `NEST_NAME` | `Nest Mini` | Device name in the Google Home app |
| `SERVER_IP` | auto-detected | Set it if the wrong IP is picked |
| `PORT` | `5000` | |
| `DEBUG_WEIGHT` | off | `DEBUG_WEIGHT=1` prints every reading |

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

## Notes

- Nest Mini playback needs the server and the Nest on the same network. `pychromecast` changes between versions: if discovery fails, check the installed version's docs.
- Phrases are cached in `server/audio/` by text, so a phrase generated once also plays without internet. **Generate the demo phrases before the event.**
- State is in memory. A restart resets today's total and the settings.
- Detection thresholds (10 g drink, 30 g refill, 15 g bottle present) and status thresholds live as constants at the top of `tracker.py`.
