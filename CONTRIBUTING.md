# Contributing

Thanks for helping. This file covers contributing to the template itself; [AGENTS.md](AGENTS.md) holds the
rules for code written in it, and applies here too. Everyone taking part follows the
[code of conduct](CODE_OF_CONDUCT.md).

## Before you start

- **Questions and ideas:** ask in [Discussions](https://github.com/psingh2907/bareship/discussions).
- **Bugs:** open an issue with the steps to reproduce, the platform and the versions (`npx react-native info`).
- **Typos and small doc fixes:** open a pull request straight away, no issue needed.
- **Anything bigger, and changes to a decision** (a library, a pattern, a convention): open an issue first and
  wait for a reply, so you don't build something that can't be merged. Decisions are recorded in
  [docs/decisions/](docs/decisions/README.md); a change gets a new ADR rather than an edit to the old one.
- **Security issues:** don't open an issue; see [SECURITY.md](SECURITY.md).

Issues labelled `good first issue` are small and well described; `help wanted` ones are open to anyone.
To take one, comment on it; the maintainer assigns it to you, so two people don't do the same work. If
you can't finish, say so and it goes back to the list.

### What happens to your issue

New issues are labelled `needs-triage` and get a first reply within three days. The maintainer
reproduces it or asks for what's missing, then either keeps it open (labelled `good first issue` or
`help wanted` if anyone can take it, or assigned if someone is on it) or closes it with a reason
(`duplicate`, `wontfix`, `invalid`). Questions are moved to Discussions.

## Making a change

```bash
pnpm install
bundle install
pnpm check            # types, lint, format, boundaries, tests
```

- Use Conventional Commits (`feat:`, `fix:`, `docs:`…); commitlint checks them on commit.
- Mark demo-only code with `// @example` (AGENTS.md › Demo code) and run
  `scripts/ci/check-strip-examples.sh`, so `pnpm strip-examples` keeps working.
- Changed something the generators produce (a convention, a primitive, the folder layout)? Update
  `scripts/generate.ts` and the `add-*` skills in `.claude/skills/` to match.
- Native change: mark it `[bareship]` and add a row to [docs/native-changes.md](docs/native-changes.md).
- New dependency: check it against [docs/version-matrix.md](docs/version-matrix.md) and record it there.
- Touched packaging (`template.config`, dotfiles, the name placeholder)? Run
  `scripts/ci/check-template-init.sh` ([docs/packaging.md](docs/packaging.md)).
- Touched the installer (`packages/create-bareship/`, [ADR 0018](docs/decisions/0018-create-bareship.md))?
  Keep it free of dependencies and run `scripts/ci/check-create.sh`, which creates apps through both npm
  packages. Its version always matches the root `package.json`.
- User-visible change? Add a line under **Unreleased** in [CHANGELOG.md](CHANGELOG.md).

## Opening a pull request

1. **Fork** the repository (maintainers branch in it directly) and branch from an up-to-date `main`. Name the
   branch after the change: `fix/offline-retry`, `docs/quick-start-windows`.
2. **Keep it to one change.** A fix, a refactor it needed and an unrelated typo are three pull requests.
   Small pull requests get reviewed the same day; a 100-file one waits.
3. **Title it as a Conventional Commit:** `fix(offline): retry queued likes after sign-in`. Pull requests
   are squash-merged, so the title becomes the commit on `main`, and a check fails until it fits.
   Add `!` for a breaking change (`feat(i18n)!: …`).
4. **Fill in the template:** why (link the issue with `Closes #12`), what changed, how you tested it on
   which platforms, and screenshots for anything on screen. Leave **Allow edits by maintainers** ticked,
   so small fixes (a title, a changelog line) don't need a round trip.
5. **Open it as a draft** if you want early feedback, and mark it ready when the checks pass.
6. **Checks:** CI runs `pnpm check`, the release-bundle check and the title check, and all must pass to
   merge. On your first pull request they show "awaiting approval" until the maintainer starts them, a
   GitHub safeguard for workflows from forks; after that they run on every push. The slow iOS and Android
   builds run only when a maintainer adds the `native` label
   ([ADR 0014](docs/decisions/0014-opt-in-native-ci.md)), so mention it if you changed native code.
7. **Review:** expect a first reply within three days. Push fixes as new commits rather than force-pushing,
   so the review can show what changed; they're squashed on merge anyway. Update from `main` when GitHub
   says the branch is out of date (the **Update branch** button does it). Reply to or resolve each review
   comment: open conversations block the merge.

Don't base one pull request on another. If you must, say so at the top of the second and wait until the
first is merged before merging it: GitHub retargets it to `main` only once the first branch is deleted.

### After it's merged

- The maintainer squash-merges it, so `main` gets one commit with your title (sometimes reworded) and you
  as its author. The linked issue closes by itself.
- Delete the branch in your fork; GitHub deletes branches only in this repository.
- It reaches npm with the next release. Your changelog line ships with it, credited to you, and the
  GitHub release lists your pull request.

A pull request that's waiting on you for 30 days is closed with a note; reopen it whenever you're back.

Maintainers: triage, labels and the merge checklist are in
[docs/maintaining.md](https://github.com/psingh2907/bareship/blob/main/docs/maintaining.md); releasing is
in [docs/packaging.md › Publish](docs/packaging.md#publish).

## Editing the website

The website (`website/`, Astro Starlight) is built from the repo's own docs, so most pages are edited where
they already live:

| Page | Edit |
| --- | --- |
| Environments, Architecture, Generators, Going live, Releasing, Demo build, Native changes, Version matrix, Best-practices audit | The file in `docs/` |
| Decisions | `docs/decisions/` |
| Styling, Testing, Project rules | The matching section of `AGENTS.md` |
| Contributing, Changelog | `CONTRIBUTING.md`, `CHANGELOG.md` |
| Home, Introduction, Quick start, FAQ, Offline, Built for AI agents | `website/content/` |

Every page's **Edit page** link opens the right file. `website/src/content/docs/` is generated: changes there
are overwritten.

```bash
pnpm site:dev       # http://localhost:4321, updates as you edit docs/, AGENTS.md or website/content/
pnpm site:build     # the site in website/dist/, then the link check
```

- **Add a page from `docs/`:** add it to `PAGES` in `website/scripts/sync-docs.mjs` and to the sidebar in
  `website/astro.config.mjs`. A page written only for the site goes in `website/content/` and the sidebar.
- **Links:** link between docs with relative paths (`going-live.md#use-your-api`) as usual; the site rewrites
  them. `pnpm site:build` fails and names the link when one points to a missing page or heading, so run it
  after renaming a file or rewording a heading.
- **Frontmatter:** quote a `description` that contains a colon, or the build fails.
- If `pnpm site:dev` keeps showing an error you've fixed, restart it with `pnpm site:dev --force`.

## License

By contributing you agree that your contribution is licensed under the [MIT License](LICENSE).
