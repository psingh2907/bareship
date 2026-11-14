/**
 * Removes Sign in with Apple and Google (ADR 0020) from the app. Email sign-in and everything else stay.
 *
 *   pnpm remove-social-sign-in [--dry-run] [--no-install]
 *
 * Code that exists only for it is marked in comments, in any comment syntax (`//`, `/* *\/`, `{/* *\/}`,
 * `#`, `<!-- -->`):
 *
 *   code // @social                   the line is deleted
 *   code // @social:<id>              the line is replaced with REPLACEMENTS[id]
 *   // @social-start[:<id>]           the block up to `@social-end` is deleted (or replaced)
 *   // @social-end
 *
 * Files that exist only for it are deleted, its strings are removed from every locale, the iOS project
 * loses the font and the Google URL scheme, and the two libraries leave package.json. Then `pnpm install`
 * and (on macOS) `pnpm pods` run, unless `--no-install`.
 *
 * `scripts/ci/check-remove-social-sign-in.sh` runs it on a scratch copy and checks the result.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

const ROOT = join(__dirname, '..');
const SELF = 'scripts/remove-social-sign-in.ts';

/** Folders scanned for marked source files, and single files with markers. */
const SCANNED_DIRS = ['src', 'scripts'];
const SCANNED_FILES = [
  '.env.example',
  '.env.dev',
  '.env.staging',
  '.env.prod',
  'AGENTS.md',
  'docs/going-live.md',
  'docs/native-changes.md',
  'docs/version-matrix.md',
];

/** Files and folders that exist only for social sign-in. */
const REMOVED = [
  'src/shared/adapters/native-social-sign-in.ts',
  'src/shared/adapters/native-social-sign-in.test.ts',
  'src/shared/ui/primitives/SocialButton.tsx',
  'src/shared/ui/primitives/SocialButton.test.tsx',
  'src/shared/ui/primitives/assets/google-g.png',
  'src/features/auth/components/SocialSignIn.tsx',
  'src/features/auth/components/SocialSignIn.test.tsx',
  'src/mocks/social.ts',
  'assets/fonts',
  'android/app/src/main/assets/fonts/SignInSans-Medium.ttf',
  'docs/social-sign-in.md',
];

const PACKAGES = [
  '@react-native-google-signin/google-signin',
  '@invertase/react-native-apple-authentication',
];

const FONT = 'SignInSans-Medium.ttf';

const REPLACEMENTS: Record<string, string> = {
  'auth-api-import': "import { login, register, requestPasswordReset } from '../api';",
  'theme-tokens-import':
    "import { feedback, neutral, radius, spacing, typography } from './tokens';",
  'agents-native-config': `- **Native config from \`.env\`:** \`APP_SCHEME\`, \`APP_LINK_DOMAIN\` and \`IOS_APS_ENVIRONMENT\` feed Gradle
  and \`scripts/ios/configure-environments.rb\`. Re-run that script after changing them.`,
};

const COMMENT = String.raw`(?:\/\/|\{?\/\*|#|<!--)`;
const MARKER = new RegExp(`${COMMENT}\\s*@social\\b`);
const START = new RegExp(`${COMMENT}\\s*@social-start(?::([\\w-]+))?`);
const END = new RegExp(`${COMMENT}\\s*@social-end\\b`);
const LINE = new RegExp(`${COMMENT}\\s*@social(?::([\\w-]+))?\\s*(?:\\*\\/\\}?|-->)?\\s*$`);

export function removeMarked(source: string, file: string): string {
  const lines = source.split('\n');
  const out: string[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!;
    const start = START.exec(line);
    if (start) {
      const end = lines.findIndex((candidate, at) => at > index && END.test(candidate));
      if (end === -1) throw new Error(`${file}:${index + 1}: @social-start without @social-end`);
      if (start[1]) out.push(replacement(start[1], file, index));
      index = end;
      continue;
    }
    if (END.test(line)) throw new Error(`${file}:${index + 1}: @social-end without @social-start`);
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
  if (code === undefined) throw new Error(`${file}:${index + 1}: unknown @social id "${id}"`);
  return code;
}

function sourceFiles(dir: string): string[] {
  if (!existsSync(join(ROOT, dir))) return [];
  return readdirSync(join(ROOT, dir)).flatMap(name => {
    const path = join(dir, name);
    if (statSync(join(ROOT, path)).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx|js|rb|md)$/.test(name) && path !== SELF ? [path] : [];
  });
}

/** Removes `auth.social` from every locale. */
function editStrings(dryRun: boolean): string[] {
  const dir = 'src/shared/i18n/locales';
  return readdirSync(join(ROOT, dir))
    .filter(name => name.endsWith('.json'))
    .flatMap(name => {
      const file = `${dir}/${name}`;
      const json = JSON.parse(readFileSync(join(ROOT, file), 'utf8')) as {
        auth?: Record<string, unknown>;
      };
      if (!json.auth || !('social' in json.auth)) return [];
      delete json.auth.social;
      if (!dryRun) writeFileSync(join(ROOT, file), JSON.stringify(json, null, 2) + '\n');
      return [file];
    });
}

/** Removes the two libraries from package.json. */
function editPackageJson(dryRun: boolean): string[] {
  const file = 'package.json';
  const pkg = JSON.parse(readFileSync(join(ROOT, file), 'utf8')) as {
    dependencies?: Record<string, string>;
  };
  const present = PACKAGES.filter(name => pkg.dependencies?.[name]);
  if (present.length === 0) return [];
  for (const name of present) delete pkg.dependencies![name];
  if (!dryRun) writeFileSync(join(ROOT, file), JSON.stringify(pkg, null, 2) + '\n');
  return [file];
}

/**
 * The iOS project: the Google URL scheme in Info.plist and the xcconfig files, and the font (Info.plist
 * `UIAppFonts`, the Fonts group and its Resources entry). configure-environments.rb would rewrite the URL
 * types too, but this works without Ruby. Skipped when the app has no ios/ folder.
 */
function editIosProject(dryRun: boolean): string[] {
  const app = (JSON.parse(readFileSync(join(ROOT, 'app.json'), 'utf8')) as { name: string }).name;
  const changed: string[] = [];
  const edit = (file: string, transform: (text: string) => string) => {
    if (!existsSync(join(ROOT, file))) return;
    const before = readFileSync(join(ROOT, file), 'utf8');
    const after = transform(before);
    if (after === before) return;
    if (!dryRun) writeFileSync(join(ROOT, file), after);
    changed.push(file);
  };

  edit(`ios/${app}/Info.plist`, text =>
    text
      // The URL type named google-sign-in.
      .replace(
        /\n\t\t<dict>\n\t\t\t<key>CFBundleURLName<\/key>\n\t\t\t<string>google-sign-in<\/string>[\s\S]*?\n\t\t<\/dict>/,
        '',
      )
      // UIAppFonts with only the sign-in font; or just that entry when other fonts are listed.
      .replace(
        new RegExp(
          `\\n\\t<key>UIAppFonts</key>\\n\\t<array>\\n\\t\\t<string>${FONT}</string>\\n\\t</array>`,
        ),
        '',
      )
      .replace(new RegExp(`\\n\\t\\t<string>${FONT}</string>`), ''),
  );

  for (const name of ['Dev', 'Staging', 'Prod']) {
    edit(`ios/Config/${name}.xcconfig`, text => text.replace(/^GOOGLE_URL_SCHEME = .*\n/m, ''));
  }

  edit(`ios/${app}.xcodeproj/project.pbxproj`, text => {
    const group =
      /\n\t\t(\w{24}) \/\* Fonts \*\/ = \{\n\t\t\tisa = PBXGroup;[\s\S]*?\n\t\t\};/.exec(text);
    let next = text;
    if (group && group[0].includes(FONT)) {
      next = next.replace(group[0], '');
      next = next.replace(new RegExp(`\\n\\t+${group[1]} /\\* Fonts \\*/,`), '');
    }
    // Every line that mentions the font: its build file, file reference and Resources entry.
    return next
      .split('\n')
      .filter(line => !line.includes(FONT))
      .join('\n');
  });
  return changed;
}

function main() {
  const { values } = parseArgs({
    options: {
      'dry-run': { type: 'boolean', default: false },
      'no-install': { type: 'boolean', default: false },
    },
  });
  const dryRun = values['dry-run'];
  const changed: string[] = [];

  // Edit marked files first, so a broken marker stops the script before anything is deleted.
  const edits = [...SCANNED_DIRS.flatMap(sourceFiles), ...SCANNED_FILES]
    .filter(file => existsSync(join(ROOT, file)))
    .filter(file => !REMOVED.some(path => file === path || file.startsWith(`${path}/`)))
    .flatMap(file => {
      const source = readFileSync(join(ROOT, file), 'utf8');
      if (!MARKER.test(source)) return [];
      return [{ file, result: removeMarked(source, file) }];
    });
  const leftovers = REMOVED.filter(path => existsSync(join(ROOT, path)));
  if (edits.length === 0 && leftovers.length === 0) {
    console.log('Nothing to remove: Sign in with Apple and Google is already gone.');
    return;
  }

  for (const { file, result } of edits) {
    if (!dryRun) writeFileSync(join(ROOT, file), result);
    changed.push(file);
  }
  for (const path of leftovers) {
    if (!dryRun) rmSync(join(ROOT, path), { recursive: true });
    changed.push(`${path} (deleted)`);
  }
  changed.push(...editStrings(dryRun), ...editPackageJson(dryRun), ...editIosProject(dryRun));

  if (!dryRun) {
    const written = changed
      .filter(file => !file.endsWith('(deleted)'))
      .map(file => join(ROOT, file));
    const code = written.filter(file => /\.(ts|tsx)$/.test(file));
    if (code.length > 0) {
      execFileSync(join(ROOT, 'node_modules/.bin/eslint'), ['--fix', ...code], {
        stdio: 'inherit',
      });
    }
    const formatted = written.filter(file => /\.(ts|tsx|js|json|md)$/.test(file));
    execFileSync(
      join(ROOT, 'node_modules/.bin/prettier'),
      ['--write', '--log-level', 'warn', ...formatted],
      { stdio: 'inherit' },
    );
  }

  console.log(`${dryRun ? 'Would change' : 'Changed'}:`);
  for (const file of changed) console.log(`  ${file}`);
  if (dryRun) return;

  if (values['no-install']) {
    console.log('\nNext: pnpm install, then pnpm pods (iOS).');
    return;
  }
  execFileSync('pnpm', ['install'], { cwd: ROOT, stdio: 'inherit' });
  if (process.platform === 'darwin' && existsSync(join(ROOT, 'ios'))) {
    execFileSync('pnpm', ['pods'], { cwd: ROOT, stdio: 'inherit' });
  }
  console.log(
    '\n✔ Sign in with Apple and Google is removed. Rebuild the app (pnpm ios / pnpm android) and review the diff.',
  );
}

if (require.main === module) main();
