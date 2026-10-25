"""Generate the app's spoken phrase pack with ElevenLabs.

  python3 make_phrases.py            # only phrases whose clip is missing
  python3 make_phrases.py --force    # regenerate every clip (e.g. after changing the voice)

Reads mobile/assets/sounds/phrases.json ({"key": "text"}) and writes <key>.wav next to it.
The app bundles these as notification sounds, so reminders speak through whatever the
phone plays on (the paired JBL) even while the app is closed. iOS notification sounds
must be WAV/CAF/AIFF with linear PCM and under 30 seconds, hence raw PCM wrapped in WAV.
Needs ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID in server/.env. Commit the clips.
"""
import argparse
import json
import os
import wave
from pathlib import Path

from dotenv import load_dotenv

HERE = Path(__file__).resolve().parent
SOUNDS = HERE.parent / "mobile" / "assets" / "sounds"
MODEL_ID = "eleven_multilingual_v2"
SAMPLE_RATE = 24000  # ElevenLabs "pcm_24000": 16-bit mono little-endian

load_dotenv(HERE / ".env")


def synthesize(client, voice_id, text):
    chunks = client.text_to_speech.convert(text=text, voice_id=voice_id, model_id=MODEL_ID,
                                           output_format=f"pcm_{SAMPLE_RATE}")
    pcm = b"".join(chunks)
    if not pcm:
        raise RuntimeError("ElevenLabs returned empty audio")
    return pcm


def write_wav(path, pcm):
    tmp = path.with_suffix(".tmp")
    with wave.open(str(tmp), "wb") as out:
        out.setnchannels(1)
        out.setsampwidth(2)
        out.setframerate(SAMPLE_RATE)
        out.writeframes(pcm)
    os.replace(tmp, path)


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--force", action="store_true", help="regenerate clips that already exist")
    args = parser.parse_args()

    api_key, voice_id = os.environ.get("ELEVENLABS_API_KEY"), os.environ.get("ELEVENLABS_VOICE_ID")
    if not api_key or not voice_id:
        raise SystemExit("set ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID in server/.env")
    from elevenlabs.client import ElevenLabs

    client = ElevenLabs(api_key=api_key)
    phrases = json.loads((SOUNDS / "phrases.json").read_text(encoding="utf-8"))
    for key, text in phrases.items():
        path = SOUNDS / f"{key}.wav"
        if path.exists() and not args.force:
            print(f"skip  {path.name}")
            continue
        pcm = synthesize(client, voice_id, text)
        write_wav(path, pcm)
        print(f"wrote {path.name}  ({len(pcm) / 2 / SAMPLE_RATE:.1f} s)  {text}")


if __name__ == "__main__":
    main()
