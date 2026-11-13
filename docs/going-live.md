# Going live

The template runs without any accounts: it uses sample data, logs instead of reporting crashes, and keeps
links and push local. This page lists what you add before release, and what each one switches on.

| You add | What switches on | Needs |
| --- | --- | --- |
| [Your API](#use-your-api) | Real data instead of sample data | Your backend |
| [Release signing](#sign-release-builds) | Builds you can upload to the stores | A keystore; an Apple Developer team |
| [Firebase](#set-up-firebase) | Crash reports, analytics, Remote Config, push delivery on Android | A Firebase project (free) |
| [Push on iOS](#turn-on-push-for-ios) | Push delivery on iPhone | Firebase, a paid Apple Developer team |
| [A link domain](#open-web-links-in-the-app) | `https://` links that open the app | A domain you control, plus the two above for iOS |
| [Remote Config keys](#force-an-update-or-pause-the-app) | Forced updates and maintenance mode | Firebase |
| [Apple and Google sign-in](social-sign-in.md) | "Continue with Apple" and "Sign in with Google" buttons | Google Cloud OAuth clients (free); a paid Apple Developer team for Apple; `POST /auth/social` on your backend |

Set your bundle id first if you haven't: `pnpm bootstrap --bundle-id com.acme.shop` (see the README; a copy
of the GitHub repository also needs `--name AcmeShop`). Every bundle id below is yours, with `.dev` and
`.staging` for those environments.

## Use your API

1. In `.env.staging` and `.env.prod`, set `API_URL` to your backend.
2. In `.env.dev`, set `API_URL` too, and `API_MOCKS=false` when you want dev builds to use it.

Your backend needs the endpoints the app calls; `src/mocks/handlers.ts` shows each request and response.
Two behaviours to match:

- After sign-in the app sends `POST /devices` with `{ token, platform }` whenever it has a push token.
  Drop a session's devices when you handle `POST /auth/logout`: the app can't call you after sign-out.
- Writes queued offline replay with the same `Idempotency-Key` header. Return the first result for a key
  you've seen, so a replay is never applied twice.

## Sign release builds

**Android:** create an upload keystore and put these in `~/.gradle/gradle.properties` (or CI secrets):
`RN_UPLOAD_STORE_FILE`, `RN_UPLOAD_STORE_PASSWORD`, `RN_UPLOAD_KEY_ALIAS`, `RN_UPLOAD_KEY_PASSWORD`. Without
them, release builds are signed with the debug key and Play rejects them.

**iOS:** open `ios/<App>.xcworkspace` in Xcode, select the app target, and set your team under Signing &
Capabilities. A free Apple account can run the app on your own phone, but can't use push or web links.

To build and upload from the command line or CI, use the fastlane lanes in [releasing](releasing.md):
they sign iOS builds with match and upload to TestFlight and Play internal testing.

## Set up Firebase

1. In the [Firebase console](https://console.firebase.google.com), create a project. Use one project per
   environment if you want separate data (recommended), or one for all three.
2. Add an Android app for each environment's application id (`com.acme.shop.dev`, `com.acme.shop.staging`,
   `com.acme.shop`) and download its `google-services.json` to `android/app/src/<env>/google-services.json`
   (`<env>` is `dev`, `staging` or `prod`).
3. Add an iOS app for each bundle id and download its `GoogleService-Info.plist` to
   `ios/Config/Firebase/<env>/GoogleService-Info.plist`.
4. Rebuild (`pnpm android`, `pnpm ios`). Native code changed, so a Metro reload isn't enough.

You can set up one environment at a time: the others keep building without Firebase. The app logs
"Firebase is not set up for this build" at start-up when an environment has no file.

What you get: Crashlytics (crashes from release builds; debug builds don't report), Analytics (screen
views and the events the app tracks), Remote Config (feature flags, see below) and push delivery on
Android. Release builds upload their symbol files to Crashlytics automatically.

**If the build fails after adding a file:** check that the package name / bundle id inside the file matches
the environment folder it's in. A dev file in `prod/` fails the Google Services step.

## Turn on push for iOS

Prerequisites: Firebase for that environment, and a paid Apple Developer team.

1. In the Apple Developer portal, create an APNs authentication key (Keys → +, Apple Push Notifications).
2. In Firebase, open Project settings → Cloud Messaging → Apple app configuration and upload the key.
3. In the environment's `.env` file, set `IOS_APS_ENVIRONMENT=development` (debug and TestFlight builds use
   `development`; App Store builds `production`).
4. Run `bundle exec ruby scripts/ios/configure-environments.rb` from `ios/`, then rebuild.

People get asked for permission from the Notifications row in Settings, not at first launch. A
notification whose data has `link` (for example `acme-shop://post/123`) opens that screen when tapped.

**Testing without an Apple account:** the simulator can show and open notifications. In the dev build,
Settings → Component showroom → Send test notification.

## Open web links in the app

Prerequisites: a domain you control (for example `links.acme.com`), HTTPS on it, and for iOS a paid Apple
Developer team.

1. In the environment's `.env` file, set `APP_LINK_DOMAIN=links.acme.com` (no `https://`).
2. Run `bundle exec ruby scripts/ios/configure-environments.rb` from `ios/`, then rebuild both apps.
3. Generate the two verification files:

   ```bash
   pnpm links:files --team-id ABCDE12345
   ```

   The Team ID is under Membership in your Apple Developer account. For Android the script reads your
   upload keystore (`RN_UPLOAD_STORE_FILE`); if Play signs your app, also pass the Play App Signing key's
   fingerprint: `--sha256 <fingerprint>` (Play Console → Test and release → App integrity).

4. Upload `dist/well-known/<env>/apple-app-site-association` and `assetlinks.json` to
   `https://links.acme.com/.well-known/`, served as `application/json`, without redirects.

The files only claim the paths the app handles (`/post/*`); the rest of your site keeps opening in the
browser. When you add a linkable screen, add its path to `LINK_PATHS` in `scripts/links-files.ts` too.

**If links open in the browser:** iOS fetches the file when the app is installed, so reinstall after
uploading. On Android, run `adb shell pm verify-app-links --re-verify <application id>` and check
`adb shell pm get-app-links <application id>`.

## Force an update or pause the app

These Remote Config keys control whether the app runs (defaults in `src/shared/config/flags.ts`):

| Key | Type | Effect |
| --- | --- | --- |
| `min_supported_version` | string, e.g. `1.4.0` | Older versions show an "Update required" screen |
| `maintenance_mode` | boolean | Everyone sees a maintenance screen with a Try again button |
| `ios_app_store_id` | string (digits) | The update screen's button opens this App Store page; without it, iOS shows only text |

The app checks at start-up and whenever it returns to the foreground. Without Firebase these keys keep
their defaults, so nothing is ever blocked.

**Before you turn on `maintenance_mode`:** everyone is locked out until you turn it off, including people
mid-task. Writes queued offline wait and sync afterwards.
