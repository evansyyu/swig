/** @type {import('@bacons/apple-targets/app.plugin').Config} */
module.exports = {
  type: 'shield-action',
  name: 'ShieldAction',
  bundleIdentifier: '.shieldaction',
  deploymentTarget: '16.4',
  frameworks: ['ManagedSettings'],
  entitlements: {
    'com.apple.developer.family-controls': true,
  },
};
