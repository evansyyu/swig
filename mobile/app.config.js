const fs = require('node:fs');
const path = require('node:path');

/**
 * app.json plus the voice packs. Every voice in voices.json whose clips are all generated
 * (server/make_phrases.py) is bundled as notification sounds and listed in `extra.voices`,
 * which Settings offers. A voice that hasn't been generated yet is left out instead of
 * breaking the build.
 */
const SOUNDS = path.join(__dirname, 'assets', 'sounds');
const read = (file) => JSON.parse(fs.readFileSync(path.join(SOUNDS, file), 'utf8'));

const phrases = Object.keys(read('phrases.json'));
const voices = Object.keys(read('voices.json')).filter((voice) =>
  phrases.every((key) => fs.existsSync(path.join(SOUNDS, `${voice}_${key}.wav`)))
);
const sounds = voices.flatMap((voice) => phrases.map((key) => `./assets/sounds/${voice}_${key}.wav`));

/** @param {import('expo/config').ConfigContext} context @returns {import('expo/config').ExpoConfig} */
module.exports = ({ config }) => ({
  ...config,
  plugins: config.plugins?.map((plugin) =>
    Array.isArray(plugin) && plugin[0] === 'expo-notifications' ? [plugin[0], { ...plugin[1], sounds }] : plugin
  ),
  extra: { ...config.extra, voices },
});
