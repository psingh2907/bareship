# Maintaining

How issues and pull requests move through this repository. Contributors follow
[CONTRIBUTING.md](../CONTRIBUTING.md); this is the maintainer's side. Not part of an app made from the template.

## Labels

| Label | Meaning | Added by |
| --- | --- | --- |
| `bug`, `enhancement` | Issue type | The issue form |
| `needs-triage` | Nobody has looked at it yet | The issue forms |
| `area: app`, `area: native`, `area: installer`, `area: site`, `area: docs`, `area: deps`, `area: ci` | What a pull request touches | The Labeler workflow, from the changed paths (`.github/labeler.yml`) |
| `native` | Run the iOS and Android CI builds ([ADR 0014](decisions/0014-opt-in-native-ci.md)) | A maintainer, by hand |
| `breaking` | Apps need to change something to take this version | A maintainer |
| `good first issue`, `help wanted` | Open to outside contributors | A maintainer, at triage |
| `skip-changelog` | Left out of generated release notes | A maintainer |
| `duplicate`, `invalid`, `wontfix`, `question` | Why an issue was closed | A maintainer |

`native` is separate from `area: native` on purpose: the label starts 30–90 minutes of builds, so it's
never added automatically.

## Triage

Within three days of a new issue:

1. Reproduce it on a fresh app (`npx create-bareship Repro --yes`) or ask for what's missing.
2. Swap `needs-triage` for an outcome: keep it open with `good first issue` / `help wanted` if someone
   else could take it, assign yourself if you're doing it, or close it with a reason label and a sentence.
3. A question in an issue: answer it, then move it to Discussions (**Convert to discussion**).

## Your own changes

Work goes through pull requests too, so the history on GitHub shows what changed and why:

- One change per pull request, on a branch named after it. Open an issue first for anything a visitor
  might want to follow or comment on; small fixes don't need one.
- Fill in the template like an outside contributor would. The checks are the review you get, so don't
  merge while they're running.
- Don't stack pull requests. If one depends on another, merge the first, then rebase the second onto
  `main`. Merging the second into the first's branch after the first has landed loses it, which is what
  happened to #7 (re-opened as #8).

## Merging

Pull requests are **squash-merged**, with the pull request title as the commit message, and the branch is
deleted on merge. Before pressing the button:

- [ ] The CI and title checks pass (both required on `main`). Native code changed? The `native` builds ran.
- [ ] The title reads well as a line in `git log` and the changelog.
- [ ] User-visible change? `CHANGELOG.md` has a line under Unreleased.
- [ ] Changed a convention? `AGENTS.md`, the generators and an ADR are updated.
- [ ] An outside contributor? Thank them, and credit them in the changelog line.

Close a pull request that's gone quiet for 30 days after asking once, with a note that it can be reopened.

## Releasing

See [packaging.md › Publish](packaging.md#publish). When you create the GitHub release, paste the changelog
entry, then **Generate release notes** to append the merged pull requests grouped by label
(`.github/release.yml`), and remove anything the changelog already says.

## Repository settings

What the flow above relies on (Settings in GitHub):

- **General → Pull Requests:** squash merging only, default message "Pull request title and description",
  "Automatically delete head branches" on.
- **Rules → Protect main:** no deletion, no force push, pull requests required, required checks
  "Types, lint, tests, boundaries" and "Conventional Commit title".
- **Features:** Issues and Discussions on.
- **Code security:** secret scanning with push protection, private vulnerability reporting and Dependabot
  security updates on. Renovate opens the routine dependency updates (`renovate.json`).
