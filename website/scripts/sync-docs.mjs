/**
 * Builds the site's pages (src/content/docs/, git-ignored) from two sources, so every page is written once:
 *
 *   - the repo's own docs (docs/*.md, ADRs, AGENTS.md sections, CONTRIBUTING, CHANGELOG), listed in pages()
 *   - pages written only for the site, in website/content/ (copied as they are)
 *
 * For repo docs it takes the `# Title` as the page title, writes a description from the first paragraph,
 * and rewrites relative links: to the page's address on the site when that file is a page here, otherwise
 * to the file on GitHub. Each page's "Edit page" link points at the file to edit.
 *
 *   node scripts/sync-docs.mjs                 once (pnpm build runs it before `astro build`)
 *   node scripts/sync-docs.mjs --dev [args]    keep pages in sync while `astro dev [args]` runs (pnpm dev)
 */
import { spawn } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  watch,
  writeFileSync,
} from 'node:fs';
import { dirname, join, posix, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEBSITE = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = join(WEBSITE, '..');
const OUT = join(WEBSITE, 'src/content/docs');
const AUTHORED = join(WEBSITE, 'content');
const GITHUB = 'https://github.com/psingh2907/bareship';

/**
 * Repo docs that become pages. `sections` takes only those `##` sections of the file (one section: its
 * heading becomes the title). `title` overrides the file's `# Title`; `label` is a shorter sidebar label.
 */
// A function, so docs added while `pnpm dev` runs (a new ADR) are picked up by the next sync.
const pages = () => [
  { from: 'docs/environments.md', to: 'start-here/environments' },
  { from: 'docs/architecture.md', to: 'build/architecture' },
  { from: 'docs/generators.md', to: 'build/generators', label: 'Generators' },
  {
    from: 'docs/languages.md',
    to: 'build/languages',
    title: 'Languages and right-to-left',
    label: 'Languages',
  },
  {
    from: 'docs/social-sign-in.md',
    to: 'build/social-sign-in',
    label: 'Apple and Google sign-in',
  },
  {
    from: 'docs/app-icon-and-splash.md',
    to: 'build/app-icon-and-splash',
    label: 'App icon and splash',
  },
  { from: 'AGENTS.md', sections: ['Styling'], to: 'build/styling' },
  {
    from: 'AGENTS.md',
    sections: ['Tests', 'Mock backend'],
    to: 'build/testing',
    title: 'Testing and the mock backend',
  },
  { from: 'AGENTS.md', to: 'build/project-rules', title: 'Project rules (AGENTS.md)' },
  { from: 'docs/going-live.md', to: 'production/going-live' },
  { from: 'docs/releasing.md', to: 'production/releasing' },
  { from: 'docs/demo-build.md', to: 'production/demo-build' },
  { from: 'docs/native-changes.md', to: 'production/native-changes' },
  { from: 'docs/decisions/README.md', to: 'reference/decisions', title: 'Decisions' },
  ...readdirSync(join(REPO, 'docs/decisions'))
    .filter(name => /^\d{4}-.+\.md$/.test(name))
    .sort()
    .map(name => ({
      from: `docs/decisions/${name}`,
      to: `reference/decisions/${name.slice(0, -3)}`,
      adr: true,
    })),
  { from: 'docs/version-matrix.md', to: 'reference/version-matrix' },
  { from: 'docs/best-practices-audit.md', to: 'reference/best-practices-audit' },
  { from: 'CONTRIBUTING.md', to: 'reference/contributing' },
  { from: 'CHANGELOG.md', to: 'reference/changelog' },
];

// ------------------------------------------------------------------------------------------- markdown

/** Splits markdown into lines, marking which are inside fenced code blocks. */
function lines(markdown) {
  let fence = null;
  return markdown.split('\n').map(text => {
    const marker = /^\s*(```+|~~~+)/.exec(text)?.[1];
    if (marker && (fence === null || marker.startsWith(fence))) {
      fence = fence === null ? marker : null;
      return { text, code: true };
    }
    return { text, code: fence !== null };
  });
}

function sections(markdown, names, file) {
  const all = lines(markdown);
  return names.map(name => {
    const start = all.findIndex(line => !line.code && line.text === `## ${name}`);
    if (start === -1) throw new Error(`${file} has no "## ${name}" section`);
    const end = all.findIndex(
      (line, index) => index > start && !line.code && /^#{1,2} /.test(line.text),
    );
    return all
      .slice(start, end === -1 ? undefined : end)
      .map(line => line.text)
      .join('\n')
      .trim();
  });
}

/** Rewrites relative links in non-code lines. `resolve` maps a repo path (+ hash) to a URL. */
function rewriteLinks(markdown, sourceFile, resolve) {
  return lines(markdown)
    .map(({ text, code }) =>
      code
        ? text
        : text.replace(
            /(!?\[[^\]]*\]\()([^)\s]+)(\s+"[^"]*")?\)/g,
            (match, open, target, title = '') => {
              if (/^(https?:|mailto:|#|\/)/.test(target)) return match;
              const [path, hash] = target.split('#');
              const repoPath = posix.normalize(posix.join(posix.dirname(sourceFile), path));
              return `${open}${resolve(repoPath, hash)}${title})`;
            },
          ),
    )
    .join('\n');
}

function firstParagraph(markdown) {
  const paragraph = [];
  for (const { text, code } of lines(markdown)) {
    if (code || /^(#|\||[-*+]\s|>|\d+\.\s|<)/.test(text.trim())) {
      if (paragraph.length) break;
      continue;
    }
    if (!text.trim()) {
      if (paragraph.length) break;
      continue;
    }
    paragraph.push(text.trim());
  }
  const plain = paragraph
    .join(' ')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[`*_]/g, '');
  if (plain.length <= 160) return plain;
  return `${plain.slice(0, 157).replace(/\s+\S*$/, '')}…`;
}

function frontmatter(fields) {
  const yaml = Object.entries(fields)
    .filter(([, value]) => value !== undefined && value !== '')
    .map(([key, value]) =>
      typeof value === 'object'
        ? `${key}:\n${Object.entries(value)
            .map(([inner, innerValue]) => `  ${inner}: ${JSON.stringify(innerValue)}`)
            .join('\n')}`
        : `${key}: ${JSON.stringify(value)}`,
    )
    .join('\n');
  return `---\n${yaml}\n---\n\n`;
}

// --------------------------------------------------------------------------------------------- build

function build() {
  const PAGES = pages();
  const slugs = new Map(PAGES.filter(page => !page.sections).map(page => [page.from, page.to]));
  const resolve = (repoPath, hash) => {
    const slug = slugs.get(repoPath);
    if (slug) return `/${slug}/${hash ? `#${hash}` : ''}`;
    const full = join(REPO, repoPath);
    const kind = existsSync(full) && statSync(full).isDirectory() ? 'tree' : 'blob';
    return `${GITHUB}/${kind}/main/${repoPath}${hash ? `#${hash}` : ''}`;
  };

  const written = new Map();
  const seen = new Set();
  for (const page of PAGES) {
    if (seen.has(page.to)) throw new Error(`Two pages map to ${page.to}`);
    seen.add(page.to);
    const source = readFileSync(join(REPO, page.from), 'utf8');
    let body;
    let title = page.title;
    if (page.sections) {
      const parts = sections(source, page.sections, page.from);
      if (parts.length === 1) {
        title ??= page.sections[0];
        body = parts[0].replace(/^## .*\n+/, '');
      } else {
        body = parts.join('\n\n');
      }
    } else {
      const heading = /^# (.+)\n+/m.exec(source);
      title ??= heading?.[1];
      body = heading ? source.replace(heading[0], '') : source;
    }
    if (!title) throw new Error(`${page.from} has no "# Title" and the page sets none`);
    body = rewriteLinks(body, page.from, resolve).trim();
    const fields = {
      title,
      description: firstParagraph(body),
      editUrl: `${GITHUB}/edit/main/${page.from}`,
      ...(page.adr ? { sidebar: { label: title.replace(/^(\d{4})\. /, '$1 · ') } } : {}),
      ...(page.label ? { sidebar: { label: page.label } } : {}),
    };
    written.set(`${page.to}.md`, frontmatter(fields) + body + '\n');
  }

  // Pages written for the site: copied as they are, with an edit link to their source.
  const authored = dir =>
    readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
      const full = join(dir, entry.name);
      return entry.isDirectory() ? authored(full) : /\.mdx?$/.test(entry.name) ? [full] : [];
    });
  for (const file of authored(AUTHORED)) {
    const target = relative(AUTHORED, file);
    if (written.has(target))
      throw new Error(`website/content/${target} clashes with a synced page`);
    const repoPath = relative(REPO, file);
    let content = readFileSync(file, 'utf8');
    if (!/^---\n[\s\S]*?\neditUrl:/.test(content)) {
      content = content.replace(
        /^---\n/,
        `---\neditUrl: ${JSON.stringify(`${GITHUB}/edit/main/${repoPath}`)}\n`,
      );
    }
    written.set(target, content);
  }

  // Write what changed, and remove pages whose source is gone.
  const existing = existsSync(OUT) ? authored(OUT).map(file => relative(OUT, file)) : [];
  for (const [target, content] of written) {
    const path = join(OUT, target);
    if (existsSync(path) && readFileSync(path, 'utf8') === content) continue;
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  }
  for (const target of existing) if (!written.has(target)) rmSync(join(OUT, target));
  return written.size;
}

const count = build();
console.log(`sync-docs: ${count} pages in src/content/docs`);

const devIndex = process.argv.indexOf('--dev');
if (devIndex !== -1) {
  const sources = [...new Set(pages().map(page => join(REPO, page.from)))];
  let timer;
  const rebuild = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      try {
        console.log(`sync-docs: ${build()} pages updated`);
      } catch (error) {
        console.error(`sync-docs: ${error.message}`);
      }
    }, 100);
  };
  for (const file of sources) watch(file, rebuild);
  watch(join(REPO, 'docs'), { recursive: true }, rebuild);
  watch(AUTHORED, { recursive: true }, rebuild);
  console.log('sync-docs: watching docs/, AGENTS.md and website/content/');

  const astro = spawn(
    join(WEBSITE, 'node_modules/.bin/astro'),
    ['dev', ...process.argv.slice(devIndex + 1)],
    {
      cwd: WEBSITE,
      stdio: 'inherit',
    },
  );
  astro.on('exit', code => {
    // Astro 7 moves the dev server to the background when an AI agent starts it, and that exits 0.
    // Keep syncing until Ctrl+C; `pnpm exec astro dev stop` stops the server.
    if (code === 0) console.log('sync-docs: astro dev is in the background; Ctrl+C stops syncing');
    else process.exit(code ?? 1);
  });
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => {
      astro.kill(signal);
      process.exit(0);
    });
  }
}
