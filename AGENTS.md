# AGENTS.md

Guide for AI agents and new contributors. Read this before changing code.

## What this is

A bare React Native 0.87 template. Decisions and their reasons are in `docs/decisions/` (ADRs).
Never change a recorded decision silently: propose a new ADR.

## Commands

| Task | Command |
| --- | --- |
| Install | `pnpm install` (pnpm only; supply-chain policy in `pnpm-workspace.yaml`) |
| iOS pods | `pnpm pods`, and again after every `pnpm install` that changes `node_modules` (Skia copies its iOS binaries in at `pod install`) |
| Run | `pnpm android` / `pnpm ios` (dev); `:staging`, `:prod` variants |
| All checks | `pnpm check` (typecheck, lint, format, depcruise, tests) |
| Set the bundle id (and rename) | `pnpm bootstrap --bundle-id com.acme.app [--display-name "Acme"] [--name Acme]` |
| Remove the demo (feed, showroom) | `pnpm strip-examples` (once, on a fresh copy) |
| Icons / splash | `pnpm icons`, `pnpm splash` |
| Release builds, version bump, uploads | `bundle exec fastlane lanes` ([docs/releasing.md](docs/releasing.md)) |
| Scaffold code | `pnpm gen feature <name>`, `pnpm gen screen <feature> <name>`, `pnpm gen endpoint <feature> <name>` ([docs/generators.md](docs/generators.md)) |

## Agent skills

Callstack's React Native agent skills are vendored in `.claude/skills/` (pinned, see `skills-lock.json`;
update with `pnpm skills:sync <ref>` and review the diff). The template's own skills (`add-feature`,
`add-screen`, `add-endpoint`) live there too; `skills:sync` leaves them alone. Claude Code loads them automatically; other
agents should open the `SKILL.md` named below before the matching work.

| Work | Skill |
| --- | --- |
| Adding a feature, a screen or an endpoint (this template's own skills) | `add-feature`, `add-screen`, `add-endpoint` |
| Any React Native code: screens, lists, state, animations, native modules, bundle size, startup | `react-native-best-practices` |
| Navigation: stacks, tabs, headers, sheets, safe areas | `react-navigation` |
| Tests with React Native Testing Library | `react-native-testing` |
| Upgrading React Native or native dependencies | `upgrading-react-native` |
| CI build artifacts for simulators and emulators | `github-actions` |
| A local native module or view | `create-react-native-library` |
| User-facing docs (README usage, guides, release notes) | `writing-user-docs` |
| Driving a device, exploratory QA (needs the `agent-device` CLI) | `agent-device`, `dogfood` |
| Profiling renders and CPU on a device (needs Argent, ADR 0013) | `argent-react-native-profiler`, `argent-native-profiler` |
| TV apps, brownfield or migration work (not used by this template) | `react-native-tv-best-practices`, `react-native-brownfield-migration`, `assess-react-native-migration` |

Apply `react-native-best-practices` to all code you write, not only when asked to optimize. Where a skill
and this file disagree, this file wins; the known cases:

- **Installs:** pnpm with exact versions (`pnpm add x@1.2.3`, `pnpm dlx x@1.2.3`). Never `npx …@latest`: it
  skips the supply-chain policy in `pnpm-workspace.yaml`.
- **Measure first** (the skill's own rule): no `useMemo`/`useCallback`/`memo` without a measured problem.
  The React Compiler is on and memoizes for you.
- **Imports:** import from the module that defines the thing (`@/shared/ui/primitives/Button`), never from a
  barrel `index.ts`. A feature's `index.ts` is its public API for `app/` only. Lint enforces both.
- **Accessibility props:** ARIA props (`role`, `aria-label`, `aria-selected`, `aria-disabled`, `aria-live`,
  `aria-hidden`, `aria-valuetext`) over the legacy `accessibility*` props; lint rejects the old ones.
  `accessibilityHint` has no ARIA equivalent and stays. Third-party native views (react-native-svg,
  FastImage) don't translate `aria-*`, so their wrappers in `shared/ui` keep the old props.
- **Styling:** Unistyles dynamic functions, not `useVariants` (see Styling below).
- **Intl polyfills:** `intl-pluralrules` and `relative-time-format`, not the FormatJS set the skill shows
  (see Intl on Hermes below).
- **Profiling:** use Argent's profiler, not the skill's `agent-device` React profiling. Never run
  `agent-react-devtools init` or any setup that edits `index.js`, `metro.config.js` or `package.json` to
  profile (ADR 0013). React Native DevTools (Metro `j`) works everywhere.

## Driving the app (ADR 0013)

- **agent-device** for running the app, tapping through it and checking a change. Prefer its text snapshots;
  take a screenshot only when the layout itself is in question.
- **Argent** only for profiling. Don't use both in one task.
- Both read the accessibility tree: give interactive elements `aria-label`, and toggles and tabs
  `aria-checked` / `aria-selected`, so agents don't fall back to screenshots and coordinates.
- Saved end-to-end tests are Maestro flows (ADR 0012), not agent sessions.

## Architecture rules

- `src/` layers, imports go downward only: `app → features → entities → data → shared` (ADR 0005).
- A feature never imports another feature. Move shared code down to `entities/` or `shared/`.
- Import with the `@/` alias. No deep relative imports, no `react-native/Libraries/*` imports.
- Configuration is read only in `src/shared/config/env.ts`. `.env.*` values are public; no secrets.
- Server data belongs to TanStack Query; Zustand holds only small client state (ADR 0006).
- Screens never call the HTTP client directly; they use feature hooks.
- Native or vendor libraries are used only through ports in `src/shared/ports`, via `services()`.
- Icons come from `@/shared/ui/icons` (add new ones there). Never import values from the `lucide-react-native` root.
- UI text comes from `t('…')` with keys in `src/shared/i18n/locales/en.json` (and `hi.json`). Lint rejects
  hard-coded JSX text, and styles with `left`/`right` (use `start`/`end`) so right-to-left languages can be
  added with `rtl: true` in `LANGUAGES` ([ADR 0017](docs/decisions/0017-languages-hindi-and-opt-in-rtl.md)).
- Style with Unistyles (`StyleSheet.create(theme => …)`) and theme roles (`theme.colors.text`), never hex values.

See [docs/architecture.md](docs/architecture.md) for data flow and the reference mutation pattern.

ESLint (`eslint-plugin-boundaries`) and `dependency-cruiser` enforce the layer rules. Fix the import, never
disable the rule.

## Offline

Every write picks one offline pattern (ADR 0006, after Expensify):

| Pattern | Behaviour | Use for | How |
| --- | --- | --- | --- |
| A | Optimistic, queued, no feedback | Low-stakes toggles | `defineQueuedMutation` |
| B | Optimistic, queued, shows "Waiting to sync" | Likes, comments, edits | `defineQueuedMutation` + `useWaitingWrites` (see [Writing data](docs/architecture.md#writing-data)) |
| C | Form disabled while offline | Sign-in, payment | `OfflineNotice` + `disabled={!useIsOnline()}` |
| D | Content replaced while offline | Account deletion, checkout | `<OnlineOnly>` |

- Plain `useMutation` writes fail fast offline (`networkMode: 'always'`). Only `defineQueuedMutation`
  writes wait, survive a restart, and replay in order with one `Idempotency-Key` per write.
- Each queued write records the signed-in account (`setQueueAccount` in `src/app/boot.ts`) and only runs
  while that account is signed in; a write from another account is dropped and logged, never sent with
  the current token. Your backend should scope idempotency keys per user too.
- A failed write doesn't stop the writes queued behind it, unless it sets `onRejected: 'cancel-scope'`: use
  that for dependent writes (create, then edit) sharing one `scope`. Cancelled writes get an `ApiError` of
  kind `'cancelled'` in their `onError` and roll back there ([Writing data](docs/architecture.md#writes-that-depend-on-each-other)).
- Define queued writes at module level and do cache updates in their callbacks: after a restart the
  screen that started the write is gone. Keep variables small and JSON-safe (ids and flags).
- Import every module that defines a queued write from `src/app/queued-writes.ts`. Metro loads
  modules lazily (`inlineRequires`), so without it a write saved before a restart has no definition
  when the cache comes back. A test fails if an import is missing; `resumeQueuedWrites` drops and
  reports any write it can't run.
- The banner under the header comes from `app/navigation/offline-layout.tsx` (`screenLayout`).
- Mock mode can't simulate a dead network (requests never leave the app). To test offline, turn on
  airplane mode: NetInfo drives the queue either way.

## Production services (Phase 3)

Everything here runs without accounts; docs/going-live.md says what to add and what it switches on.

- **Firebase** (crash, analytics, flags, push): `services()` picks Firebase adapters only when the native app
  started Firebase (`src/shared/adapters/firebase-app.ts`); otherwise logging/static adapters. Never import
  `@react-native-firebase/*` outside `src/shared/adapters` and `src/app/background.ts`.
- **Flags:** every key and its default lives in `src/shared/config/flags.ts`. Read with
  `services().flags.getBoolean('key', FLAG_DEFAULTS.key)`.
- **App status:** `min_supported_version` / `maintenance_mode` swap the whole app for a blocking screen
  (`src/entities/app-status`, checked at boot and on foreground).
- **Push:** use `services().push` (port in `src/shared/ports`). A notification's `data.link` is a deep link;
  taps go through `src/app/navigation/linking.ts`. Never prompt at first launch; the Settings row asks.
- **Deep links:** add `linking: 'path/:param'` to the screen in `RootNavigator.tsx` and the path to
  `LINK_PATHS` in `scripts/links-files.ts`. Links open on top of the tabs, and a link that arrives while signed
  out opens after sign-in (`UNSTABLE_routeNamesChangeBehavior`, covered by `App.test.tsx`).
- **Sign in with Apple / Google:** `services().social` (ADR 0020). Buttons show only for providers set in
  `.env`; with `API_MOCKS` the mock providers in `src/mocks/social.ts` stand in. The app never trusts the ID
  token: `POST /auth/social` checks it ([docs/social-sign-in.md](docs/social-sign-in.md)).
- **Native config from `.env`:** `APP_SCHEME`, `APP_LINK_DOMAIN`, `IOS_APS_ENVIRONMENT`, `IOS_APPLE_SIGN_IN`
  and `GOOGLE_IOS_CLIENT_ID` feed Gradle and `scripts/ios/configure-environments.rb`. Re-run that script after
  changing them.

## Styling

Unistyles 3 with the React Compiler on. For styles that depend on props or state, use a **dynamic function**
(`field: (state: FieldState) => ({ … })`, used as `style={styles.field(state)}`), not `variants` +
`styles.useVariants()`. The compiler memoizes `style={[styles.x, …]}` without knowing that `useVariants`
changed `styles.x`, so the old variant stays on screen (a focus border that never clears, a stale selected
tab). A dynamic function's arguments are ordinary dependencies, so it stays correct and memoized. ESLint
rejects `useVariants`. Theme switches don't re-render either way: Unistyles updates native views directly.

## Demo code

The feed, posts mocks and showroom are demo content that `pnpm strip-examples` removes. Mark any new demo-only
code: `// @example` deletes a line, `// @example:<id>` replaces it, and `// @example-start[:<id>]` …
`// @example-end` covers a block (ids are defined in `scripts/strip-examples.ts`).
`scripts/ci/check-strip-examples.sh` strips a scratch copy and runs every check on it.

## Native changes

Any edit under `android/` or `ios/`: mark it with a `[bareship]` comment and add a row to
`docs/native-changes.md` with its Expo equivalent.

## Adding a dependency

Check it builds with RN 0.87, the New Architecture, AGP 9 and Xcode 27, and record it in `docs/version-matrix.md`.
New versions younger than 3 days are refused by pnpm; don't bypass this without a reviewed exclude entry.

## Tests

Jest + React Native Testing Library 14. `render`, `fireEvent` and `userEvent` are async: always `await` them.
Prefer `userEvent.setup()` and `getByRole` / `getByLabelText` queries.

- HTTP is answered by the MSW mock backend in `src/mocks` (the same handlers power `API_MOCKS=true` in dev).
  Override a response in one test with `server.use(http.get('*/me', () => …))`.
- `src/test/setup.ts` mocks native modules and resets services, session, DB and query cache before each test.
- `src/test/app.ts`: `signInDemoUser()`, in-memory SecureStore. `src/test/render.tsx`: `renderWithProviders()`.
- Coverage gate: 80% lines/functions on `src/shared/` and `src/data/`.

## Mock backend

`API_MOCKS=true` in `.env.dev` serves the API from `src/mocks` inside the app (development builds only; release
bundles drop it). Demo account: `demo@example.com` / `password123`. Set `API_MOCKS=false` to hit `API_URL`.

- In the app, `src/mocks/native.ts` is an axios adapter that runs the MSW handlers with `getResponse()`. It
  doesn't patch XHR/fetch, so other traffic (images, Metro) is untouched. Unmatched requests go to the network.
- The mock DB resets on every JS reload. Tokens are self-describing, so a signed-in session survives reloads.
- Demo release builds (`pnpm build:android:demo`) bundle `index.demo.js`, which starts the mocks and hands the
  adapter to `boot()` via `src/app/mock-backend.ts`. Never import `src/mocks` from `index.js` or app code
  outside a `__DEV__`-first condition: `scripts/ci/check-no-mocks-in-release.sh` fails if mock code reaches a
  normal release bundle.
- Add an endpoint with `pnpm gen endpoint`: it puts the handler in `src/mocks/<feature>.ts` (registered in
  `handlers.ts`), with snake_case DTOs and a test against it. Shared helpers (`wait`, `authenticate`,
  `error`) are in `src/mocks/helpers.ts`.

## Intl on Hermes

Hermes ships only `Intl.Collator`, `DateTimeFormat` and `NumberFormat`.

- `PluralRules` (i18next plurals): `intl-pluralrules`, loaded in `src/shared/i18n/intl-polyfills.ts`. It covers
  every language.
- Relative times (`formatRelative` in `src/shared/lib/format.ts`): `relative-time-format`. Adding a language
  means adding its locale there; a test fails if you forget.
- Not FormatJS, although the best-practices skill shows it: FormatJS needs `Intl.Locale` too, ~390 KB of
  polyfills against ~50 KB for these two (docs/best-practices-audit.md).

Jest runs Node's full Intl, so device-only Intl bugs don't show up in tests: test the polyfill itself (see
`i18n.test.ts`) and check new Intl APIs on a device.

## Commits

Conventional Commits (`feat:`, `fix:`, `chore:` …), enforced by commitlint.
