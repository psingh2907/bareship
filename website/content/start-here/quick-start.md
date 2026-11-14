---
title: Quick start
description: "Create an app from the template, run it on a simulator or emulator, and start building your own features."
---

By the end of this page you have your own app, with your name and bundle id, running on an emulator or simulator, signed in with
sample data. It takes about 15 minutes plus the first native build, which compiles a lot of native code
and can take 30 minutes or more.

## Before you start

You need:

- **Node** 22.11 or later (`.nvmrc` pins 24)
- **pnpm** 12. Run `corepack enable` and the project's pinned version is used.
- **Ruby** 3.2.2 (`.ruby-version`) with Bundler
- **Java** 21
- **iOS:** a Mac with Xcode 27
- **Android:** Android Studio with SDK 37 and NDK 27.1, and `ANDROID_HOME` set to the SDK
  (usually `~/Library/Android/sdk`)

You don't need a backend, a Firebase project or an Apple Developer account.

## 1. Create your app

```bash
npx create-bareship Acme
cd Acme
```

It checks the tools above and tells you how to fix anything missing, then asks for:

- **Bundle id**, like `com.acme.app`. The dev and staging builds get `.dev` and `.staging` added, so all three
  install side by side.
- **Display name**, the name under the app icon.

Then it creates the app from the [npm template](https://www.npmjs.com/package/bareship), installs its
dependencies with pnpm and Bundler, sets the bundle id and display name, runs `pod install` on a Mac, and
makes the first git commit. `npx bareship Acme` does the same.

To ask nothing, for CI or an AI agent, pass everything as flags:

```bash
npx create-bareship Acme --bundle-id com.acme.app --display-name "Acme" --yes
```

| Option | What it does |
| --- | --- |
| `--bundle-id <id>` | Reverse-domain bundle id. Default: `com.<appname>.app` |
| `--display-name <name>` | Name under the app icon. Default: the app name |
| `--yes` | Ask nothing; use the defaults for anything not given |
| `--skip-pods` | Don't run `pod install`, for an Android-only setup. Always on outside macOS |
| `--dry-run` | Check the tools and print the commands without running them |

Each version of `create-bareship` creates the app from the same version of the template; the
[changelog](/reference/changelog/) lists the versions.

### Or step by step

These are the steps `create-bareship` runs, if you'd rather run them yourself:

```bash
npx @react-native-community/cli@20.2.0 init Acme --template bareship --skip-install --install-pods false
cd Acme
pnpm install
bundle install
pnpm bootstrap --bundle-id com.acme.app --display-name "Acme"
```

Use `--skip-install`: the CLI can't install with pnpm, and the project's lockfile and package policy need
pnpm. Don't pass `--package-name`; `bootstrap` sets the bundle id. It also moves the Android package to
match and runs `pod install`.

### Or from GitHub

Click **Use this template** on the [repository](https://github.com/psingh2907/bareship), then clone your new
repository. Your copy also holds the template's own files (the website, the changelog, the contributing
guide); delete the ones you don't want. Install and name it:

```bash
pnpm install
bundle install
pnpm bootstrap --name Acme --bundle-id com.acme.app --display-name "Acme"
```

`--name` renames the Xcode project, schemes and URL schemes, which are still called `BareshipApp` in a copy.

## 2. Run it

Start an Android emulator or plug in a phone first. The first debug build compiles native code only for the
connected device; with nothing connected it compiles for every Android CPU type, which takes about four times
longer.

```bash
pnpm android
```

For iOS:

```bash
pnpm ios
```

The app opens to onboarding, then sign-in. Sign in with `demo@example.com` / `password123`.

## 3. Look around

The demo shows the patterns you'll reuse:

- **Feed:** loading placeholders, pages that load as you scroll, pull to refresh, likes that change at once.
- **Offline:** turn on airplane mode. A banner appears, a like is kept as "waiting to sync", and it's sent when
  you reconnect, even after closing the app.
- **Settings:** light, dark or system theme; English or Hindi; notifications; sign out and
  delete account.
- **Component showroom** (Settings, development builds only): every UI primitive in one place.

## 4. Start your own app

When you're ready to build your own screens, remove the demo and add a feature:

```bash
pnpm strip-examples
pnpm gen feature orders
```

`strip-examples` removes the feed, its sample data and the showroom, and leaves a blank Home tab; sign-in,
onboarding and settings stay. `pnpm gen` writes a working list screen with its API call, sample data, strings
and tests ([Generators](/build/generators/)).

If your app won't offer Sign in with Apple and Google, `pnpm remove-social-sign-in` removes it, libraries and
native config included, and leaves email sign-in ([Apple and Google sign-in](/build/social-sign-in/#remove-it)).

Run the checks whenever you change something:

```bash
pnpm check
```

## Next

- [Environments](/start-here/environments/): dev, staging and prod, and where configuration lives.
- [App icon and splash screen](/build/app-icon-and-splash/): put your own icon and logo in the app.
- [Offline](/build/offline/): choose what each write does without a connection.
- [Going live](/production/going-live/): your API, signing, Firebase and push.

## If something goes wrong

| What you see | What to do |
| --- | --- |
| `Some tools are missing or too old` from `create-bareship` | Each missing tool is listed with how to install it. Fix them and run the command again; nothing was created |
| `npm error 404 … bareship` from `init` | Check the spelling: `--template bareship`. Behind a company registry or proxy, the package may not be mirrored yet; ask for `bareship` to be added |
| `Seems like the package manager you want to use is not installed` from `init` | Don't pass `--pm pnpm`; the CLI only installs with npm, yarn or bun. Use `--skip-install`, then `pnpm install` |
| `Run bundle install first` from `bootstrap` | Run `bundle install`, then `bootstrap` again. Nothing was renamed |
| `Unable to load contents of file list: '/Target Support Files/Pods-…'` from `pnpm ios` | The pods aren't installed. Run `pnpm pods`, then `pnpm ios` again |
| `SDK location not found` from Gradle | Set `ANDROID_HOME` to your Android SDK, for example `export ANDROID_HOME=~/Library/Android/sdk` |
| `Invalid Podfile file … on US-ASCII` from CocoaPods | Your terminal isn't using UTF-8. Run `export LANG=en_US.UTF-8`, then `pnpm pods` |
| `NoSuchFileException … .gradle/caches/…/transforms/…` | Gradle's cache has a half-written entry. Run `cd android && ./gradlew --stop`, delete the folder named in the error, and build again |
| The first Android build runs for an hour | No device was connected, so it builds for every CPU type. Stop it, start the emulator, and run `pnpm android` again |
