"""Speak a phrase on the JBL speaker using ElevenLabs + local playback.

The JBL is paired with the server computer over Bluetooth and set as its sound
output, so playback is just "play this MP3 on this computer".
Heavy imports are lazy so the rest of the server runs without them.
Phrases are cached by provider, voice, model, and text to avoid stale voices.
Cached audio can be reused without contacting ElevenLabs.
"""
import hashlib
import os
import platform
import shutil
import socket
import subprocess
import tempfile
import threading

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

PORT = int(os.environ.get("PORT", "5000"))
AUDIO_DIR = os.path.join(os.path.dirname(__file__), "audio")
os.makedirs(AUDIO_DIR, exist_ok=True)
PLAY_TIMEOUT_S = 60

_audio_lock = threading.Lock()
_play_lock = threading.Lock()  # one phrase at a time, never overlapping


class SpeakerUnavailable(RuntimeError):
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


def player_command(path, volume):
    """Command that plays `path` on the default sound output and exits when done."""
    system = platform.system()
    if system == "Darwin":
        return ["afplay", "-v", str(volume), path]
    if system == "Windows":
        script = (
            "$p = New-Object -ComObject WMPlayer.OCX; "
            f"$p.settings.volume = {round(volume * 100)}; "
            f"$p.URL = '{path}'; $p.controls.play(); "
            "while ($p.playState -ne 1) { Start-Sleep -Milliseconds 100 }"
        )
        return ["powershell", "-NoProfile", "-Command", script]
    if shutil.which("ffplay"):
        return ["ffplay", "-nodisp", "-autoexit", "-loglevel", "quiet",
                "-volume", str(round(volume * 100)), path]
    if shutil.which("mpg123"):
        return ["mpg123", "-q", "-f", str(round(volume * 32768)), path]
    raise SpeakerUnavailable("no audio player found (install ffplay or mpg123)")


def speak(text, volume=0.5):
    """Play `text` on the JBL. Raises SpeakerUnavailable if it can't be played."""
    try:
        name = ensure_audio(text)
    except Exception as exc:  # no internet and not cached
        raise SpeakerUnavailable(f"could not generate speech: {exc}") from exc

    command = player_command(os.path.join(AUDIO_DIR, name), volume)
    with _play_lock:
        try:
            subprocess.run(command, check=True, timeout=PLAY_TIMEOUT_S,
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except (OSError, subprocess.SubprocessError) as exc:
            raise SpeakerUnavailable(f"playback failed: {exc}") from exc
