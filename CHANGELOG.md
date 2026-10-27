# Changelog

Notable changes to the template. Versions follow [Semantic Versioning](https://semver.org). Apps made from
the template own their copy of the code, so a new version reaches an app only when its authors apply the
changes.

## Unreleased

- Switching the language updates the title of a screen pushed over the tabs (the component showroom)
  and its iOS back-button label at once, without a restart. The back label is now the tab underneath
  ("Settings") instead of the route name "Main".
- Right-to-left layouts align text to the start on iOS too. iOS aligned text by its own script, so
  English or Hindi text stayed on the left in a mirrored row; the `Text` primitive now defaults to
  `textAlign: 'start'`, and `align` takes `start`, `end`, `center`, `justify` or `auto`.
- Bottom sheets opened from a screen presented as a modal show above it on iOS (`FullWindowOverlay`).
- The feed recycles rows with and without an image separately (`getItemType`), and its tests find like
  buttons by role and name instead of `testID`.
- The pull request template asks why (with the linked issue), how it was tested on each platform and for
  screenshots, and a new `Pull request title` workflow checks that titles are Conventional Commits, since
  a squash merge turns the title into the commit on `main`.
- Every dependency in `package.json` is pinned to an exact version (it already was in the lockfile), and
  `pnpm add` now saves exact versions (`savePrefix: ''` in `pnpm-workspace.yaml`), as AGENTS.md asks.
- ESLint, Prettier and Jest skip `.claude/`, so `pnpm check` no longer lints and tests the copies of the
  repo that Claude Code keeps in `.claude/worktrees/`.
- `concurrent-ruby` (used by CocoaPods and fastlane) goes from 1.3.3 to 1.3.8, which fixes three security
  advisories. The Gemfile's `< 1.3.4` pin came from the React Native template and was only needed with
  activesupport older than 7.1; the lockfile has 7.2.4, so the Gemfile now asks for `>= 1.3.7`.

## 0.3.2 (2026-10-19)

A new logo, and `pnpm splash` keeps the markers that point to each native change.

- New logo: a boat whose mainsail is a B ([ADR 0019](docs/decisions/0019-logo-sail-b.md)). It replaces the
  stacked layers in the app icon (every environment), the splash screen, the README, the website header,
  favicon and share image. Apps made from the template start with it as their placeholder icon and splash.
- `pnpm splash` keeps the `[bareship]` marker comments in `AndroidManifest.xml`. react-native-bootsplash's
  generator drops every comment from the manifest, so `scripts/splash.ts` now runs it and puts the manifest
  back; if `.MainActivity` doesn't use `BootTheme`, it keeps the generated manifest and lists the comments to
  restore by hand.

## 0.3.1 (2026-10-19)

The npm pages: `create-bareship` becomes the page to start from. No changes to the app's code.

- `create-bareship`'s npm page shows the full README, with screenshots and what's inside, instead of a short
  options list; it also has the template's search keywords. `bareship`'s page keeps the same README under
  its "template, not a library" note, which now links to `create-bareship`. Links in both point at GitHub.
- README: the installer's options table is in the quick start, and the npm badge and link go to
  `create-bareship`. The website's npm icon, `llms.txt` and search data point there too.
- `scripts/ci/check-create.sh` checks that both npm READMEs have the quick start and screenshots and no
  relative links.
- The app's README says that an app made with `npx create-bareship` is already installed, and gives a
  teammate's clone steps (`pnpm install`, `bundle install`, `pnpm pods`) instead of asking for `bootstrap`.
- Website: the home page, FAQ, introduction and AI agents page create the app with `npx create-bareship`.

## 0.3.0 (2026-10-19)

- `npx create-bareship Acme` creates an app in one command ([ADR 0018](docs/decisions/0018-create-bareship.md)).
  It checks the tools first (Node, pnpm, Ruby and Bundler, Java 21, Xcode on a Mac) and says how to fix
  anything missing, asks for the bundle id and display name (or takes `--bundle-id`, `--display-name` and
  `--yes`), then runs `init`, `pnpm install`, `bundle install` and `pnpm bootstrap`, and makes the first git
  commit. `create-bareship@X` creates apps from `bareship@X`. It has no dependencies.
- The `bareship` package runs the same installer as its bin, so `npx bareship Acme` works too, and its npm
  page says at the top that it's a template, not a library to install.
- README and website: the quick start leads with `npx create-bareship`; the manual steps stay as a fallback.
- `pnpm pack-template` packs both packages, and `scripts/ci/check-create.sh` creates an app through each and
  runs its checks. The installer isn't copied into apps.

## 0.2.0 (2026-10-17)

Hindi replaces Arabic as the second language, and right-to-left becomes a switch per language. Apps made
from 0.1.x keep Arabic until their authors apply these changes.


- Hindi replaces Arabic as the second language ([ADR 0017](docs/decisions/0017-languages-hindi-and-opt-in-rtl.md)).
  Right-to-left stays supported as `rtl: true` on a language in `LANGUAGES`; tests cover the direction
  switch and mirrored icons without shipping an RTL language.
- Lint rejects `left`/`right` style keys and `textAlign: 'left' | 'right'`; use `start`/`end`.
- `pnpm gen` and `pnpm strip-examples` work on every locale file, so adding a language needs no script
  changes.
- Fix: dates and relative times ("2 days ago") stayed in the old language after a switch in Settings,
  because the React Compiler cached the formatted text. Components now use `useFormat()` from
  `@/shared/lib/format`, and lint rejects plain `formatRelative`/`formatDate`/`formatNumber` calls in JSX.
- README and website: the screenshots show the feed and Settings in Hindi instead of Arabic.
- Docs: a [languages guide](docs/languages.md) (how it works, adding a language or a right-to-left one), on
  the website under Build your app.

## 0.1.2 (2026-10-17)

Screenshots on the npm page. No changes to the app's code.

- README and website: screenshots of the demo app on iOS and Android (feed, offline with a like waiting to
  sync, dark theme, Arabic right to left, settings, sign-in). The website shows them in iOS and Android tabs.
- The npm package leaves out the screenshots (`assets/screenshots/`), so apps made from it don't carry them.

## 0.1.1 (2026-10-17)

Fixes `pnpm bootstrap` for apps made with `init`, following the quick start.

- Docs and website: the React Native CLI (npm package `bareship`) is the first way to create an app; an
  npm link in the site header; FAQ answers on versions and updates.
- Fix `pnpm bootstrap` on an app made with `init`: a bundle id that extends the package `init` set
  (`com.acme` → `com.acme.app`, as in the quick start) crashed while moving the Android package folder,
  after the files were already rewritten. A second run then said "Nothing to rename" and skipped
  `pod install`, so the iOS build failed. Bootstrap now moves the folder through a temporary one, and
  still sets up the iOS configs and pods when there is nothing to rename.
- `pnpm bootstrap --name` is optional and defaults to the app's current name, since `init` already sets it.
  The quick start is now `pnpm bootstrap --bundle-id com.acme.app --display-name "Acme"`; a copy of the
  GitHub repository still passes `--name`. `scripts/ci/check-template-init.sh` runs that exact case.

## 0.1.0 (2026-10-14)

The first release, on npm as `bareship`
(`npx @react-native-community/cli@20.2.0 init Acme --template bareship --skip-install --install-pods false`)
and as a GitHub template repository. It collects everything below.

### App README and code of conduct

- Apps made with `init` get their own README (`scripts/app-readme.md`): how to run, customise and release
  the app, with no links to the template's own files. `scripts/ci/check-template-init.sh` checks it and the
  links in the app's docs.
- README: a new header with the logo, a tagline and quick links, and a direct **Use this template** link.
- `CODE_OF_CONDUCT.md` (Contributor Covenant 2.1).

### Public, with a website

- The repository is public and a GitHub template repository.
- Website and docs live at https://bareship.praveensingh.co.in with a sitemap and `robots.txt`
  ([ADR 0016](docs/decisions/0016-website-on-a-subdomain.md)). Vercel deploys it on every push to `main`.
- The website builds without the app's packages installed (Vercel), and the Offline and AI agents pages
  are now committed (the root `.gitignore` hid them).

### Renamed to Bareship

- The template is now **Bareship** (was `rn-template`): npm package `bareship`, repository
  `psingh2907/bareship`, code markers `[bareship]` ([ADR 0015](docs/decisions/0015-name-bareship.md)).
- The app inside the template is renamed with `pnpm bootstrap`: bundle id `com.bareshipapp`, URL scheme
  `bareshipapp://`. Apps made with `init` get their own names, as before.
- Docs: run `pnpm pods` again after a `pnpm install` that changes `node_modules` (Skia's iOS binaries).

### Phase 5: packaging

- `pnpm strip-examples` removes the demo (feed, posts mocks, showroom) and leaves a blank Home tab;
  `scripts/ci/check-strip-examples.sh` checks the stripped app.
- npm template for the React Native CLI (`pnpm pack-template`), checked end to end by
  `scripts/ci/check-template-init.sh`.
- `pnpm bootstrap` checks for the Ruby gems before renaming anything.
- MIT license, contributing and security guides, issue templates.
- The tab navigator's route is `Main` (was `Home`), so an app's own Home tab doesn't clash with it.

### Phase 4: quality tooling

- Lint sweep: no barrel files, React Compiler lint rules, ARIA accessibility props.
- `pnpm gen feature|screen|endpoint` and the `add-feature`, `add-screen`, `add-endpoint` agent skills.
- fastlane lanes for version bumps, release builds, match signing, TestFlight and Play uploads.
- Postponed: Maestro end-to-end tests, Reassure, startup metrics, bundle report.

### Phase 3: production

- Offline write queue (patterns A–D), offline banner and "waiting to sync" states.
- Optional Firebase: Crashlytics, Analytics, Remote Config, FCM push with local notifications.
- Deep links and universal / App Links, force update and maintenance mode, demo APK.

### Phases 0–2: foundation and app layer

- Decisions (ADRs), three environments, splash, icons, `pnpm bootstrap`, CI.
- API client with Zod, TanStack Query persisted to MMKV, React Navigation static API, Unistyles design
  system, English and Arabic (RTL), forms, auth, feed and settings, MSW mock backend.
