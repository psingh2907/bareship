# Best-practices audit

The code written before the agent skills were adopted (Phases 0–3 offline), checked against the vendored
skills in `.claude/skills/`. Fix pending items when you touch the area, and move them to "Done" with the
commit. Started 2026-10-10.

Measure before and after any performance change (the skill's own rule). Bundle sizes below are release JS
bundles: `pnpm exec react-native bundle --platform android --dev false --minify true …`.

## Done

| Item | Skill reference | Result |
| --- | --- | --- |
| zod's locale barrel shipped ~60 languages the app never shows | `bundle-barrel-exports`, `bundle-library-size` | Metro resolves it to `metro/zod-locales.js` (English only): −295 KB |
| FormatJS Intl polyfills needed `Intl.Locale` (~390 KB) | `native-sdks-over-polyfills` ("remove Intl polyfills only after checking Hermes coverage") | `intl-pluralrules` + `relative-time-format`: −333 KB. Checked in Hermes: Arabic plurals and relative times correct |
| **Total** | | Android bundle 4,176 KB → 3,548 KB (−15%) |
| Phase 3 libraries measured (2026-10-11) | `bundle-library-size` | +174 KB: React Native Firebase JS ~82 KB, device-info 33 KB, new app code. The Firebase web SDK it depends on is not in the bundle |
| Barrel `index.ts` files in `shared/ui`, `shared/api`, `data`, `entities/*` (2026-10-11) | `bundle-barrel-exports` | Removed; 29 files import from the defining module. Android release bundle 3,831 → 3,824 KB. `no-restricted-imports` rejects folder imports (`@/shared/i18n` and `@/shared/ports` define their contents and stay), and `app/` may import a feature only through its `index.ts` |
| React Compiler lint rules weren't enabled (2026-10-11) | `js-react-compiler` | The eslint-plugin-react-hooks 7 compiler rules are on as errors; no violations. `react-compiler-healthcheck@1.0.0`: 55 of 55 components compile, no incompatible libraries |
| Legacy `accessibility*` props (2026-10-11) | `react-native-testing` (rule 10) | ARIA props on React Native's components and on our own (`Icon`, `Image` and `SegmentedControl` take `aria-label`). Headings use `role="heading"`. `no-restricted-syntax` rejects the old props; the wrappers around react-native-svg, FastImage and the bottom sheet keep them, because those libraries don't translate `aria-*` |
| Feed rows with and without images shared one recycling pool (2026-10-27) | `js-lists-flatlist-flashlist` | `FeedScreen` passes `getItemType` (`image` / `text`), so a recycled row keeps its layout |
| Tests queried like buttons by `testID` (2026-10-27) | `react-native-testing` | `FeedScreen.test.tsx` finds them with `getByRole('button', { name })`, scoped to one post's card. `testID` stays on non-semantic views and for Maestro |
| Bottom sheets on iOS rendered under native-stack modals (2026-10-27) | `js-bottomsheet` | Reproduced on the iOS 27 simulator (a sheet opened from a modal stayed behind it). `Sheet` passes `containerComponent` with `FullWindowOverlay` on iOS; the sheet now shows above the modal, and Close and drag-to-dismiss work |

## Pending: fix when touching the area

| Item | Skill reference | Notes |
| --- | --- | --- |
| No startup (TTI) measurement | `native-measure-tti` | Phase 4: `react-native-performance` markers, cold starts only |
| Bundle size isn't tracked per PR | `bundle-analyze-js` | Phase 4: report the size in CI (no failing budget, per the questionnaire) |

## Reviewed, no change

- Controlled `TextInput` (react-hook-form): kept. The New Architecture removes the flicker the skill warns
  about, and the forms validate on every change (`js-uncontrolled-components`).
- FlashList v2 without `estimatedItemSize`, R8 on, 16 KB page alignment checked in CI, native-stack screens,
  Zustand only for client state, React Compiler on, React Navigation static API, one module per icon, MSW
  absent from release bundles: all match the skills.
- Hermes mmap (`bundle-hermes-mmap`) only applies to React Native 0.78 and earlier.
