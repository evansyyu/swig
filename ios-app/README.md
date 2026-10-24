# iOS app

Put the Expo app in this folder, so `package.json` and `app.json` sit directly in `ios-app/`.

The app is a client of the server. Read [`docs/API.md`](../docs/API.md) first.

- Poll `GET /api/status` every 5 seconds.
- Lock the chosen apps when `should_lock` is `true` and the user has turned locking on. Unlock when it turns `false`.
- Let the user type the server address in settings. The IP changes with each hotspot.
- Use `status` for the mascot mood: `ahead`, `ok`, `behind`, `critical`.
- Add a fake-data mode so the app can be built without the server.

## Things that will bite

- App blocking uses Apple's Screen Time APIs (Family Controls, ManagedSettings). It needs a real device and a development build, not Expo Go and not the simulator.
- Install with a local build (`npx expo run:ios --device`). TestFlight and ad-hoc builds need Apple's approval for the Family Controls entitlement.
- Screen Time must be on, and the user picks the apps to block with Apple's picker. Apps can't be named in code.
- The server speaks plain HTTP. Add a local-network ATS exception and `NSLocalNetworkUsageDescription` to the iOS config.
- Don't commit `ios/`, `android/`, `node_modules/`, or signing files (already gitignored).
