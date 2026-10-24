"""WaterAlarmi server. Implements docs/API.md.

Run:  python3 app.py        (listens on 0.0.0.0:5000)
"""
import os
import threading
import time

from flask import Flask, jsonify, render_template, request, send_from_directory

import nest
from tracker import Tracker, ValidationError

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
    return jsonify(ok=True)


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
@app.post("/api/speak")
def speak_now():
    data = request.get_json(silent=True) or {}
    text = data.get("text") or tracker.settings["message"]
    try:
        nest.speak(text, tracker.settings["volume"])
    except nest.NestUnavailable as exc:
        return error("nest_unavailable", str(exc), 502)
    return jsonify(ok=True), 202


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
@app.get("/audio/<path:name>")
def audio(name):
    return send_from_directory(nest.AUDIO_DIR, name)


@app.get("/")
def index():
    return render_template("index.html")


# ---- Reminders ----
REFILL_MESSAGE = "Your bottle is almost empty. Time to refill!"


def say(text):
    try:
        nest.speak(text, tracker.settings["volume"])
    except nest.NestUnavailable as exc:
        print(f"[speak] Nest unavailable: {exc}")  # TODO: buzzer / laptop speaker fallback


def reminder_loop():
    while True:
        time.sleep(10)
        if tracker.reminder_due():
            say(tracker.settings["message"])
        elif tracker.refill_prompt_due():
            say(REFILL_MESSAGE)


if __name__ == "__main__":
    threading.Thread(target=reminder_loop, daemon=True).start()
    print(f"Server on http://{nest.lan_ip()}:{nest.PORT}  (put this IP in firmware secrets.h)")
    app.run(host="0.0.0.0", port=nest.PORT)
