<p align="center">
  <img src="https://raw.githubusercontent.com/psingh2907/bareship/main/assets/brand/logo.svg" alt="" width="96" height="96">
</p>

<h1 align="center">Bareship</h1>

<p align="center">
  <strong>An offline-first, bare React Native template for teams and AI agents.</strong><br>
  No Expo, no accounts needed to run it, and the architecture rules are checked on every build.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React_Native-0.87-61dafb" alt="React Native 0.87">
  <img src="https://img.shields.io/badge/New_Architecture-only-2ea44f" alt="New Architecture only">
  <img src="https://img.shields.io/badge/TypeScript-6_strict-3178c6" alt="TypeScript 6 strict">
  <img src="https://img.shields.io/badge/platforms-iOS_%7C_Android-lightgrey" alt="iOS and Android">
  <a href="https://www.npmjs.com/package/create-bareship"><img src="https://img.shields.io/npm/v/create-bareship" alt="npm version"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT license"></a>
</p>

<p align="center">
  <a href="https://bareship.praveensingh.co.in"><strong>Website and docs</strong></a> ·
  <a href="#quick-start">Quick start</a> ·
  <a href="https://www.npmjs.com/package/create-bareship">npm</a> ·
  <a href="#whats-inside">What's inside</a> ·
  <a href="docs/architecture.md">Architecture</a> ·
  <a href="#roadmap">Roadmap</a>
</p>

---

<table align="center">
  <tr><th colspan="5">iOS</th></tr>
  <tr>
    <td><img src="https://raw.githubusercontent.com/psingh2907/bareship/main/assets/screenshots/ios/03-feed.jpg" alt="iOS: feed with an optimistic like" width="150"></td>
    <td><img src="https://raw.githubusercontent.com/psingh2907/bareship/main/assets/screenshots/ios/05-dark-feed.jpg" alt="iOS: dark theme" width="150"></td>
    <td><img src="https://raw.githubusercontent.com/psingh2907/bareship/main/assets/screenshots/ios/06-hindi-feed.jpg" alt="iOS: the feed in Hindi" width="150"></td>
    <td><img src="https://raw.githubusercontent.com/psingh2907/bareship/main/assets/screenshots/ios/04-settings.png" alt="iOS: settings" width="150"></td>
    <td><img src="https://raw.githubusercontent.com/psingh2907/bareship/main/assets/screenshots/ios/02-sign-in.png" alt="iOS: sign-in with the demo account" width="150"></td>
  </tr>
  <tr>
    <td align="center"><sub>Feed</sub></td>
    <td align="center"><sub>Dark theme</sub></td>
    <td align="center"><sub>Hindi</sub></td>
    <td align="center"><sub>Settings</sub></td>
    <td align="center"><sub>Sign-in</sub></td>
  </tr>
  <tr><th colspan="5">Android</th></tr>
  <tr>
    <td><img src="https://raw.githubusercontent.com/psingh2907/bareship/main/assets/screenshots/android/03-feed.jpg" alt="Android: feed" width="150"></td>
    <td><img src="https://raw.githubusercontent.com/psingh2907/bareship/main/assets/screenshots/android/07-offline.jpg" alt="Android: offline, with a like waiting to sync" width="150"></td>
    <td><img src="https://raw.githubusercontent.com/psingh2907/bareship/main/assets/screenshots/android/05-dark-feed.jpg" alt="Android: dark theme" width="150"></td>
    <td><img src="https://raw.githubusercontent.com/psingh2907/bareship/main/assets/screenshots/android/06-hindi-feed.jpg" alt="Android: the feed in Hindi" width="150"></td>
    <td><img src="https://raw.githubusercontent.com/psingh2907/bareship/main/assets/screenshots/android/04-settings.png" alt="Android: settings" width="150"></td>
  </tr>
  <tr>
    <td align="center"><sub>Feed</sub></td>
    <td align="center"><sub>Offline, waiting to sync</sub></td>
    <td align="center"><sub>Dark theme</sub></td>
    <td align="center"><sub>Hindi</sub></td>
    <td align="center"><sub>Settings</sub></td>
  </tr>
</table>

<p align="center"><sub>The demo app on the iOS simulator and an Android emulator. It serves sample data from a mock backend inside the app.</sub></p>

Bareship uses the React Native CLI and takes the best ideas from Ignite, Obytes,
TheCodingMachine and large open-source apps (Bluesky, Expensify), and adds what they leave out: an offline
write queue, Keychain token storage, enforced architecture, optional Firebase and a supply-chain policy.

**It runs with no accounts.** No backend, Firebase project or Apple Developer team is needed to build it,
run it, or install it on a phone: the dev build serves sample data from a mock backend inside the app. You
add each service when you need it ([going live](docs/going-live.md)).

> **Status: 0.3.2, on npm and as a GitHub template.** `npx create-bareship` creates an app in one command. An
> app made from the npm package builds and runs on iOS and Android, and the fastlane release builds pass on
> both. CI checks every pull request. Next: proving the native CI builds. See the [roadmap](#roadmap) and
> [known limitations](#known-limitations).

## Why this template

- **Bare, nothing hidden.** You own `ios/` and `android/`. Every native edit is marked in the code and
  logged with its Expo equivalent, so an Expo (CNG) version can share the same `src/` later.
- **Offline is designed in.** Each write picks one of four offline patterns. Queued writes survive a
  restart and replay in order, each with its own idempotency key.
- **The architecture is checked, not just described.** Layers import downward only, and ESLint and
  dependency-cruiser fail the build otherwise.
- **Production services that degrade gracefully.** Crashlytics, Analytics, Remote Config and push switch on
  when you add a Firebase file, and fall back to logging without one.
- **Built for AI agents too.** `AGENTS.md`, ADRs and Callstack's React Native agent skills give Claude
  Code, Copilot and other agents the same rules as your team.

## Quick start

Requirements:

- Node ≥ 22.11 (`.nvmrc` pins 24)
- pnpm 12 (`corepack enable` picks up the pinned version)
- Ruby 3.2.2 (`.ruby-version`) with Bundler, Java 21
- iOS: macOS with Xcode 27
- Android: Android Studio with SDK 37 and NDK 27.1

Create the app:

```bash
npx create-bareship Acme
cd Acme
pnpm ios              # or: pnpm android
```

`create-bareship` checks these tools first and says how to fix anything missing. It asks for the bundle id
and display name, then creates the app from the template, installs its dependencies, sets the bundle id, runs
`pod install` and makes the first git commit. `npx bareship Acme` does the same.

| Option | What it does |
| --- | --- |
| `--bundle-id <id>` | Reverse-domain bundle id, like `com.acme.app`. Default: `com.<appname>.app` |
| `--display-name <name>` | Name under the app icon. Default: the app name |
| `-y`, `--yes` | Ask nothing and use the defaults, for CI and AI agents |
| `--skip-pods` | Don't run `pod install`, for an Android-only setup. Always on outside macOS |
| `--skip-checks` | Don't check the tools first |
| `--dry-run` | Check the tools, then print the commands without running them |

For example, with no questions:
`npx create-bareship Acme --bundle-id com.acme.app --display-name "Acme" --yes`. Each version of
`create-bareship` creates the app from the same version of the template.

<details>
<summary>Or create it step by step</summary>

These are the steps `create-bareship` runs. The React Native CLI's `init` can't install with pnpm, so skip
its install. Leave out `--package-name`: it breaks the per-environment iOS bundle ids, and `bootstrap` sets
the id instead.

```bash
npx @react-native-community/cli@20.2.0 init Acme --template bareship --skip-install --install-pods false
cd Acme
pnpm install
bundle install
pnpm bootstrap --bundle-id com.acme.app --display-name "Acme"
pnpm android          # or: pnpm ios
```

</details>

Or start from a copy of this repository: click
[**Use this template**](https://github.com/psingh2907/bareship/generate) on GitHub (or clone it), then run
`pnpm install` and `bundle install` in your copy, and give `bootstrap` the app's name too:
`pnpm bootstrap --name Acme --bundle-id com.acme.app --display-name "Acme"`. The copy also holds the
template's own files (website, changelog, contributing guide), which the npm package leaves out.

Start the emulator (or plug in a phone) before `pnpm android`: debug builds compile native code only for the
connected device's CPU. With no device connected they build all four Android CPU types, which takes about
four times as long.

On recent Android versions the first debug run asks to find and connect to nearby devices. Allow it: the debug
build reaches Metro on your computer through the local network, and without the permission it shows
"Unable to load script".

`bootstrap` sets the bundle ids and display names of all three environments and moves the Android package to
match, then runs `pod install`. With `--name` it also renames the Xcode project, schemes and URL schemes;
`init` already did that for you. Run it once on a fresh app. To try a copy of the repository without
renaming it, run `pnpm pods` instead.

Run `pnpm pods` again after any `pnpm install` that changes `node_modules`. Skia copies its iOS binaries into
`node_modules` during `pod install`, so a reinstall removes them, and the iOS build then fails with
`libskia.xcframework/ios-arm64_arm64e: No such file or directory`.

Sign in with **`demo@example.com` / `password123`**. To try it on an Android phone without a computer
attached, build the [demo APK](docs/demo-build.md).

When you're ready to build your own app, run `pnpm strip-examples` once. It removes the demo feed and
component showroom and leaves a blank Home tab, with sign-in, onboarding and settings still working. Then
add your own features, screens and API calls with `pnpm gen` ([generators](docs/generators.md)).

## What's inside

**App**

- Sign-in, registration, forgot password and onboarding, gated in the navigator.
- A feed with cursor pagination, pull to refresh, skeletons and optimistic likes, plus a post screen.
- Settings: theme (light, dark, system), language, notifications, sign-out and account deletion.
- Design system on Unistyles 3: tokens, light and dark themes, and about 15 accessible primitives (Button,
  Input, Sheet, Toast, ListItem…), with a component showroom in dev builds.
- English and Hindi, typed keys, and a lint rule against hard-coded text. Right-to-left languages are one
  `rtl: true` away: layouts use `start`/`end`, and lint rejects `left`/`right` ([languages](docs/languages.md)).
- React Navigation 7 (static API, native stack, tabs) and FlashList.

**Data and offline**

- An axios client with Zod-parsed responses, single-flight token refresh, retry with backoff and a circuit
  breaker.
- TanStack Query 5 with the cache persisted to MMKV, so a cold start shows the last data at once.
- An offline write queue (patterns A–D), an offline banner, and "waiting to sync" states.
- Tokens in the Keychain / Keystore. Zustand only for small client state.
- An MSW mock backend that powers dev builds, tests and the demo APK. A CI check keeps it out of release
  bundles.

**Production**

- Three environments (dev, staging, prod) installed side by side, each with its own app id, name, icon
  badge, URL scheme and `.env` file. Config is validated at launch ([environments](docs/environments.md)).
- Firebase (optional): Crashlytics, Analytics, Remote Config and FCM push, with local notifications through
  react-native-notify-kit.
- Deep links, plus `https://` links once you add a domain. `pnpm links:files` writes the files your website
  serves. A link that arrives while signed out opens after sign-in.
- Force update and maintenance mode from Remote Config.
- Native splash, icon generation from one SVG, and release-ready Android (R8, signing from properties or CI
  secrets, a 16 KB page-alignment check).
- fastlane lanes for release builds, version bumps, match signing, TestFlight and Play internal testing.
  Building needs no account; the upload lanes say what to add ([releasing](docs/releasing.md)).

**Quality**

- Strict TypeScript 6, React Compiler on, ESLint 9 flat config, Prettier, Conventional Commits.
- Lint enforces the React Compiler rules, imports from the defining module (no barrel files) and ARIA
  accessibility props (`role`, `aria-label`) over the legacy `accessibility*` ones.
- Jest and React Native Testing Library, with an 80% coverage gate on `shared/` and `data/`.
- pnpm refuses packages younger than 3 days and install scripts unless allowlisted. Renovate groups
  updates.
- GitHub Actions: types, lint, format, boundaries and tests on every PR. Android and iOS builds are opt-in:
  label a PR `native`, run the workflow by hand, or set the repository variable `NATIVE_BUILDS=true` to build
  on every push to `main` ([ADR 0014](docs/decisions/0014-opt-in-native-ci.md)). The native builds haven't
  passed in this repository yet, see [known limitations](#known-limitations).

**For AI agents**

- [AGENTS.md](AGENTS.md) holds the commands, rules and conventions. `CLAUDE.md` and
  `.github/copilot-instructions.md` point to it.
- [Callstack's agent skills](https://github.com/callstackincubator/agent-skills) are vendored in
  `.claude/skills/` and pinned to a commit. Update them with `pnpm skills:sync`.
- The template's own skills, `add-feature`, `add-screen` and `add-endpoint`, run the generators and walk
  an agent through the rest: fields, offline pattern, strings, tests.
- Agents drive the app with agent-device and profile it with Argent
  ([ADR 0013](docs/decisions/0013-agent-device-tools.md)).

## Project structure

```
src/
  app/        composition: providers, navigation, boot sequence
  features/   auth, feed, settings, onboarding, app-status, showroom
  entities/   models shared by features: user, session, push, app-status
  data/       query client, persisted cache, offline queue
  shared/     ui, api, ports and adapters, i18n, config, lib (no business logic)
  mocks/      MSW mock backend (dev builds, tests, demo APK)
```

Imports go downward only: `app → features → entities → data → shared`, and features never import each
other. Native and vendor libraries sit behind ports in `shared/ports`, so swapping a vendor changes one
adapter. See [architecture](docs/architecture.md).

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm android`, `pnpm android:staging`, `pnpm android:prod` | Run a debug build of that environment |
| `pnpm ios`, `pnpm ios:staging`, `pnpm ios:prod` | Same on iOS |
| `pnpm pods` | `pod install` through Bundler |
| `pnpm build:android:dev`, `pnpm build:android:staging` | Release APK of that environment |
| `pnpm build:android:prod` | Release App Bundle for Play |
| `pnpm build:android:demo` | Release APK with sample data, for trying the app on a phone ([guide](docs/demo-build.md)) |
| `bundle exec fastlane bump version:1.2.0` | Set the version on both platforms and raise the build number |
| `bundle exec fastlane android build`, `… ios build` | Release builds; `beta` lanes upload ([releasing](docs/releasing.md)) |
| `pnpm check` | Typecheck, lint, format check, boundaries, tests |
| `pnpm bootstrap` | Set the bundle id and display name, and rename a copy of the repository (see [quick start](#quick-start)) |
| `pnpm pack-template` | Build the npm packages, `bareship` and its installer `create-bareship`, into `dist/npm/` ([packaging](docs/packaging.md)) |
| `pnpm strip-examples` | Remove the demo (feed, posts, showroom) and leave a blank Home tab; sign-in, onboarding and settings stay |
| `pnpm icons` | Regenerate app icons from `assets/brand/icon.svg` |
| `pnpm splash` | Regenerate the splash screen from `assets/brand/logo.svg` |
| `pnpm gen feature\|screen\|endpoint` | Scaffold a feature, screen or endpoint that follows the rules ([AGENTS.md](AGENTS.md)) |
| `pnpm links:files` | Files your website serves so its links open the app ([going live](docs/going-live.md)) |
| `pnpm skills:sync` | Update the vendored agent skills to another upstream commit |
| `pnpm site:dev`, `pnpm site:build` | Run or build the website and docs in `website/` ([editing the website](CONTRIBUTING.md#editing-the-website)) |

## Going to production

[docs/going-live.md](docs/going-live.md) lists what to add before release and what each step switches on:
your API, release signing, Firebase, iOS push, a link domain and the Remote Config keys. Each step is
independent; the rest of the app keeps working without it.

## Documentation

| Doc | What it covers |
| --- | --- |
| [Website](https://bareship.praveensingh.co.in) | All of these docs as a searchable site |
| [AGENTS.md](AGENTS.md) | Rules and conventions for contributors and AI agents |
| [Architecture](docs/architecture.md) | Layers, data flow, session, ports and adapters, boot |
| [Environments](docs/environments.md) | dev, staging and prod: ids, `.env` files, flavors and schemes |
| [Going live](docs/going-live.md) | API, signing, Firebase, push, links, force update |
| [Packaging](docs/packaging.md) | How the npm template and the GitHub template are built and checked (maintainers) |
| [Generators](docs/generators.md) | Add features, screens and API calls with `pnpm gen` |
| [Languages](docs/languages.md) | English and Hindi, adding a language, and right-to-left |
| [Releasing](docs/releasing.md) | fastlane lanes: release builds, version bump, TestFlight and Play uploads |
| [Demo build](docs/demo-build.md) | Installing the sample-data APK on an Android phone |
| [Decisions (ADRs)](docs/decisions/README.md) | Why each library and pattern was chosen |
| [Native changes](docs/native-changes.md) | Every edit to `ios/` and `android/`, with its Expo equivalent |
| [Version matrix](docs/version-matrix.md) | Toolchain and library versions, and what was checked |
| [Best-practices audit](docs/best-practices-audit.md) | Audit against the agent skills, and open items |
| [Research](docs/research.md) | The templates and apps studied, and what was taken from each |

## Known limitations

- **No end-to-end or performance tests yet.** Maestro flows, Reassure render baselines, startup metrics
  and a bundle report are postponed.
- **The native CI builds haven't passed yet.** The checks job runs on every pull request and is required
  to merge. The fixes for the native jobs (a `.ruby-version` for iOS; swap, two Gradle workers and time
  limits for the Android builds, which ran out of memory on 8 GB private runners) are in the workflow but
  haven't run on the larger public runners yet. GitHub's macOS image has Xcode 26.x, not 27, so the iOS job
  is unproven too.
- **Over-the-air updates have a port but no adapter.** Pick a provider (for example hot-updater) and add
  one.
- **Right-to-left is opt-in.** No shipped language is right-to-left, so tests and lint cover it, not the
  demo. If you add one, check it on both platforms ([languages](docs/languages.md)).
- **The demo build is Android-only.** iOS needs a signed build, so use the simulator.
- **Firebase is tested without real projects.** The fallbacks are tested on devices; Crashlytics on iOS
  hasn't run against a real Firebase config yet.
- **Firebase stops publishing new iOS SDKs to CocoaPods after October 2026.** The pinned versions stay
  installable; the iOS setup moves when React Native Firebase changes how it ships
  ([ADR 0010](docs/decisions/0010-production-modules-and-firebase.md)).

## Roadmap

**Released (0.1 to 0.3)**

| Area | What's included |
| --- | --- |
| Foundation | Decision records, version matrix, tooling, three environments, splash and icons, `pnpm bootstrap` |
| App | API client, TanStack Query with MMKV, navigation, design system, i18n, forms, sign-in, demo feed, mock backend |
| Production | Offline queue and UI, Firebase, push, force update, deep links, an OTA port, fastlane |
| Quality | Lint rules, generators with agent skills, tests with a coverage gate, a CI workflow |
| Distribution | npm package `bareship`, GitHub template, `pnpm strip-examples`, MIT license, [website](https://bareship.praveensingh.co.in) |
| Languages (0.2) | English and Hindi, right-to-left as a switch per language, a lint rule for `start`/`end`, a [languages guide](docs/languages.md) |
| Installer (0.3) | `npx create-bareship Acme` (or `npx bareship Acme`) checks the tools and creates the app in one command ([ADR 0018](docs/decisions/0018-create-bareship.md)) |

**Next**

| Item | Status |
| --- | --- |
| CI checks on every pull request, required to merge | Done |
| Native CI builds passing: Android memory use, Xcode 27 on the macOS runner | Next |
| Right-to-left text alignment on iOS | Done |
| Screen titles that follow a language switch without a restart, and the iOS back-button label | Done |
| End-to-end tests with Maestro | Postponed |
| Performance tooling: Reassure render baselines, startup metrics, a bundle report | Postponed |
| An Expo (CNG) version that shares the same `src/` | Later |

## Contributing

Contributions are welcome. [CONTRIBUTING.md](CONTRIBUTING.md) covers the whole path: what to open first,
how to make and test a change, and how a pull request gets reviewed, merged and released.

- **Questions and ideas:** [Discussions](https://github.com/psingh2907/bareship/discussions).
- **Bugs and docs problems:** [open an issue](https://github.com/psingh2907/bareship/issues/new/choose).
- **Something to work on:** issues labelled
  [good first issue](https://github.com/psingh2907/bareship/labels/good%20first%20issue) or
  [help wanted](https://github.com/psingh2907/bareship/labels/help%20wanted). Comment on one to take it.
- **Pull requests:** read [AGENTS.md](AGENTS.md), run `pnpm check`, and title the pull request as a
  Conventional Commit (`fix(feed): …`). Changing a recorded decision needs a new ADR.

Everyone follows the [code of conduct](CODE_OF_CONDUCT.md). Report security issues privately
([SECURITY.md](SECURITY.md)).

## License

[MIT](LICENSE) © 2026 [Praveen Singh](https://www.praveensingh.co.in).
