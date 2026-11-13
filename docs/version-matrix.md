# Version matrix

Checked on 2026-10-10. Update this file whenever a native dependency is added or upgraded.

## Toolchain

| Tool | Version | Source |
| --- | --- | --- |
| React Native | 0.87.1 | `react-native-community/template` 0.87-stable |
| React | 19.2.3 (exact, must match RN's renderer) | template |
| @react-native-community/cli | 20.2.0 | template; also pinned as `RN_CLI` in `packages/create-bareship`, which runs its `init`: upgrade both together |
| Node | ≥ 22.11 (`.nvmrc`: 24) | template `engines` |
| pnpm | 12.3.4 (`packageManager`), policy needs ≥ 11 | ADR 0003 |
| TypeScript | 6.0 | template |
| Gradle / AGP / Kotlin | 9.4.1 / 9 / 2.2.0 | template |
| Android SDK | compile 37, target 36, min 24; build-tools 37.0.0 | template |
| Android NDK | 27.1.12297006 | template (see note on Unistyles below) |
| Java | 21 | Gradle 9 requirement |
| Xcode | 27.0 | local. CI's `macos-26` image has Xcode 26.x (26.6 default, September 2026); whether the project builds with it is unchecked until CI runs. **The iOS 27 SDK requires the UIScene life cycle**, which the RN 0.87 template lacks; see docs/native-changes.md#uiscene |
| iOS deployment target | 15.1 (RN 0.87 `min_ios_version_supported`) | template |
| CocoaPods | 1.15.2 via Bundler | `Gemfile` |
| Ruby | 3.2.2 (`.ruby-version`) | `Gemfile.lock`; fastlane warns it will need 3.3 |
| fastlane | 2.240.1 via Bundler | `Gemfile` (2.241.0 was 2 days old); needs `json` < 3, so json is 2.21 |

## Libraries chosen in Phase 0

"Android build" means all 32 libraries below (everything except the opt-in SQLite module) were compiled
together into one Android debug APK (arm64) on the toolchain above: BUILD SUCCESSFUL, 962 tasks, 2026-10-10.
iOS: the same 32 libraries compiled together for the simulator (1,845 compile units) with
`$RNFirebaseDisableSPM = true` and static frameworks; the only failing step was Crashlytics' build phase, which
needs a real `GoogleService-Info.plist` (made conditional in Phase 3). See docs/native-changes.md.
"Peers" means the published peer ranges allow RN 0.87 / React 19.2.

| Library | Version | Role (ADR) | Peers | Android build | Notes |
| --- | --- | --- | --- | --- | --- |
| @react-navigation/native, native-stack, bottom-tabs | 7.5 / 7.20 / 7.20 | Navigation (0007) | ✓ | ✓ | v8 still alpha |
| react-native-screens | 4.28 | Navigation | ✓ | ✓ | 4.29 held back by the 3-day release age |
| react-native-safe-area-context | 5.10 | Layout | ✓ | ✓ | |
| react-native-gesture-handler | 3.3 | Gestures (0008) | ✓ | ✓ | Major 3: new API |
| react-native-reanimated / worklets | 4.7.1 / 0.13.0 | Animation (0008) | RN 0.86–0.88 | ✓ | |
| react-native-unistyles | 3.5.1 | Styling (0008) | ✓ | ✓ | Doesn't read `ndkVersion`; Phase 2 forces the app NDK on all subprojects |
| react-native-nitro-modules | 0.37.1 | Unistyles, MMKV | ✓ | ✓ | |
| react-native-edge-to-edge | 1.8.2 | Unistyles peer | ✓ | ✓ | |
| react-native-mmkv | 4.3.2 | Storage (0006) | ✓ | ✓ | Nitro-based |
| react-native-keychain | 10.0.0 | SecureStore (0010) | ✓ | ✓ | Last release 2025-03; behind a port |
| @shopify/flash-list | 2.3.3 | Lists (0008) | ✓ | ✓ | |
| @gorhom/bottom-sheet | 5.2.14 | Sheets (0008) | ✓ | ✓ | |
| lucide-react-native + react-native-svg | 1.52 / 15.15.5 | Icons (0008) | ✓ | ✓ | |
| @d11/react-native-fast-image | 8.13.0 | Image port (0008) | ✓ | ✓ | |
| @shopify/react-native-skia | 2.14.0 | Graphics (0008) | ✓ | ✓ | Largest native dependency |
| lottie-react-native | 7.5.0 | Animation (0008) | ✓ | ✓ | |
| react-native-localize | 3.7.2 | i18n (0009) | ✓ | ✓ | |
| react-native-config | 1.7.2 | Env (0004) | ✓ | ✓ | |
| react-native-bootsplash | 7.3.4 | Splash | ✓ | ✓ | Pulls `@expo/config-plugins` (trust exception in pnpm policy) |
| @react-native-firebase/app, messaging, crashlytics, analytics, remote-config | 26.4.0 | Observability, push (0010) | ✓ | ✓ | iOS needs static frameworks; plugins only when configured. Firebase iOS SDK 12.18 via CocoaPods: **Firebase publishes no new CocoaPods versions after October 2026**; recheck at every RNFB upgrade |
| react-native-notify-kit | 10.8.0 | Push display (0010) | ✓ | ✓ | Maintained Notifee fork (Notifee archived 2026-04) |
| @react-native-google-signin/google-signin | 17.0.0 | Sign in with Google (0020) | ✓ | ✓ | Added 2026-11-13; its `GoogleSigninButton` isn't used (the app draws Google's current button); iOS simulator and Android debug builds pass. iOS pulls GoogleSignIn 10.1.0, AppAuth 3, GTMAppAuth 6. Android uses Google's deprecated legacy Sign-In API (the paid "Universal" version uses Credential Manager) |
| @invertase/react-native-apple-authentication | 2.5.1 | Sign in with Apple (0020) | ✓ | ✓ | Added 2026-11-13; old native-module API, runs through the New Architecture interop layer. Last release 2026-03; a local Swift module is the fallback |
| @react-native-community/netinfo | 12.0.1 | Offline (0006) | ✓ | ✓ | |
| react-native-permissions | 5.6.2 | Permissions | ✓ | ✓ | |
| react-native-device-info | 15.0.2 | Force update | ✓ | ✓ | |
| react-native-keyboard-controller | 1.22.6 | Forms (0009) | ✓ | ✓ | |
| @op-engineering/op-sqlite + drizzle-orm | 18.2.5 / 0.45 | Offline DB module (0006, opt-in) | ✓ | not yet | Checked when the module is built |

## Dev tooling notes

- **MSW 2.15** (not 3). MSW 3 removed `msw/native`; its docs point to `@msw/react-native`, which isn't published
  on npm yet (404 on 2026-10-10). Move to it when it ships. Jest maps `msw/node` explicitly because the RN preset
  resolves the `react-native` export condition, under which `msw/node` is null.
  In the app, mocks run through an axios adapter calling MSW's `getResponse()` (`src/mocks/native.ts`), not
  `msw/native`'s `setupServer`: its XHR interceptor needs browser globals Hermes lacks and broke on RN's XHR.
  `src/mocks/polyfills.ts` still adds the few globals MSW touches (`Event`, `EventTarget`, `MessageEvent`,
  `BroadcastChannel`, streams via `web-streams-polyfill`, URL via `react-native-url-polyfill`).
- **Babel**: `@babel/plugin-transform-export-namespace-from` (Zod uses `export * as`) and
  `@babel/plugin-transform-class-static-block` (MSW ships `static {}` blocks Hermes doesn't parse).
- **intl-pluralrules 2.0.1, relative-time-format 1.1.12**: Hermes (RN 0.87) has no `Intl.PluralRules` or
  `Intl.RelativeTimeFormat`. Without them i18next plurals fail silently and `formatRelative` throws
  "undefined cannot be used as a constructor". Replaced the FormatJS polyfills, whose locale matcher also
  needs `Intl.Locale` (~390 KB in total against ~50 KB). Checked in Hermes for English, Arabic and Hindi.
- **zod 4**: its `locales` barrel re-exports ~60 languages Metro can't tree-shake. `metro.config.js`
  resolves it to `metro/zod-locales.js` (English only, −295 KB). The app's validation messages are its own
  translation keys, so nothing user-visible changes.
- **lucide-react-native**: import icons only through `src/shared/ui/icons.ts` (one module per icon). A root import
  bundles all ~1,500 icons: the release JS bundle went from 5.74 MB to 3.86 MB after switching. ESLint enforces it.
- **React Native Testing Library 14**: `render`, `fireEvent` and `userEvent` are all async; always `await` them.
- **Gesture Handler 3 in Jest**: `src/test/pre-setup.ts` stubs worklets' `getUIRuntimeHolder`, which the Jest build
  of react-native-worklets 0.13 throws on when Gesture Handler installs its UI-runtime bindings.

- **ESLint 9.39** (maintenance line). ESLint 10 is out, but `@react-native/eslint-config`, `eslint-plugin-react`
  and `eslint-plugin-react-native` don't declare support yet. `eslint-plugin-ft-flow` is overridden to 3.x for
  ESLint 9.
- **React Native Testing Library 14** uses `test-renderer` (not `react-test-renderer`). `test-renderer` is pinned to
  `~1.2.0` because 1.3 needs React 19.3.
