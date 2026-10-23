# Packaging the template

How this repository becomes the things people start from (ADR 0001): a GitHub template repository, an
npm template for the React Native CLI, and the installer that runs it, `create-bareship`
([ADR 0018](decisions/0018-create-bareship.md)). This page is for maintainers; it isn't copied into apps.

## The npm packages

```bash
pnpm pack-template
```

It writes two tarballs to `dist/npm/`, always with the same version (it stops if
`packages/create-bareship/package.json` and `package.json` disagree):

- `bareship-<version>.tgz`, the template.
- `create-bareship-<version>.tgz`, the installer: `packages/create-bareship/` (its `bin/` and
  `package.json`), the license, and the repository's `README.md`. It has no dependencies. `create-bareship@X` creates apps from
  `bareship@X`, so the two are published together.

The template tarball contains:

| Path | What |
| --- | --- |
| `template.config.js` | Tells the CLI the placeholder (`BareshipApp`) and where the app is |
| `template/` | The app: every file git tracks, except the template's own files (this page, `LICENSE`, `CHANGELOG.md`, `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, issue templates, the website, the installer in `packages/`, the packing scripts) |
| `template/README.md` | The app's README, from `scripts/app-readme.md`: how to run, customise and release the app. The template's README stays in this repository |
| `bin/create-bareship.mjs` | The installer, as the package's `bareship` bin, so `npx bareship Acme` creates an app |
| `package.json`, `README.md`, `LICENSE` | The npm package itself. The README starts with a note that the package is a template, not a library |

Both packages show the repository's README on npm, screenshots included, with its relative links pointed
at GitHub. `create-bareship` is the page to link to: it's the command people run. Edit `README.md`, not
`packages/create-bareship/README.md`, which only describes the folder on GitHub.

When someone runs `init`, the CLI copies `template/`, replaces every `BareshipApp` and `bareshipapp` (Xcode
project and schemes, bundle ids, the Android package, URL schemes, `package.json`'s name) with the new
app's name, and renames `_gitignore` to `.gitignore`. npm drops `.gitignore` files from packages, so the
packer ships it as `_gitignore`. The app's `package.json` gets version `0.0.1` and no license: the app
belongs to its author. The template's MIT notice ships as `TEMPLATE-LICENSE`, which the license asks for
in copies of the code.

### Check it

```bash
scripts/ci/check-template-init.sh
```

Packs, runs `init`, checks that no placeholder is left, the iOS bundle id kept its environment suffix and the app's README and docs have no broken links,
then installs, runs `pnpm bootstrap` and `pnpm strip-examples`, and runs `pnpm check` in the new app. It
takes a few minutes and builds nothing native.

```bash
scripts/ci/check-create.sh
```

Checks the installer the same way, from the tarballs: bad input fails early, then it creates one app with
`npx create-bareship-<version>.tgz` and one with the `bareship` bin (`--template` points both at the packed
template instead of npm), checks the placeholders, bundle ids, Android package and first commit, and runs
`pnpm check` in each. It skips `pod install`. To try the installer by hand:

```bash
npx ./dist/npm/create-bareship-<version>.tgz Acme --template ./dist/npm/bareship-<version>.tgz --yes
```

`--template` is left out of `--help` on purpose: it takes a local folder or tarball, for testing.

### Init with `--skip-install`, then pnpm

React Native CLI 20's `init` can't use pnpm (`--pm` takes npm, yarn or bun), and an npm or yarn install
would skip the lockfile and the supply-chain policy in `pnpm-workspace.yaml`. So the instructions are
`init … --skip-install`, then `pnpm install` in the new app.

### Don't recommend `--package-name`

The CLI's `--package-name` overwrites every `PRODUCT_BUNDLE_IDENTIFIER` in the Xcode project, which drops
the `$(BUNDLE_ID_SUFFIX)` that keeps dev, staging and prod apart on iOS, and it turns the URL schemes into
`com.acme.shop-dev`. Init with a name only, then set the bundle id with `pnpm bootstrap --bundle-id`.

### Publish

The packages are [`bareship`](https://www.npmjs.com/package/bareship)
([ADR 0015](decisions/0015-name-bareship.md)) and
[`create-bareship`](https://www.npmjs.com/package/create-bareship), published together with the same
version. To publish a new version:

1. `npm login` with the maintainer account.
2. Set `version` in `package.json` and in `packages/create-bareship/package.json`, and move the
   `CHANGELOG.md` entries from Unreleased to that version.
3. `pnpm pack-template`, then `scripts/ci/check-template-init.sh` and `scripts/ci/check-create.sh`.
4. Check what each tarball holds against git: `tar tzf dist/npm/bareship-<version>.tgz` should list only
   files from `git ls-files` (plus the generated `package.json`, `README.md`, `TEMPLATE-LICENSE` and
   `bin/`), and nothing untracked; `pack-template` also packs untracked files that aren't ignored.
5. Publish the template first, so the installer never points at a version that isn't there:
   `npm publish dist/npm/bareship-<version>.tgz --access public`, then
   `npm publish dist/npm/create-bareship-<version>.tgz --access public`. Each asks for the account's 2FA code.
6. Tag the commit `v<version>`, push the tag and create a GitHub release with the changelog entry.
   Publishing the release redeploys the maintainer's portfolio, so its Bareship page shows the new
   version (`.github/workflows/portfolio.yml`). Check that the Portfolio run passed under Actions.

### The portfolio redeploy

The Portfolio workflow needs:

- **GitHub Actions turned on for the repository** (Settings → Actions → General). To pause CI, disable
  the CI workflow itself (`gh workflow disable CI`) rather than turning Actions off: with Actions off, the
  Portfolio workflow never runs and nothing reports it.
- **The `PORTFOLIO_DEPLOY_HOOK` secret set to a Deploy Hook of the portfolio's Vercel project**
  (`praveensingh`: Settings → Git → Deploy Hooks, branch `main`), not of the `bareship` website project.
  A hook from the wrong project still makes the run pass, but it redeploys the website instead. To change
  it, run `gh secret set PORTFOLIO_DEPLOY_HOOK --repo psingh2907/bareship` and paste the hook's URL.

To redeploy by hand, for example after fixing the hook: `gh workflow run Portfolio --repo psingh2907/bareship`.
It deploys whatever version is latest on npm. Then check that the portfolio's Bareship page shows that
version.

Private vulnerability reporting is on (Settings → Security), so the link in `SECURITY.md` works.

## The GitHub template repository

In the repository's Settings → General, tick **Template repository** (or
`gh repo edit psingh2907/bareship --template`). People then click **Use this template**, clone their
copy and run the manual steps in the README's quick start (`pnpm install`, `bundle install`,
`pnpm bootstrap --name …`). The
repository has to be public for anyone outside it to use the template.

## Demo content

`pnpm strip-examples` removes the demo; `scripts/ci/check-strip-examples.sh` checks that the stripped app
still passes everything. See AGENTS.md › Demo code for the `// @example` markers.
