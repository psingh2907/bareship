<!--
Title: a Conventional Commit, e.g. "fix(offline): retry queued likes after sign-in". It becomes the commit
on main when the pull request is squash-merged. Add "!" before the colon for a breaking change.
-->

## Why

<!-- The problem, in a sentence or two. Link the issue: "Closes #12". -->

## What changed

<!-- The visible result first, then anything a reviewer needs to know about how. -->

## How it was tested

- [ ] `pnpm check` passes
- [ ] iOS (simulator or device):
- [ ] Android (emulator or device):
- [ ] Not platform-specific

<!-- Screen or behaviour change? Add before and after screenshots or a short recording. -->

## Checklist

- [ ] One change: anything unrelated is in its own pull request
- [ ] Follows the layer rules (`pnpm depcruise` passes)
- [ ] Native change? Logged in `docs/native-changes.md`
- [ ] Changed a convention? Updated `AGENTS.md`, generators and the ADR (new ADR if a decision changed)
- [ ] New dependency? Checked against `docs/version-matrix.md` (RN 0.87, New Architecture, AGP 9, Xcode 27)
- [ ] Breaking change? Says what breaks and how to update
