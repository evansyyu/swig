import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

import nest


class NestTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.audio_dir = patch.object(nest, "AUDIO_DIR", self.directory.name)
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
        name = nest.ensure_audio("Drink water!")
        self.assertEqual(Path(self.directory.name, name).read_bytes(), b"firstsecond")
        self.client_class.assert_called_once_with(api_key="test-key")
        self.convert.assert_called_once_with(
            text="Drink water!", voice_id="test-voice",
            model_id="eleven_multilingual_v2", output_format="mp3_44100_128",
        )
        del os.environ["ELEVENLABS_API_KEY"]
        self.assertEqual(nest.ensure_audio("Drink water!"), name)
        self.convert.assert_called_once()

    def test_voice_change_does_not_reuse_old_audio(self):
        first = nest.ensure_audio("Drink water!")
        os.environ["ELEVENLABS_VOICE_ID"] = "another-voice"
        self.convert.return_value = iter([b"new voice"])
        second = nest.ensure_audio("Drink water!")
        self.assertNotEqual(first, second)
        self.assertEqual(Path(self.directory.name, second).read_bytes(), b"new voice")

    def test_legacy_gtts_cache_is_not_reused(self):
        legacy = nest.audio_filename("Drink water!")
        Path(self.directory.name, legacy).write_bytes(b"old voice")
        self.assertNotEqual(nest.ensure_audio("Drink water!"), legacy)
        self.convert.assert_called_once()

    def test_failed_stream_is_not_cached_and_can_be_retried(self):
        def broken_stream():
            yield b"partial"
            raise RuntimeError("connection lost")
        self.convert.return_value = broken_stream()
        with self.assertRaisesRegex(RuntimeError, "connection lost"):
            nest.ensure_audio("Drink water!")
        self.assertEqual(list(Path(self.directory.name).iterdir()), [])
        self.convert.return_value = iter([b"complete"])
        name = nest.ensure_audio("Drink water!")
        self.assertEqual(Path(self.directory.name, name).read_bytes(), b"complete")

    def test_empty_response_is_not_cached(self):
        self.convert.return_value = iter([])
        with self.assertRaisesRegex(ValueError, "empty audio"):
            nest.ensure_audio("Drink water!")
        self.assertEqual(list(Path(self.directory.name).iterdir()), [])

    def test_missing_configuration_has_actionable_errors(self):
        for variable in ("ELEVENLABS_API_KEY", "ELEVENLABS_VOICE_ID"):
            with self.subTest(variable=variable), patch.dict(os.environ):
                del os.environ[variable]
                with self.assertRaisesRegex(ValueError, variable):
                    nest.ensure_audio("Drink water!")
        self.client_class.assert_not_called()

    def test_generation_error_uses_existing_speech_error(self):
        self.convert.side_effect = RuntimeError("generation failed")
        with self.assertRaisesRegex(nest.NestUnavailable, "could not generate speech"):
            nest.speak("Drink water!")

    def test_cast_uses_reachable_server_url_and_mp3_content_type(self):
        cast = MagicMock()
        with patch.object(nest, "_cast", cast), patch.object(
            nest, "ensure_audio", return_value="test.mp3"
        ), patch.object(nest, "lan_ip", return_value="192.168.1.42"):
            nest.speak("Drink water!", volume=0.7)
        cast.set_volume.assert_called_once_with(0.7)
        cast.media_controller.play_media.assert_called_once_with(
            f"http://192.168.1.42:{nest.PORT}/audio/test.mp3", "audio/mpeg"
        )

    def test_discovery_cleans_up_browser(self):
        cast, browser = MagicMock(), MagicMock()
        with patch("pychromecast.get_listed_chromecasts", return_value=([cast], browser)), patch(
            "pychromecast.discovery.stop_discovery"
        ) as stop:
            self.assertIs(nest._find_cast(), cast)
        stop.assert_called_once_with(browser)


if __name__ == "__main__":
    unittest.main()
