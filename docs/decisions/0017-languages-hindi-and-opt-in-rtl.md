# 0017. Ship English and Hindi; right-to-left is a switch per language

- Status: Accepted
- Date: 2026-10-17
- Refines: RTL (D9) in [0008](0008-ui-system.md) and i18n (D8) in [0009](0009-forms-and-i18n.md)

## Context

The template shipped English and Arabic. Arabic was the demo language because it exercises the hard
cases at once: a right-to-left layout and six plural forms. No decision named it, and it isn't a language
the maintainer reads, so its strings couldn't be reviewed, and a right-to-left alignment bug on iOS went
unnoticed until screenshots were taken.

The maintainer wants the template to stay multilingual with a second language they can check, and to keep
right-to-left support ready for apps that need it.

## Decision

- **Languages:** English and Hindi (`hi`, shown as "हिन्दी"). Hindi is a second script (Devanagari) with
  its own plural rule (0 and 1 are "one") and relative-time phrases, so it still tests that nothing is
  hard-coded to English.
- **Right-to-left is a flag on each language** in `LANGUAGES` (`src/shared/i18n/index.ts`). No shipped
  language sets it. Adding Arabic, Hebrew, Persian or Urdu is a locale file, an entry with `rtl: true` and
  its relative-time data in `src/shared/lib/format.ts`. The direction switch, the restart prompt in
  Settings, mirrored icons and `start`/`end` layout stay in the code.
- **Tests keep right-to-left working without an RTL language:** `applyDirection` is tested with the flag
  (`src/shared/i18n/i18n.test.ts`), directional icons are tested under a right-to-left runtime
  (`src/shared/ui/primitives/Icon.test.tsx`), and every shipped language must have every English key.
- **Lint rejects physical sides** in styles (`marginLeft`, `paddingRight`, `left`, `borderLeftWidth`…) and
  `textAlign: 'left' | 'right'`, so layouts mirror when a right-to-left language is added.
- The generator and `pnpm strip-examples` work on every file in `src/shared/i18n/locales`, so adding a
  language needs no script changes.

## Consequences

- Right-to-left is no longer seen on a device in the demo. Unit tests and the lint rule cover the code,
  but an app that adds an RTL language must check it on iOS and Android. The iOS alignment issue (text
  not following the RTL layout) was fixed on 2026-10-27: the `Text` primitive defaults to
  `textAlign: 'start'`, which React Native resolves against the layout direction on both platforms.
- Switching between English and Hindi takes effect at once, with no restart, so text has to follow a
  language change while the app runs. Formatted dates and times now come from `useFormat()`, because the
  React Compiler cached plain `formatRelative(date)` calls in the old language; lint enforces it. Screen
  titles translated once at startup show the same problem and still need fixing.
- Hindi strings use everyday app Hindi with common loan words (ऐप, ईमेल, पासवर्ड, सिंक). An app that
  ships Hindi should still have them reviewed for its audience.

## Alternatives considered

- Keep Arabic: covers right-to-left on a device, but nobody on the project can review it.
- English only, with a hidden language picker: simpler, but the template would stop showing that every
  string is translated and that formatting follows the language.
- Keep Arabic's locale file unused as a sample: it would drift from `en.json` without a test.
