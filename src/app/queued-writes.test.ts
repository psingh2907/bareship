const fs = jest.requireActual<typeof import('fs')>('fs');
const path = jest.requireActual<typeof import('path')>('path');

const SRC = path.join(__dirname, '..');

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

describe('queued-writes.ts', () => {
  // Without the import, a write queued before the app was closed can't replay (inlineRequires).
  it('imports every module that defines a queued write', () => {
    const registry = fs.readFileSync(path.join(__dirname, 'queued-writes.ts'), 'utf8');
    const definers = sourceFiles(path.join(SRC, 'features'))
      .filter(file => /\bdefineQueued(Mutation|Upload)\s*[<(]/.test(fs.readFileSync(file, 'utf8')))
      .map(
        file =>
          `@/${path
            .relative(SRC, file)
            .replace(/\.tsx?$/, '')
            .replace(/\\/g, '/')}`,
      );

    // The scan must see feature code; an app with no queued writes yet passes trivially.
    expect(sourceFiles(path.join(SRC, 'features')).length).toBeGreaterThan(0);
    for (const module of definers) expect(registry).toContain(`import '${module}';`);
  });
});
