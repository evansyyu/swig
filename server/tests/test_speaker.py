import os
import tempfile
import unittest
from pathlib import Path
import subprocess
from unittest.mock import patch

import speaker


class SpeakerTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.audio_dir = patch.object(speaker, "AUDIO_DIR", self.directory.name)
        self.audio_dir.start()
        self.addCleanup(self.audio_dir.stop)
        self.environment = patch.dict(os.environ, {
            "ELEVENLABS_API_KEY": "test-key",
            "ELEVENLABS_VOICE_ID": "test-voice",
        })
        self.environment.start()
        self.addCleanup(self.environment.stop)
        self.client_patch = patch("elevenlabs.client.ElevenLabs")
        self.client_class = self.client_patch.start()
        self.addCleanup(self.client_patch.stop)
        self.convert = self.client_class.return_value.text_to_speech.convert
        self.convert.return_value = iter([b"first", b"second"])

    def test_generates_mp3_with_selected_voice_and_reuses_cache(self):
        name = speaker.ensure_audio("Drink water!")
        self.assertEqual(Path(self.directory.name, name).read_bytes(), b"firstsecond")
        self.client_class.assert_called_once_with(api_key="test-key")
        self.convert.assert_called_once_with(
            text="Drink water!", voice_id="test-voice",
            model_id="eleven_multilingual_v2", output_format="mp3_44100_128",
        )
        del os.environ["ELEVENLABS_API_KEY"]
        self.assertEqual(speaker.ensure_audio("Drink water!"), name)
        self.convert.assert_called_once()

    def test_voice_change_does_not_reuse_old_audio(self):
        first = speaker.ensure_audio("Drink water!")
        os.environ["ELEVENLABS_VOICE_ID"] = "another-voice"
        self.convert.return_value = iter([b"new voice"])
        second = speaker.ensure_audio("Drink water!")
        self.assertNotEqual(first, second)
        self.assertEqual(Path(self.directory.name, second).read_bytes(), b"new voice")

    def test_legacy_gtts_cache_is_not_reused(self):
        legacy = speaker.audio_filename("Drink water!")
        Path(self.directory.name, legacy).write_bytes(b"old voice")
        self.assertNotEqual(speaker.ensure_audio("Drink water!"), legacy)
        self.convert.assert_called_once()

    def test_failed_stream_is_not_cached_and_can_be_retried(self):
        def broken_stream():
            yield b"partial"
            raise RuntimeError("connection lost")
        self.convert.return_value = broken_stream()
        with self.assertRaisesRegex(RuntimeError, "connection lost"):
            speaker.ensure_audio("Drink water!")
        self.assertEqual(list(Path(self.directory.name).iterdir()), [])
        self.convert.return_value = iter([b"complete"])
        name = speaker.ensure_audio("Drink water!")
        self.assertEqual(Path(self.directory.name, name).read_bytes(), b"complete")

    def test_empty_response_is_not_cached(self):
        self.convert.return_value = iter([])
        with self.assertRaisesRegex(ValueError, "empty audio"):
            speaker.ensure_audio("Drink water!")
        self.assertEqual(list(Path(self.directory.name).iterdir()), [])

    def test_missing_configuration_has_actionable_errors(self):
        for variable in ("ELEVENLABS_API_KEY", "ELEVENLABS_VOICE_ID"):
            with self.subTest(variable=variable), patch.dict(os.environ):
                del os.environ[variable]
                with self.assertRaisesRegex(ValueError, variable):
                    speaker.ensure_audio("Drink water!")
        self.client_class.assert_not_called()

    def test_generation_error_uses_existing_speech_error(self):
        self.convert.side_effect = RuntimeError("generation failed")
        with self.assertRaisesRegex(speaker.SpeakerUnavailable, "could not generate speech"):
            speaker.speak("Drink water!")

    def test_plays_cached_mp3_with_volume_on_mac(self):
        with patch.object(speaker, "ensure_audio", return_value="test.mp3"), patch(
            "platform.system", return_value="Darwin"
        ), patch("subprocess.run") as run:
            speaker.speak("Drink water!", volume=0.7)
        command = run.call_args.args[0]
        self.assertEqual(command, ["afplay", "-v", "0.7", os.path.join(self.directory.name, "test.mp3")])
        self.assertTrue(run.call_args.kwargs["check"])

    def test_windows_command_scales_volume_to_percent(self):
        with patch("platform.system", return_value="Windows"):
            command = speaker.player_command("C:\\audio\\test.mp3", 0.7)
        self.assertEqual(command[0], "powershell")
        self.assertIn("$p.settings.volume = 70", command[-1])

    def test_player_failure_uses_speech_error(self):
        failure = subprocess.CalledProcessError(1, ["afplay"])
        with patch.object(speaker, "ensure_audio", return_value="test.mp3"), patch(
            "platform.system", return_value="Darwin"
        ), patch("subprocess.run", side_effect=failure):
            with self.assertRaisesRegex(speaker.SpeakerUnavailable, "playback failed"):
                speaker.speak("Drink water!")

    def test_missing_player_on_linux_has_actionable_error(self):
        with patch("platform.system", return_value="Linux"), patch("shutil.which", return_value=None):
            with self.assertRaisesRegex(speaker.SpeakerUnavailable, "ffplay"):
                speaker.player_command("/tmp/test.mp3", 0.5)


if __name__ == "__main__":
    unittest.main()
