# Server

Flask server implementing [`docs/API.md`](../docs/API.md).

| File | What it does |
| --- | --- |
| `app.py` | Routes, validation, reminder loop |
| `tracker.py` | Drink detection, status, lock logic (pure Python, easy to test) |
| `nest.py` | Plays speech on the Nest Mini (ElevenLabs + pychromecast) |
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

### ElevenLabs and Nest Mini setup

1. Set up the Nest Mini in Google Home and note its exact device name.
2. Connect the server and Nest to the same local network. For the full demo,
   connect the ESP32 and phone there too; a shared 2.4 GHz network is convenient.
   Avoid guest networks or access points that block device-to-device traffic.
3. Copy `server/.env.example` to `server/.env` and fill in
   `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, and `NEST_NAME`.
   Choose a voice available to your ElevenLabs account. Keep the key on the
   server; never put it in firmware, the phone app, or a commit.
4. If auto-detection chooses a VPN or the wrong interface, set `SERVER_IP` to
   the server computer's local Wi-Fi IPv4 address. The speaker downloads the
   MP3 from `http://<SERVER_IP>:<PORT>/audio/<filename>`, so do not use localhost.
   Allow inbound traffic to the server port on your private network.
5. Start with `python3 app.py` (or `python app.py` on Windows). Use this entry
   point to start both Flask and the background reminder loop.

The server loads `.env` from this folder regardless of the working directory.
Existing environment variables take precedence. The local Cast connection
requires no Google API key. ElevenLabs only generates the MP3; Flask serves it
and PyChromecast tells the Nest to play it.

See the [ElevenLabs quickstart](https://elevenlabs.io/docs/eleven-api/quickstart/)
and [PyChromecast documentation](https://github.com/home-assistant-libs/pychromecast).

| Env var | Default | Use |
| --- | --- | --- |
| `ELEVENLABS_API_KEY` | none | Required to generate new speech |
| `ELEVENLABS_VOICE_ID` | none | Required; voice available to your ElevenLabs account |
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

### Test speech from PowerShell

With the server running, open another PowerShell window:

```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:5000/api/speak" `
  -ContentType "application/json" `
  -Body '{"text":"Hello! WaterAlarmi is connected. Time to drink some water!"}'
```

Expected: the Nest plays the phrase and the endpoint returns `{ "ok": true }`
with HTTP 202. This confirms dispatch, not that the speaker finished playback.
Repeat the request to reuse cached audio without another ElevenLabs request.

| Symptom | Check |
| --- | --- |
| `could not generate speech` | `.env` values, voice access, API credits, and internet connection |
| Device not found | Exact `NEST_NAME`, shared network, and multicast/device isolation |
| Connected but silent | `SERVER_IP`, firewall, port, speaker volume; open an `/audio/...` URL from another device |

Both scheduled drinking reminders and refill prompts use this speech path.
Sip detection does not currently trigger spoken congratulations. Status overrides
change the status only; use `/api/speak` to test speech immediately.

## Notes

- Nest Mini playback needs the server and the Nest on the same network. `pychromecast` changes between versions: if discovery fails, check the installed version's docs.
- MP3s use `eleven_multilingual_v2` and are cached in `server/audio/` by provider, voice, model, and text. Changing the voice generates fresh audio; old gTTS files are not reused. Cache hits do not call ElevenLabs or need its API key (keep the same voice ID configured). **Generate the demo phrases before the event.** First-time generation needs internet; local playback still requires a working Cast network.
- Failed or empty generations are not cached. Speech errors use the existing `502 nest_unavailable` response.
- `.env` and generated audio are gitignored; `.env.example` contains placeholders only.
- State is in memory. A restart resets today's total and the settings.
- Detection thresholds (10 g drink, 30 g refill, 15 g bottle present) and status thresholds live as constants at the top of `tracker.py`.
