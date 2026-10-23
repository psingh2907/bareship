# Releasing

Release builds, version numbers and store uploads run through [fastlane](https://docs.fastlane.tools)
(ADR 0012). Building needs no accounts. Uploading needs a Google Play service account or an App Store
Connect API key, and the lanes that upload stop and tell you what's missing until you add them.

Run every lane through Bundler, so you get the version pinned in `Gemfile.lock`:

```bash
bundle install
bundle exec fastlane lanes
```

## Lanes

| Lane | What it does | Needs |
| --- | --- | --- |
| `fastlane bump [version:1.2.0] [build:42]` | Sets the version on Android and iOS, and raises the build number by one (or to `build:`) | Nothing |
| `fastlane android build [env:prod] [format:apk\|aab] [abi:arm64-v8a]` | Release build: an App Bundle for prod, an APK for dev and staging. `abi:` builds one architecture, for quicker local builds | An upload key to be uploadable; without one it's signed with the debug key |
| `fastlane android beta [track:internal]` | Builds the prod App Bundle and uploads it to a Play testing track as a draft | Play service account, upload key |
| `fastlane ios build [env:prod] [type:appstore\|adhoc]` | With `APPLE_TEAM_ID`: certificates from match, then a signed IPA. Without it: an unsigned archive, which proves the release build compiles | Nothing for the archive; a team and match for an IPA |
| `fastlane ios certs [env:prod] [type:appstore\|adhoc]` | Fetches certificates and profiles from match (read-only on CI) | Apple Developer team, a match repository |
| `fastlane ios beta` | Builds the prod IPA and uploads it to TestFlight | All of the above, an App Store Connect API key |

Android lanes need `ANDROID_HOME` set to your SDK (usually `~/Library/Android/sdk`), like any Gradle build
run outside Android Studio.

`env` is `dev`, `staging` or `prod` (default `prod`), the same environments as [environments.md](environments.md).
Builds land in `android/app/build/outputs/` and `build/ios/`.

The Fastfile reads the app name from `app.json` and the ids from the native projects, so it keeps working
after `pnpm bootstrap`.

## Versions

One version for both platforms: `versionName` / `versionCode` in `android/app/build.gradle`, and
`MARKETING_VERSION` / `CURRENT_PROJECT_VERSION` in the Xcode project. Bump them together and commit:

```bash
bundle exec fastlane bump version:1.2.0
git commit -am "chore: release 1.2.0"
```

Each upload needs a higher build number than the last one, on both stores.

## Credentials

Put these in `fastlane/.env` (git-ignored; copy `fastlane/.env.example`) or in your CI's secrets. Never
commit them.

| Variable | Used by | Where to get it |
| --- | --- | --- |
| `RN_UPLOAD_STORE_FILE`, `RN_UPLOAD_STORE_PASSWORD`, `RN_UPLOAD_KEY_ALIAS`, `RN_UPLOAD_KEY_PASSWORD` | Android builds | Your upload keystore ([going live](going-live.md#sign-release-builds)). `~/.gradle/gradle.properties` works too |
| `PLAY_JSON_KEY_PATH` | `android beta` | Google Cloud service account with access in Play Console → Users and permissions. Create the app in Play Console and upload the first build by hand: the API can't create apps |
| `APPLE_TEAM_ID` | iOS builds | Apple Developer → Membership |
| `MATCH_GIT_URL`, `MATCH_PASSWORD` | `ios certs`, `ios build` | A private Git repository for match, and the passphrase it's encrypted with. Run `bundle exec fastlane match appstore` once to create the certificates |
| `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_PATH` | `ios beta`, match | App Store Connect → Users and Access → Integrations → App Store Connect API (`.p8` file) |

A signed iOS build switches the app target to manual signing with the match profile for that build. On CI
the checkout is thrown away; locally, discard the change to `project.pbxproj` afterwards.

## Continuous integration

The CI workflow checks pull requests and builds the app, but has no release job. When you add one, run
the same lanes with the credentials above as secrets (`fastlane android beta`, `fastlane ios beta`). On
CI, match is read-only, so certificates are created once from a laptop.

## Notes

- fastlane 2.240.1, pinned in `Gemfile.lock`. It requires the `json` gem below 3.0, so Bundler resolves
  json 2.x for CocoaPods too.
- fastlane prints that Ruby 3.2 support is going away. The template pins Ruby 3.2.2 (`.ruby-version`); move
  to 3.3 or later when fastlane drops 3.2.
- The Fastfile turns off fastlane's usage analytics (`opt_out_usage`) and its generated README
  (`skip_docs`).
