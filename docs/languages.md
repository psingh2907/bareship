# Languages and right-to-left

The app ships in English and Hindi. Users pick a language in Settings, and the first launch follows the
phone's language when the app has it. Right-to-left languages such as Arabic or Urdu are supported: you
add one with a single setting ([ADR 0017](decisions/0017-languages-hindi-and-opt-in-rtl.md)).

## How it works

| Part | Where | What it does |
| --- | --- | --- |
| Strings | `src/shared/i18n/locales/en.json`, `hi.json` | One file per language, with the same keys |
| Languages | `LANGUAGES` in `src/shared/i18n/index.ts` | Each language's own name and whether it's right-to-left |
| Engine | i18next and react-i18next | `t('feed.title')`, `{{name}}` placeholders and plurals |
| Device language | react-native-localize | Picks the phone's language on first launch |
| Dates, numbers, "2 days ago" | `useFormat()` in `src/shared/lib/format.ts` | Formats in the current language |

Translation keys are typed from `en.json`, so a wrong key fails `pnpm typecheck`, and lint rejects
hard-coded text in JSX.

## Write text that translates

- Put every string a user sees in `en.json` and read it with `t('…')`. Add the same key to every other
  locale file; a test fails if one is missing.
- Plurals use i18next suffixes: `likes_one` and `likes_other` in English and Hindi. Other languages may need
  more forms (Arabic has six).
- Format dates, numbers and relative times with `useFormat()` in components, never `formatRelative(date)`
  directly. The language can change while the app runs, and the React Compiler would keep the old text
  (lint enforces this).
- Lay out with `start` and `end`, never `left` and `right` (`marginStart`, `paddingEnd`, `start: 0`).
  Lint rejects physical sides and `textAlign: 'left' | 'right'`.
- Mark arrows and chevrons that point "forward" as `directional` on `Icon`, so they flip in right-to-left
  languages.

## Add a language

1. Copy `src/shared/i18n/locales/en.json` to a file named after the language code, for example `ta.json`
   for Tamil, and translate it.
2. In `src/shared/i18n/index.ts`, import it, add it to `resources`, and add an entry to `LANGUAGES` with its
   own name: `ta: { label: 'தமிழ்', rtl: false }`.
3. In `src/shared/lib/format.ts`, add its relative-time data:
   `import ta from 'relative-time-format/locale/ta.json'` and `RelativeTimeFormat.addLocale(ta)`.
4. Run `pnpm check`. Tests fail if a key or the relative-time data is missing.

`pnpm gen` adds new strings to every locale file as English copies, ready to translate.

## Add a right-to-left language

Follow the steps above and set `rtl: true` on the entry, for example
`ar: { label: 'العربية', rtl: true }`. Then:

- Switching to or from it changes the layout direction. React Native applies a new direction only at
  launch, so Settings asks the user to restart.
- Text aligns to the start of the layout on both platforms: the `Text` primitive defaults to
  `textAlign: 'start'`. Use `align="start"`, `"end"` or `"center"`, never `left` or `right`.
- Check every screen on both iOS and Android before you ship.

Tests keep right-to-left working while no shipped language uses it: they switch the direction with the
flag and check that directional icons mirror.

## Remove a language

Delete its locale file, its entry in `LANGUAGES` and `resources`, and its relative-time import. If only
English is left, consider hiding the language picker in Settings.
