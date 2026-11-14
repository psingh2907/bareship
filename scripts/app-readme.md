# BareshipApp

A bare React Native app (iOS and Android), made from the [Bareship](https://bareship.praveensingh.co.in)
template.

## Run it

You need Node ≥ 22.11, pnpm (`corepack enable`), Ruby with Bundler (`.ruby-version`) and Java 21. For iOS:
macOS with Xcode. For Android: Android Studio with the SDK and NDK listed in
[docs/version-matrix.md](docs/version-matrix.md).

If you created this app with `npx create-bareship`, it's installed and has its bundle id: start a
simulator or emulator and run it.

```bash
pnpm ios              # or: pnpm android
```

On a fresh clone (a teammate, a new machine, CI), install first:

```bash
pnpm install
bundle install
pnpm pods             # iOS only
```

If the bundle id was never set (the app was made with the React Native CLI's `init`), run
`pnpm bootstrap --bundle-id com.example.app --display-name "BareshipApp"` once, with your own bundle id and
display name. It sets the bundle ids and display names of all three environments and runs `pod install`.

Start the Android emulator (or connect a phone) before `pnpm android`. With no device connected, the debug
build compiles native code for all four Android CPU types and takes about four times as long. On recent
Android versions, allow the first run to find and connect to nearby devices: without it the app shows
"Unable to load script".

Dev builds serve sample data from a mock backend inside the app, so you don't need a server or any accounts
to run it. Sign in with **`demo@example.com` / `password123`**.

### If the iOS build fails after `pnpm install`

An error like `libskia.xcframework/ios-arm64_arm64e: No such file or directory` means the pods are stale.
Run `pnpm pods` again after any `pnpm install` that changes `node_modules`.

## Make it yours

1. Run `pnpm strip-examples` once. It removes the demo feed and component showroom and leaves a blank Home
   tab. Sign-in, onboarding and settings keep working.
2. Add features, screens and API calls with `pnpm gen` ([generators](docs/generators.md)):

   ```bash
   pnpm gen feature orders
   pnpm gen screen orders order-detail --param id
   pnpm gen endpoint orders cancel-order --method post --path /orders/:id/cancel
   ```

3. Run `pnpm check` before each commit: types, lint, formatting, import boundaries and tests.

Before your first release, connect your API, release signing and, if you want them, Firebase, push and
`https://` links. [Going live](docs/going-live.md) lists each step and what it switches on.

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm android`, `pnpm ios` | Run the dev build (`:staging` and `:prod` run the other environments) |
| `pnpm pods` | `pod install` through Bundler |
| `pnpm check` | Types, lint, formatting, import boundaries and tests |
| `pnpm gen feature\|screen\|endpoint` | Add a feature, screen or API call ([generators](docs/generators.md)) |
| `pnpm strip-examples` | Remove the demo content |
| `pnpm remove-social-sign-in` | Remove Apple and Google sign-in ([guide](docs/social-sign-in.md#remove-it)) | <!-- @social -->
| `pnpm icons`, `pnpm splash` | Regenerate the app icons and splash screen from `assets/brand/` |
| `pnpm build:android:prod` | Release App Bundle for Google Play |
| `bundle exec fastlane ios build` | Release build for iOS; `beta` lanes upload ([releasing](docs/releasing.md)) |
| `pnpm build:android:demo` | APK with sample data, to try the app on a phone ([demo build](docs/demo-build.md)) |

## Docs

| Doc | What it covers |
| --- | --- |
| [AGENTS.md](AGENTS.md) | Rules and conventions for this codebase, for people and AI agents |
| [Architecture](docs/architecture.md) | Folders, layers, data flow and how the app starts |
| [Environments](docs/environments.md) | dev, staging and prod: app ids, `.env` files, schemes |
| [Languages](docs/languages.md) | English and Hindi, adding a language, and right-to-left |
| [Going live](docs/going-live.md) | API, signing, Firebase, push, links, force update |
| [Releasing](docs/releasing.md) | Release builds, version bumps, TestFlight and Play uploads |
| [Native changes](docs/native-changes.md) | Every edit made to `ios/` and `android/` |
| [Decisions](docs/decisions/README.md) | Why each library and pattern was chosen |

The same guides are on the [Bareship website](https://bareship.praveensingh.co.in).

## License

This app is yours to license. Code that came from the Bareship template is under the MIT license; keep
[TEMPLATE-LICENSE](TEMPLATE-LICENSE) in the repository to meet its terms.
