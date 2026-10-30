# create-bareship

Creates an app from [Bareship](https://github.com/psingh2907/bareship), an offline-first, bare React Native
template for teams and AI agents, in one command:

```bash
npx create-bareship Acme
cd Acme
pnpm ios              # or: pnpm android
```

It checks your tools first and says how to fix anything missing, asks for the bundle id and display name,
then installs dependencies, runs `pod install` and makes the first git commit. Add `--yes` to ask nothing,
for CI and AI agents.

<p>
  <img src="https://raw.githubusercontent.com/psingh2907/bareship/main/assets/screenshots/ios/03-feed.jpg" alt="iOS: feed with an optimistic like" width="180">
  <img src="https://raw.githubusercontent.com/psingh2907/bareship/main/assets/screenshots/android/07-offline.jpg" alt="Android: offline, with a like waiting to sync" width="180">
  <img src="https://raw.githubusercontent.com/psingh2907/bareship/main/assets/screenshots/ios/05-dark-feed.jpg" alt="iOS: dark theme" width="180">
</p>

The app you get has sign-in, a feed and settings, an offline write queue, three environments installed side
by side, optional Firebase, fastlane releases, and architecture rules checked on every build. React Native
0.87, New Architecture only, iOS and Android.

Requirements, every option and what's inside are in the [main README](../../README.md#quick-start) and on
the [website](https://bareship.praveensingh.co.in).

## Maintaining this package

Its npm page shows the repository's [README](../../README.md), which `pnpm pack-template` copies into the
package, so edit that one for npm. This file is what GitHub shows for the folder
([ADR 0018](../../docs/decisions/0018-create-bareship.md)). The code is one file with no dependencies:
[`bin/create-bareship.mjs`](bin/create-bareship.mjs). Check changes with `scripts/ci/check-create.sh`
([packaging](../../docs/packaging.md)).
