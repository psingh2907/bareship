/**
 * Removes the demo content (feed, posts and likes, component showroom) and leaves a blank Home tab
 * (ADR 0001). Sign-in, onboarding, settings, the design system and every service stay.
 *
 *   pnpm strip-examples [--dry-run]
 *
 * Run it once on a fresh copy, after `pnpm bootstrap` and before writing your own code. Demo code is
 * marked in the source:
 *
 *   code // @example              the line is deleted
 *   code // @example:<id>         the line is replaced with REPLACEMENTS[id]
 *   // @example-start[:<id>]      the block up to `@example-end` is deleted (or replaced)
 *   // @example-end
 *
 * `scripts/ci/check-strip-examples.sh` strips a scratch copy and runs the checks on it.
 */
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { parseArgs } from 'node:util';

const ROOT = join(__dirname, '..');
const SCANNED = ['src', 'scripts'];
const SELF = 'scripts/strip-examples.ts';

/** Whole folders and files that exist only for the demo. */
const REMOVED = ['src/features/feed', 'src/features/showroom'];

const REPLACEMENTS: Record<string, string> = {
  'home-import': "import { HomeScreen } from '@/features/home';",
  'home-tab': `    Home: {
      screen: HomeScreen,
      linking: 'home',
      options: {
        headerTitle: () => <TranslatedText i18nKey="home.title" />,
        tabBarLabel: ({ color }) => <TranslatedText i18nKey="tabs.home" color={color} small />,
        tabBarIcon: ({ color, size }) => <TabIcon icon={Home} color={color} size={size} />,
        tabBarButtonTestID: 'tab-home',
      },
    },`,
  'home-title': "  ['Home', 'home.title'],",
  'settings-icons': "import { Bell, LogOut, Trash2 } from '@/shared/ui/icons';",
  'queued-writes-empty': `// No queued writes yet. Add one line per module that defines one, under this directive:
// /* eslint-disable no-restricted-imports */
// import '@/features/<feature>/api';
export {};`,
  'mock-db-import': "import { ACCESS_TOKEN_TTL_MS, db, type UserRecord } from './db';",
  'app-test-home':
    "    expect(await screen.findByTestId('home-screen', {}, { timeout: 5000 })).toBeOnTheScreen();",
  'link-paths': 'const LINK_PATHS: string[] = [];',
};

/** Files the stripped app gets instead of the demo. */
const CREATED: Record<string, string> = {
  'src/features/home/index.ts': "export { HomeScreen } from './screens/HomeScreen';\n",
  'src/features/home/screens/HomeScreen.tsx': `import { useSession } from '@/entities/session/session-store';
import { useTranslation } from '@/shared/i18n';
import { Screen } from '@/shared/ui/primitives/Screen';
import { Stack } from '@/shared/ui/primitives/Stack';
import { Text } from '@/shared/ui/primitives/Text';

/** The first tab. Replace it with your app's home, or add features with \`pnpm gen feature <name>\`. */
export function HomeScreen() {
  const { t } = useTranslation();
  const user = useSession(state => state.user);

  return (
    <Screen edges={[]} testID="home-screen">
      <Stack gap="sm">
        <Text variant="title">{t('home.welcome', { name: user?.name ?? '' })}</Text>
        <Text tone="muted">{t('home.body')}</Text>
      </Stack>
    </Screen>
  );
}
`,
  'src/features/home/screens/HomeScreen.test.tsx': `import { screen } from '@testing-library/react-native';

import { signInDemoUser } from '@/test/app';
import { renderWithProviders } from '@/test/render';

import { HomeScreen } from './HomeScreen';

describe('HomeScreen', () => {
  it('greets the signed-in user', async () => {
    await signInDemoUser();
    await renderWithProviders(<HomeScreen />);
    expect(screen.getByText('Welcome, Demo User')).toBeOnTheScreen();
  });
});
`,
};

/** Translation changes, per locale. */
const STRINGS: Record<string, { remove: string[]; add: Record<string, Record<string, string>> }> = {
  en: {
    remove: ['feed', 'tabs.feed', 'settings.showroom'],
    add: {
      tabs: { home: 'Home' },
      home: {
        title: 'Home',
        welcome: 'Welcome, {{name}}',
        body: 'This is your app. Add a feature with pnpm gen feature <name>.',
      },
    },
  },
  hi: {
    remove: ['feed', 'tabs.feed', 'settings.showroom'],
    add: {
      tabs: { home: 'होम' },
      home: {
        title: 'होम',
        welcome: 'स्वागत है, {{name}}',
        body: 'यह आपका ऐप है। pnpm gen feature <name> से एक फ़ीचर जोड़ें।',
      },
    },
  },
};

// Markers live in comments (`//`, `/* */` or JSX `{/* */}`), so text like demo@example.com never matches.
const MARKER = /(?:\/\/|\/\*)\s*@example(?:-start|-end)?\b/;
const START = /(?:\/\/|\/\*)\s*@example-start(?::([\w-]+))?/;
const END = /(?:\/\/|\/\*)\s*@example-end\b/;
const LINE = /(?:\/\/|\{?\/\*)\s*@example(?::([\w-]+))?\s*(?:\*\/\}?)?\s*$/;

export function stripSource(source: string, file: string): string {
  const lines = source.split('\n');
  const out: string[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!;
    const start = START.exec(line);
    if (start) {
      const end = lines.findIndex((candidate, at) => at > index && END.test(candidate));
      if (end === -1) throw new Error(`${file}:${index + 1}: @example-start without @example-end`);
      if (start[1]) out.push(replacement(start[1], file, index));
      index = end;
      continue;
    }
    if (END.test(line)) {
      throw new Error(`${file}:${index + 1}: @example-end without @example-start`);
    }
    const inline = LINE.exec(line);
    if (inline) {
      if (inline[1]) out.push(replacement(inline[1], file, index));
      continue;
    }
    out.push(line);
  }
  return out.join('\n');
}

function replacement(id: string, file: string, index: number): string {
  const code = REPLACEMENTS[id];
  if (code === undefined) throw new Error(`${file}:${index + 1}: unknown @example id "${id}"`);
  return code;
}

function sourceFiles(dir: string): string[] {
  return readdirSync(join(ROOT, dir)).flatMap(name => {
    const path = join(dir, name);
    if (statSync(join(ROOT, path)).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx|js)$/.test(name) && path !== SELF ? [path] : [];
  });
}

function editStrings(dryRun: boolean): string[] {
  const changed: string[] = [];
  const locales = readdirSync(join(ROOT, 'src/shared/i18n/locales'))
    .filter(file => file.endsWith('.json'))
    .map(file => file.replace(/\.json$/, ''));
  for (const locale of locales) {
    // A language added after the template shipped gets the English strings to translate.
    const { remove, add } = STRINGS[locale] ?? STRINGS.en!;
    const file = `src/shared/i18n/locales/${locale}.json`;
    const json = JSON.parse(readFileSync(join(ROOT, file), 'utf8')) as Record<
      string,
      Record<string, string>
    >;
    if (!('feed' in json)) continue; // already stripped
    for (const key of remove) {
      const [section, name] = key.split('.') as [string, string | undefined];
      if (name) {
        // Plural forms (likes_one, likes_other…) go with their key.
        for (const existing of Object.keys(json[section] ?? {})) {
          if (existing === name || existing.startsWith(`${name}_`)) delete json[section]![existing];
        }
      } else {
        delete json[section];
      }
    }
    for (const [section, values] of Object.entries(add)) {
      json[section] = { ...json[section], ...values };
    }
    if (!dryRun) writeFileSync(join(ROOT, file), JSON.stringify(json, null, 2) + '\n');
    changed.push(file);
  }
  return changed;
}

function main() {
  const { values } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false } } });
  const dryRun = values['dry-run'];
  const changed: string[] = [];

  // Edit marked files first, so a broken marker stops the script before anything is deleted.
  const edits = SCANNED.flatMap(sourceFiles)
    .filter(file => !REMOVED.some(dir => file.startsWith(`${dir}/`)))
    .flatMap(file => {
      const source = readFileSync(join(ROOT, file), 'utf8');
      if (!MARKER.test(source)) return [];
      return [{ file, stripped: stripSource(source, file) }];
    });
  if (edits.length === 0 && REMOVED.every(dir => !existsSync(join(ROOT, dir)))) {
    console.log('Nothing to strip: the demo content is already gone.');
    return;
  }

  for (const { file, stripped } of edits) {
    if (!dryRun) writeFileSync(join(ROOT, file), stripped);
    changed.push(file);
  }
  for (const dir of REMOVED) {
    if (!existsSync(join(ROOT, dir))) continue;
    if (!dryRun) rmSync(join(ROOT, dir), { recursive: true });
    changed.push(`${dir}/ (deleted)`);
  }
  for (const [file, content] of Object.entries(CREATED)) {
    if (existsSync(join(ROOT, file))) continue;
    if (!dryRun) {
      mkdirSync(dirname(join(ROOT, file)), { recursive: true });
      writeFileSync(join(ROOT, file), content, { flag: 'wx' });
    }
    changed.push(file);
  }
  changed.push(...editStrings(dryRun));

  if (!dryRun) {
    const formatted = changed
      .filter(file => !file.endsWith('(deleted)'))
      .map(file => join(ROOT, file));
    const code = formatted.filter(file => /\.(ts|tsx)$/.test(file));
    execFileSync(join(ROOT, 'node_modules/.bin/eslint'), ['--fix', ...code], { stdio: 'inherit' });
    execFileSync(
      join(ROOT, 'node_modules/.bin/prettier'),
      ['--write', '--log-level', 'warn', ...formatted],
      {
        stdio: 'inherit',
      },
    );
  }

  console.log(`${dryRun ? 'Would change' : 'Changed'}:`);
  for (const file of changed.sort()) console.log(`  ${relative(ROOT, join(ROOT, file))}`);
  if (!dryRun) {
    console.log(
      '\nNext:\n  - Run pnpm check.\n  - The docs (README, docs/) still describe the demo; rewrite the README for your app.',
    );
  }
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
