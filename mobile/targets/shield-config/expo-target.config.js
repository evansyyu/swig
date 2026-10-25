/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: 'shield-config',
  name: 'ShieldConfiguration',
  bundleIdentifier: '.shieldconfig',
  deploymentTarget: '16.4',
  frameworks: ['ManagedSettings', 'ManagedSettingsUI'],
  entitlements: {
    'com.apple.developer.family-controls': true,
    // Reads block groups written by the app to label the shield.
    'com.apple.security.application-groups':
      config.ios.entitlements['com.apple.security.application-groups'],
  },
});
