---
title: FAQ
description: "Answers to common questions about Bareship: accounts, platforms, Expo, updates, state, styling and package managers."
---

## Getting started

### Do I need a backend?

No. Development builds use a mock backend inside the app, with a demo account (`demo@example.com` /
`password123`). When your API is ready, set `API_URL` and `API_MOCKS=false` in the environment's `.env` file.
The mock handlers in `src/mocks` show every request the app makes. See
[Use your API](/production/going-live/#use-your-api).

### Do I need Firebase, or an Apple or Google account?

Not to build and run the app. Without Firebase, crash reports and analytics go to the console, feature flags use
their defaults and notifications stay local. You need an Apple Developer team to put the iOS app on a phone with
push or web links, and store accounts to publish. The Apple and Google sign-in buttons work with mock providers
until you add your own OAuth ids ([Apple and Google sign-in](/build/social-sign-in/)). [Going live](/production/going-live/)
lists each step.

### Which platforms and versions are supported?

iOS 15.1 and later, and Android 7.0 (API 24) and later, on React Native 0.87 with the New Architecture only.
There's no web target. [Version matrix](/reference/version-matrix/) lists every library version.

### Can I use npm or yarn instead of pnpm?

Only to create the app: `npx create-bareship` (or the React Native CLI) downloads the template from npm,
then installs the app's dependencies with pnpm. After that, install and run everything with pnpm. The supply-chain policy (packages younger than 3 days are refused, install scripts need approval) and the
lockfile are pnpm's. Run `corepack enable` and the pinned pnpm version is used.
[Decision 0003](/reference/decisions/0003-package-manager-and-supply-chain/) explains why.

## Building your app

### How do I remove the demo?

Run `pnpm strip-examples` once, before you build your own screens. It removes the feed, its sample data and the
component showroom, and leaves a blank Home tab. Sign-in, onboarding and settings stay.

### Can I leave out Sign in with Apple and Google?

Yes. Release builds show no Apple or Google button until you add their ids. In development, set
`SOCIAL_SIGN_IN_MOCKS=false` in `.env.dev` to hide the mock buttons, or run `pnpm remove-social-sign-in` once to
take it out completely: code, the two libraries, the font and the native config. Email sign-in stays
([Apple and Google sign-in](/build/social-sign-in/#dont-need-it)).

### How do I add a screen or an API call?

Use the generators: `pnpm gen feature`, `pnpm gen screen` and `pnpm gen endpoint`. They write code that follows
the project's rules and passes its checks. See [Generators](/build/generators/).

### Where does app state go?

Data from the server belongs to TanStack Query, which caches it and saves it on the device. Zustand holds only
small client state, such as the session and preferences. Screens never call the HTTP client directly; they use
their feature's hooks. See [Architecture](/build/architecture/).

### How do I style screens?

With Unistyles 3 and the theme's roles (`theme.colors.text`, `theme.spacing.md`), never raw colours. Light and
dark themes switch without re-rendering. See [Styling](/build/styling/).

### How do I add a language?

Add a locale file next to `en.json` and `hi.json` in `src/shared/i18n/locales`, import it in
`src/shared/i18n/index.ts`, and add it to `LANGUAGES` there. Add its relative-time data to
`src/shared/lib/format.ts`; a test fails if you forget, and another fails if a key is missing.

For a right-to-left language (Arabic, Hebrew, Persian, Urdu), set `rtl: true` on its entry. Layouts use
`start` and `end` rather than `left` and `right` (lint enforces it), so they mirror, and Settings asks for a
restart when the direction changes. Check the app on both platforms before you ship it. The full steps are
in [Languages and right-to-left](/build/languages/).

## Production

### Can I move to Expo later?

The app code in `src/` reaches native libraries only through small interfaces in `src/shared/ports`, and every
native change is listed with its Expo equivalent in [Native changes](/production/native-changes/). Moving to
Expo's prebuild means following that list.

### Does it support over-the-air updates?

There's an interface for them, but no provider is wired in. Add one, such as hot-updater, behind
`src/shared/ports`.

### Are there end-to-end tests?

Not yet. Unit and component tests run with Jest and React Native Testing Library against the mock backend;
there are no device-level end-to-end flows.

### How do I release?

With fastlane: `bundle exec fastlane bump` sets the version, and the build and `beta` lanes build and upload to
TestFlight and Google Play internal testing. Building needs no accounts. See [Releasing](/production/releasing/).

## The template

### How do I get template updates into my app?

Your app owns its copy of the code, so nothing updates on its own. Each new version of the template is
published to [npm](https://www.npmjs.com/package/bareship) and listed in the
[changelog](/reference/changelog/) and the [GitHub releases](https://github.com/psingh2907/bareship/releases).
Copy the changes you want.

### Which version of the template should I use?

The latest, which `npx create-bareship` picks for you. Each version of `create-bareship` creates apps from
the same version of the template, so to start from an earlier one, name it: `npx create-bareship@0.3.0 Acme`
(or `--template bareship@0.2.0` with the React Native CLI). The [changelog](/reference/changelog/) lists
the versions.

### What does it cost, and what's the license?

Nothing. It's open source under the MIT license. Apps you make from it carry the template's notice in
`TEMPLATE-LICENSE`; your own code is yours to license.
