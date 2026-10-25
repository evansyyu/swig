"""Generate the app's spoken phrase packs with ElevenLabs, one per voice.

  python3 make_phrases.py                  # only clips that are missing, every voice
  python3 make_phrases.py --voice lily     # just one voice (repeatable)
  python3 make_phrases.py --force          # regenerate (e.g. after rewording a phrase)

Reads mobile/assets/sounds/phrases.json ({"key": "text"}) and voices.json
({"slug": {"name", "description", "elevenlabs_id"}}) and writes <slug>_<key>.wav next to
them. A voice whose elevenlabs_id is null uses ELEVENLABS_VOICE_ID from server/.env.
The app bundles every complete pack as notification sounds (mobile/app.config.ts), so
reminders speak through whatever the phone plays on (the paired JBL) even while the app
is closed, and Settings offers each bundled voice. iOS notification sounds must be
WAV/CAF/AIFF with linear PCM and under 30 seconds, hence raw PCM wrapped in WAV.
Needs ELEVENLABS_API_KEY in server/.env. Commit the clips.
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
    parser.add_argument("--voice", action="append", help="only this voice slug from voices.json")
    args = parser.parse_args()

    phrases = json.loads((SOUNDS / "phrases.json").read_text(encoding="utf-8"))
    voices = json.loads((SOUNDS / "voices.json").read_text(encoding="utf-8"))
    unknown = set(args.voice or []) - voices.keys()
    if unknown:
        raise SystemExit(f"not in voices.json: {', '.join(sorted(unknown))}")

    client = None
    for slug, voice in voices.items():
        if args.voice and slug not in args.voice:
            continue
        todo = {key: text for key, text in phrases.items()
                if args.force or not (SOUNDS / f"{slug}_{key}.wav").exists()}
        if not todo:
            print(f"skip  {slug} (complete)")
            continue
        voice_id = voice.get("elevenlabs_id") or os.environ.get("ELEVENLABS_VOICE_ID")
        if not voice_id:
            print(f"skip  {slug}: set ELEVENLABS_VOICE_ID in server/.env for this voice")
            continue
        if client is None:
            if not os.environ.get("ELEVENLABS_API_KEY"):
                raise SystemExit("set ELEVENLABS_API_KEY in server/.env")
            from elevenlabs.client import ElevenLabs

            client = ElevenLabs(api_key=os.environ["ELEVENLABS_API_KEY"])
        for key, text in todo.items():
            path = SOUNDS / f"{slug}_{key}.wav"
            pcm = synthesize(client, voice_id, text)
            write_wav(path, pcm)
            print(f"wrote {path.name}  ({len(pcm) / 2 / SAMPLE_RATE:.1f} s)  {text}")


if __name__ == "__main__":
    main()
