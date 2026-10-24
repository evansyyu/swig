"""Speak a phrase on the Google Nest Mini using ElevenLabs + pychromecast.

Heavy imports are lazy so the rest of the server runs without them.
Phrases are cached by provider, voice, model, and text to avoid stale voices.
Cached audio can be reused without contacting ElevenLabs.
"""
import hashlib
import os
import socket
import tempfile
import threading

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

NEST_NAME = os.environ.get("NEST_NAME", "Nest Mini")  # device name in the Google Home app
PORT = int(os.environ.get("PORT", "5000"))
AUDIO_DIR = os.path.join(os.path.dirname(__file__), "audio")
os.makedirs(AUDIO_DIR, exist_ok=True)

_cast = None  # cached device, rediscovered if playback fails
_audio_lock = threading.Lock()


class NestUnavailable(RuntimeError):
    pass


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


def audio_filename(text):
    return hashlib.sha1(text.encode("utf-8")).hexdigest() + ".mp3"


def ensure_audio(text):
    """Return a cached MP3, generating it with ElevenLabs only on a cache miss."""
    voice_id = os.environ.get("ELEVENLABS_VOICE_ID")
    if not voice_id:
        raise ValueError("set ELEVENLABS_VOICE_ID in server/.env")
    model_id = "eleven_multilingual_v2"
    name = audio_filename(f"elevenlabs:{voice_id}:{model_id}:{text}")
    path = os.path.join(AUDIO_DIR, name)

    with _audio_lock:
        if os.path.exists(path):
            return name
        api_key = os.environ.get("ELEVENLABS_API_KEY")
        if not api_key:
            raise ValueError("set ELEVENLABS_API_KEY in server/.env")
        from elevenlabs.client import ElevenLabs

        client = ElevenLabs(api_key=api_key)
        audio = client.text_to_speech.convert(
            text=text,
            voice_id=voice_id,
            model_id=model_id,
            output_format="mp3_44100_128",
        )
        # Publish only complete files, including when requests overlap or fail.
        temporary_path = None
        try:
            with tempfile.NamedTemporaryFile(dir=AUDIO_DIR, suffix=".tmp", delete=False) as file:
                temporary_path = file.name
                for chunk in audio:
                    file.write(chunk)
            if os.path.getsize(temporary_path) == 0:
                raise ValueError("ElevenLabs returned empty audio")
            os.replace(temporary_path, path)
        finally:
            if temporary_path and os.path.exists(temporary_path):
                os.remove(temporary_path)
    return name


def _find_cast():
    import pychromecast

    casts, browser = pychromecast.get_listed_chromecasts(friendly_names=[NEST_NAME])
    pychromecast.discovery.stop_discovery(browser)
    if not casts:
        raise NestUnavailable(f'"{NEST_NAME}" was not found on the network')
    return casts[0]


def speak(text, volume=0.5):
    """Play `text` on the Nest Mini. Raises NestUnavailable if it can't be reached."""
    global _cast
    try:
        name = ensure_audio(text)
    except Exception as exc:  # no internet and not cached
        raise NestUnavailable(f"could not generate speech: {exc}") from exc

    url = f"http://{lan_ip()}:{PORT}/audio/{name}"
    for attempt in range(2):
        try:
            if _cast is None:
                _cast = _find_cast()
            _cast.wait()
            _cast.set_volume(volume)
            mc = _cast.media_controller
            mc.play_media(url, "audio/mpeg")
            mc.block_until_active(timeout=10)
            return
        except NestUnavailable:
            raise
        except Exception as exc:
            _cast = None  # stale connection: rediscover once
            if attempt == 1:
                raise NestUnavailable(f"playback failed: {exc}") from exc
