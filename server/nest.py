"""Speak a phrase on the Google Nest Mini using gTTS + pychromecast (Cast protocol).

Heavy imports are lazy so the rest of the server runs without them.
Phrases are cached by text, so a phrase generated once also plays offline.
Drop a pre-generated MP3 into server/audio/ named <sha1 of text>.mp3 to use your own voice file.
"""
import hashlib
import os
import socket

NEST_NAME = os.environ.get("NEST_NAME", "Nest Mini")  # device name in the Google Home app
PORT = int(os.environ.get("PORT", "5000"))
AUDIO_DIR = os.path.join(os.path.dirname(__file__), "audio")
os.makedirs(AUDIO_DIR, exist_ok=True)

_cast = None  # cached device, rediscovered if playback fails


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
    """Return the MP3 filename for `text`, generating it with gTTS if it is not cached."""
    name = audio_filename(text)
    path = os.path.join(AUDIO_DIR, name)
    if not os.path.exists(path):
        from gtts import gTTS  # needs internet the first time only

        gTTS(text).save(path)
    return name


def _find_cast():
    import pychromecast

    casts, browser = pychromecast.get_listed_chromecasts(friendly_names=[NEST_NAME])
    browser.stop_discovery()
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
            mc.play_media(url, "audio/mp3")
            mc.block_until_active(timeout=10)
            return
        except NestUnavailable:
            raise
        except Exception as exc:
            _cast = None  # stale connection: rediscover once
            if attempt == 1:
                raise NestUnavailable(f"playback failed: {exc}") from exc
