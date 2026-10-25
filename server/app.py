"""WaterAlarmi server. Implements docs/API.md (v1). api.py adds accounts (v2) around it.

Run:  python3 app.py        (listens on 0.0.0.0:$PORT, default 5000)
"""
import os
import socket

from dotenv import load_dotenv
from flask import Flask, jsonify, render_template, request

# Existing environment variables win over server/.env, whatever the working directory.
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

from tracker import Tracker, ValidationError  # noqa: E402 (after .env is loaded)

PORT = int(os.environ.get("PORT", "5000"))
app = Flask(__name__)
tracker = Tracker()
DEBUG_WEIGHT = os.environ.get("DEBUG_WEIGHT") == "1"


def error(code, message, http):
    return jsonify(error={"code": code, "message": message}), http


@app.after_request
def add_cors(resp):
    resp.headers["Access-Control-Allow-Origin"] = "*"
    resp.headers["Access-Control-Allow-Headers"] = "Content-Type"
    resp.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    return resp


HTTP_FOR_CODE = {"no_stable_reading": 409}


@app.errorhandler(ValidationError)
def on_validation_error(exc):
    return error(exc.code, exc.message, HTTP_FOR_CODE.get(exc.code, 400))


@app.errorhandler(500)
def on_internal_error(_exc):
    return error("internal_error", "internal server error", 500)


def body_json():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        raise ValidationError("invalid_value", "request body must be a JSON object")
    return data


# ---- Firmware ----
@app.post("/weight")
def weight():
    grams = body_json().get("grams")
    if isinstance(grams, bool) or not isinstance(grams, (int, float)) or not -100 <= grams <= 6000:
        raise ValidationError("invalid_value", "grams must be a number from -100 to 6000")
    event = tracker.process(grams)
    if DEBUG_WEIGHT:
        print(f"weight {grams:8.1f} g" + (f"  -> {event}" if event else ""))
    # The phone relaying the reading reacts to these right away (sound, sync, setup screens),
    # even in the background.
    live = tracker.live()
    return jsonify(ok=True, event=event, needs_refill=live["needs_refill"], stable=live["stable"],
                   stable_g=live["stable_g"])


# ---- App ----
@app.get("/api/status")
def status():
    return jsonify(tracker.status())


@app.get("/api/settings")
def get_settings():
    return jsonify(tracker.settings)


@app.post("/api/settings")
def post_settings():
    return jsonify(tracker.update_settings(body_json()))


# ---- Testing and demo ----
@app.post("/api/bottle/empty")
def bottle_empty():
    return jsonify(ok=True, empty_g=round(tracker.register_empty(), 1))


@app.post("/api/reset")
def reset():
    tracker.reset()
    return jsonify(ok=True)


@app.post("/api/demo/override")
def demo_override():
    tracker.set_override(body_json().get("status"))
    return jsonify(tracker.status())


# ---- Static pieces ----
@app.get("/")
def index():
    return render_template("index.html")


def lan_ip():
    """This computer's IP on the shared network. Override with the SERVER_IP env var."""
    if os.environ.get("SERVER_IP"):
        return os.environ["SERVER_IP"]
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("10.255.255.255", 1))  # no packet is sent
        return s.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        s.close()


if __name__ == "__main__":
    import uvicorn

    # api.py serves v2 and mounts this Flask app.
    print(f"Server on http://{lan_ip()}:{PORT}  (use this address as EXPO_PUBLIC_API_URL for a local server)")
    uvicorn.run("api:api", host="0.0.0.0", port=PORT, proxy_headers=True, forwarded_allow_ips="*")
