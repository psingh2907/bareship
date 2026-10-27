// ESLint 9 flat config. See docs/decisions/0005 and 0011.
import reactNative from '@react-native/eslint-config/flat';
import typescriptPlugin from '@typescript-eslint/eslint-plugin';
import boundaries from 'eslint-plugin-boundaries';
import i18next from 'eslint-plugin-i18next';
import simpleImportSort from 'eslint-plugin-simple-import-sort';

// Layers, top to bottom. A layer may import only from layers below it.
const LAYERS = ['app', 'features', 'entities', 'data', 'shared'];

// A later config block replaces a rule's options instead of merging them, so blocks that add
// restrictions repeat these.
const IMPORT_PATTERNS = [
  {
    group: ['react-native/Libraries/*'],
    message:
      'Deep imports are not part of the public API (RN 0.87 strict types). Import from "react-native".',
  },
  {
    group: ['../../*'],
    message: 'Use the "@/" alias instead of deep relative imports.',
  },
];

// Barrel files re-export other modules: they create require cycles, slow HMR and load more than a
// screen needs. `@/shared/i18n` and `@/shared/ports` define their contents, so they are allowed.
const NO_BARRELS = {
  regex: '^@/(data|entities/[^/]+|shared/(?!i18n$|ports$)[^/]+)$',
  message:
    'Import from the module that defines it (e.g. "@/shared/ui/primitives/Button"), not a folder index (AGENTS.md).',
};

const SYNTAX_RULES = [
  {
    selector: "CallExpression[callee.property.name='useVariants']",
    message:
      'useVariants goes stale under the React Compiler. Use a dynamic style function, e.g. styles.field(state) (AGENTS.md › Styling).',
  },
  {
    selector:
      'JSXAttribute[name.name=/^(accessibility(?!Hint$)[A-Z][A-Za-z]*|importantForAccessibility)$/]',
    message:
      'Use ARIA props: role, aria-label, aria-selected, aria-checked, aria-disabled, aria-busy, aria-live, aria-hidden, aria-valuetext (AGENTS.md › Agent skills). accessibilityHint stays.',
  },
  // Physical sides don't flip in right-to-left languages; start/end do (ADR 0017).
  {
    selector:
      'Property[key.name=/^(left|right|(margin|padding)(Left|Right)|border(Top|Bottom)?(Left|Right)(Width|Color|Radius)?)$/]',
    message:
      'Use start/end (marginStart, paddingEnd, start, borderStartWidth…) so the layout mirrors in right-to-left languages (ADR 0017).',
  },
  {
    selector:
      'JSXElement CallExpression[callee.name=/^format(Relative|Date|Number)$/], JSXExpressionContainer CallExpression[callee.name=/^format(Relative|Date|Number)$/]',
    message:
      'In components, use useFormat() from @/shared/lib/format: the React Compiler caches a plain formatRelative(date) call, so it stays in the old language after a switch.',
  },
  {
    selector: "Property[key.name='textAlign'] Literal[value=/^(left|right)$/]",
    message:
      "Use textAlign 'start', 'end' or 'center' (or leave it unset), so text follows the reading direction (ADR 0017).",
  },
];

// The React Compiler rules from eslint-plugin-react-hooks 7 ("recommended-latest"). The plugin is
// registered by @react-native/eslint-config.
const REACT_COMPILER_RULES = {
  'react-hooks/static-components': 'error',
  'react-hooks/use-memo': 'error',
  'react-hooks/void-use-memo': 'error',
  'react-hooks/preserve-manual-memoization': 'error',
  'react-hooks/incompatible-library': 'error',
  'react-hooks/immutability': 'error',
  'react-hooks/globals': 'error',
  'react-hooks/refs': 'error',
  'react-hooks/set-state-in-effect': 'error',
  'react-hooks/error-boundaries': 'error',
  'react-hooks/purity': 'error',
  'react-hooks/set-state-in-render': 'error',
  'react-hooks/unsupported-syntax': 'error',
  'react-hooks/config': 'error',
  'react-hooks/gating': 'error',
};

export default [
  {
    ignores: [
      'node_modules/**',
      'android/**',
      'ios/**',
      'coverage/**',
      'vendor/**',
      '.bundle/**',
      'assets/bootsplash/**',
      'dist/**',
      'website/**', // its own project (Astro); see website/package.json
      '.claude/**', // vendored skills and Claude Code worktrees (full copies of this repo)
    ],
  },
  ...reactNative,
  {
    plugins: { 'simple-import-sort': simpleImportSort },
    rules: {
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      'no-restricted-imports': ['error', { patterns: IMPORT_PATTERNS }],
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { '@typescript-eslint': typescriptPlugin },
    rules: {
      // Root imports bundle every icon (Metro can't tree-shake). Types are fine.
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'lucide-react-native',
              message: 'Import icons from "@/shared/ui/icons" (one module per icon).',
              allowTypeImports: true,
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { boundaries },
    settings: {
      'boundaries/include': ['src/**/*'],
      'boundaries/elements': [
        { type: 'app', pattern: 'src/app' },
        { type: 'features', pattern: 'src/features/*', capture: ['feature'] },
        { type: 'entities', pattern: 'src/entities/*', capture: ['entity'] },
        { type: 'data', pattern: 'src/data' },
        { type: 'shared', pattern: 'src/shared' },
      ],
      'import/resolver': { typescript: { project: './tsconfig.json' } },
    },
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          message:
            'Layer rule broken. Imports go app → features → entities → data → shared, and features never import each other (docs/decisions/0005).',
          policies: LAYERS.map((layer, i) => ({
            from: { element: { type: layer } },
            allow: [
              // Every layer below this one.
              ...LAYERS.slice(i + 1).map(type => ({ to: { element: { type } } })),
              // Within the same layer: a feature only into itself; other layers freely.
              layer === 'features'
                ? {
                    to: {
                      element: {
                        type: 'features',
                        captured: { feature: '{{ from.element.captured.feature }}' },
                      },
                    },
                  }
                : { to: { element: { type: layer } } },
            ],
          })),
        },
      ],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      ...REACT_COMPILER_RULES,
      'no-restricted-syntax': ['error', ...SYNTAX_RULES],
      'no-restricted-imports': ['error', { patterns: [...IMPORT_PATTERNS, NO_BARRELS] }],
    },
  },
  {
    // A feature's index.ts is its public API, and app/ is the only layer allowed to use it.
    files: ['src/app/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            ...IMPORT_PATTERNS,
            NO_BARRELS,
            {
              regex: '^@/features/[^/]+/',
              message:
                'Import a feature through its public API ("@/features/feed"), not its files.',
            },
          ],
        },
      ],
    },
  },
  {
    // No hard-coded user-visible text in screens: use t('…') (ADR 0009).
    files: ['src/app/**/*.tsx', 'src/features/**/*.tsx', 'src/shared/ui/**/*.tsx'],
    plugins: { i18next },
    rules: { 'i18next/no-literal-string': ['error', { mode: 'jsx-text-only' }] },
  },
  {
    // Node scripts and config files.
    files: [
      'scripts/**/*.ts',
      '*.config.{js,mjs,cjs}',
      '.dependency-cruiser.cjs',
      'babel.config.js',
      'metro.config.js',
      'jest.config.js',
    ],
    languageOptions: {
      globals: {
        process: 'readonly',
        __dirname: 'readonly',
        module: 'writable',
        require: 'readonly',
        console: 'readonly',
      },
    },
  },
];
