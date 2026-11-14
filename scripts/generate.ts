/**
 * Scaffolds features, screens and endpoints that follow the template's rules (AGENTS.md, ADR 0011).
 *
 *   pnpm gen feature <name> [--item <name>]
 *       src/features/<name>/: schema, api, a list screen with its test, and index.ts. Adds a mock
 *       endpoint (src/mocks/<name>.ts), a stack screen with a deep link, and strings in every locale file.
 *       --item names one record (default: <name> without a trailing "s", e.g. orders → order).
 *
 *   pnpm gen screen <feature> <name> [--param <name>]
 *       A screen and its test in an existing feature, exported from index.ts and registered in the
 *       navigator with a deep link (<feature>/<name>[/:param]).
 *
 *   pnpm gen endpoint <feature> <name> [--method get|post|put|patch|delete] [--path /orders/:id]
 *       A response schema, a query (GET) or mutation hook, a mock handler and a test.
 *       --path defaults to /<feature>; ":param" segments become arguments.
 *
 * Names are kebab-case (order-history). Files that already exist are never overwritten. The script
 * runs Prettier and ESLint --fix on what it touched; then run `pnpm check`.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { parseArgs } from 'node:util';

const ROOT = join(__dirname, '..');
const NAVIGATOR = 'src/app/navigation/RootNavigator.tsx';
const HANDLERS = 'src/mocks/handlers.ts';
const LINKS = 'scripts/links-files.ts';
const LOCALE_DIR = 'src/shared/i18n/locales';
// Every language the app ships; new strings start as English copies in each one.
const LOCALES = readdirSync(join(ROOT, LOCALE_DIR))
  .filter(file => file.endsWith('.json'))
  .map(file => `${LOCALE_DIR}/${file}`);
const SCREENS_MARKER = '// gen:screens';
const HANDLERS_MARKER = '// gen:handlers';
const METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;
type Method = (typeof METHODS)[number];

// ---------------------------------------------------------------------------------------------- names

export type Names = { kebab: string; camel: string; pascal: string };

export function names(input: string): Names {
  if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(input)) {
    throw new Error(`"${input}" isn't kebab-case (e.g. orders, order-history).`);
  }
  const camel = input.replace(/-([a-z0-9])/g, (_, char: string) => char.toUpperCase());
  return { kebab: input, camel, pascal: camel[0]!.toUpperCase() + camel.slice(1) };
}

/** orders → order, categories → category; anything else gets "-item". Override with --item. */
export function singular(input: string): string {
  if (input.endsWith('ies') && input.length > 4) return `${input.slice(0, -3)}y`;
  if (input.endsWith('s') && !input.endsWith('ss') && input.length > 3) return input.slice(0, -1);
  return `${input}-item`;
}

/** "/orders/:id/items" → the params and a template literal that encodes them. */
export function pathParams(path: string): { params: string[]; url: string } {
  if (!path.startsWith('/')) throw new Error(`--path must start with "/": ${path}`);
  const params: string[] = [];
  const url = path.replace(/:([a-zA-Z][a-zA-Z0-9]*)/g, (_, param: string) => {
    params.push(param);
    return `\${encodeURIComponent(${param})}`;
  });
  return { params, url: params.length > 0 ? `\`${url}\`` : `'${url}'` };
}

// ------------------------------------------------------------------------------------- file editing

const touched = new Set<string>();

function read(file: string): string {
  return readFileSync(join(ROOT, file), 'utf8');
}

function write(file: string, content: string) {
  mkdirSync(dirname(join(ROOT, file)), { recursive: true });
  writeFileSync(join(ROOT, file), content);
  touched.add(file);
}

function create(file: string, content: string) {
  if (existsSync(join(ROOT, file))) throw new Error(`${file} already exists; nothing was changed.`);
  write(file, content);
}

/** Adds named imports to a source file, merging into an existing import from the same module. */
export function addImport(source: string, imported: string[], from: string): string {
  const escaped = from.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
  const existing = new RegExp(`import \\{([^}]*)\\} from '${escaped}';`);
  const match = existing.exec(source);
  if (match) {
    const current = match[1]!
      .split(',')
      .map(name => name.trim())
      .filter(Boolean);
    const merged = [...current, ...imported.filter(name => !current.includes(name))];
    return source.replace(existing, `import { ${merged.join(', ')} } from '${from}';`);
  }
  const statement = `import { ${imported.join(', ')} } from '${from}';\n`;
  const imports = [...source.matchAll(/^import [\s\S]*?from '[^']+';\n/gm)];
  const last = imports.at(-1);
  if (!last) return statement + '\n' + source;
  const end = last.index + last[0].length;
  return source.slice(0, end) + statement + source.slice(end);
}

/** Inserts `code` on the line above `marker`. */
export function insertAbove(source: string, marker: string, code: string, file: string): string {
  const index = source.indexOf(marker);
  if (index === -1) throw new Error(`${file} has no "${marker}" line; add the code by hand.`);
  const lineStart = source.lastIndexOf('\n', index) + 1;
  return source.slice(0, lineStart) + code + source.slice(lineStart);
}

function addStrings(section: string, strings: Record<string, string>) {
  for (const file of LOCALES) {
    const json = JSON.parse(read(file)) as Record<string, Record<string, string>>;
    const target = (json[section] ??= {});
    for (const [key, value] of Object.entries(strings)) {
      if (key in target) throw new Error(`${file} already has "${section}.${key}".`);
      target[key] = value;
    }
    write(file, JSON.stringify(json, null, 2) + '\n');
  }
}

function routeExists(route: string): boolean {
  return new RegExp(`^\\s+${route}: \\{`, 'm').test(read(NAVIGATOR));
}

function registerScreen(options: {
  route: string;
  screen: string;
  feature: Names;
  linking: string;
  titleKey: string;
}) {
  if (routeExists(options.route))
    throw new Error(`The navigator already has a "${options.route}" route.`);
  let source = read(NAVIGATOR);
  source = addImport(source, [options.screen], `@/features/${options.feature.kebab}`);
  source = insertAbove(
    source,
    SCREENS_MARKER,
    `        ${options.route}: {
          screen: ${options.screen},
          linking: '${options.linking}',
          layout: offlineLayout,
          options: {
            headerShown: true,
            headerTitle: () => <TranslatedText i18nKey="${options.titleKey}" />,
          },
        },
`,
    NAVIGATOR,
  );
  write(NAVIGATOR, source);

  // Universal / App Links for the new path (scripts/links-files.ts).
  const links = read(LINKS);
  const path = `/${options.linking.replace(/:[^/]+/g, '*')}`;
  const updated = links.replace(
    /const LINK_PATHS: string\[\] = \[([^\]]*)\];/,
    (_, list: string) => {
      const paths = list
        .split(',')
        .map(entry => entry.trim())
        .filter(Boolean);
      return `const LINK_PATHS: string[] = [${[...paths, `'${path}'`].join(', ')}];`;
    },
  );
  if (updated !== links) write(LINKS, updated);
}

/** Adds a named export to the feature's public API, merging into an existing export from `from`. */
function exportFrom(feature: Names, exported: string, from: string) {
  const file = `src/features/${feature.kebab}/index.ts`;
  const source = read(file);
  const existing = new RegExp(`export \\{([^}]*)\\} from '${from.replace(/[./]/g, '\\$&')}';`);
  const match = existing.exec(source);
  write(
    file,
    match
      ? source.replace(existing, `export { ${match[1]!.trim()}, ${exported} } from '${from}';`)
      : `${source}export { ${exported} } from '${from}';\n`,
  );
}

function requireFeature(feature: Names) {
  if (!existsSync(join(ROOT, `src/features/${feature.kebab}/index.ts`))) {
    throw new Error(
      `src/features/${feature.kebab} doesn't exist. Run: pnpm gen feature ${feature.kebab}`,
    );
  }
}

// ------------------------------------------------------------------------------------------ feature

function generateFeature(feature: Names, item: Names) {
  if (existsSync(join(ROOT, `src/features/${feature.kebab}`))) {
    throw new Error(`src/features/${feature.kebab} already exists.`);
  }
  if (feature.kebab === item.kebab) throw new Error('--item must differ from the feature name.');
  const dir = `src/features/${feature.kebab}`;
  const route = feature.pascal;
  const screen = `${feature.pascal}Screen`;
  // Check everything before writing anything, so a failure leaves no half-made feature.
  if (routeExists(route)) throw new Error(`The navigator already has a "${route}" route.`);
  if (existsSync(join(ROOT, `src/mocks/${feature.kebab}.ts`))) {
    throw new Error(`src/mocks/${feature.kebab}.ts already exists.`);
  }
  for (const file of [NAVIGATOR, HANDLERS]) {
    const marker = file === NAVIGATOR ? SCREENS_MARKER : HANDLERS_MARKER;
    if (!read(file).includes(marker)) throw new Error(`${file} has no "${marker}" line.`);
  }

  create(
    `${dir}/schema.ts`,
    `import { z } from 'zod';

/** What the server sends (snake_case). Never leaves this feature's api layer. */
export const ${item.pascal}DtoSchema = z.object({
  id: z.string(),
  title: z.string(),
  created_at: z.iso.datetime(),
});

/** What the app uses. */
export type ${item.pascal} = {
  id: string;
  title: string;
  createdAt: string;
};

export const ${item.pascal}Schema = ${item.pascal}DtoSchema.transform(
  (dto): ${item.pascal} => ({
    id: dto.id,
    title: dto.title,
    createdAt: dto.created_at,
  }),
);

export const ${item.pascal}ListSchema = z.object({ items: z.array(${item.pascal}Schema) });
`,
  );

  create(
    `${dir}/api.ts`,
    `import { queryOptions } from '@tanstack/react-query';

import { http } from '@/shared/api/http';

import { ${item.pascal}ListSchema } from './schema';

export const ${item.camel}Keys = {
  all: ['${feature.kebab}'] as const,
  list: () => [...${item.camel}Keys.all, 'list'] as const,
};

export const ${feature.camel}QueryOptions = () =>
  queryOptions({
    queryKey: ${item.camel}Keys.list(),
    queryFn: ({ signal }) => http.get('/${feature.kebab}', ${item.pascal}ListSchema, { signal }),
  });
`,
  );

  create(
    `${dir}/screens/${screen}.tsx`,
    `import { FlashList } from '@shopify/flash-list';
import { useQuery } from '@tanstack/react-query';
import { RefreshControl, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { useTranslation } from '@/shared/i18n';
import { useFormat } from '@/shared/lib/format';
import { ListItem } from '@/shared/ui/primitives/ListItem';
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/primitives/States';

import { ${feature.camel}QueryOptions } from '../api';

export function ${screen}() {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  // useFormat, not formatRelative: dates follow a language switch (AGENTS.md › Intl on Hermes).
  const format = useFormat();
  const list = useQuery(${feature.camel}QueryOptions());

  if (list.isPending) return <LoadingState />;
  if (list.isError) {
    return (
      <View style={styles.root}>
        <ErrorState
          error={list.error}
          title={t('${feature.camel}.errorTitle')}
          onRetry={() => list.refetch()}
        />
      </View>
    );
  }

  return (
    <View style={styles.root} testID="${feature.kebab}-screen">
      <FlashList
        data={list.data.items}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <ListItem
            title={item.title}
            subtitle={format.relative(item.createdAt)}
            testID={\`${item.kebab}-\${item.id}\`}
          />
        )}
        refreshControl={
          <RefreshControl
            refreshing={list.isRefetching}
            onRefresh={() => {
              list.refetch();
            }}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
          />
        }
        ListEmptyComponent={
          <EmptyState title={t('${feature.camel}.emptyTitle')} body={t('${feature.camel}.emptyBody')} />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create(theme => ({
  root: { flex: 1, backgroundColor: theme.colors.background },
}));
`,
  );

  create(
    `${dir}/screens/${screen}.test.tsx`,
    `import { screen, userEvent } from '@testing-library/react-native';
import { http as mock, HttpResponse } from 'msw';

import { server } from '@/mocks/node';
import { signInDemoUser } from '@/test/app';
import { renderWithProviders } from '@/test/render';

import { ${screen} } from './${screen}';

describe('${screen}', () => {
  beforeEach(async () => {
    await signInDemoUser();
  });

  it('lists items from the API', async () => {
    await renderWithProviders(<${screen} />);
    expect(await screen.findByTestId('${item.kebab}-${item.kebab}_1')).toBeOnTheScreen();
  });

  it('shows the empty state', async () => {
    server.use(mock.get('*/${feature.kebab}', () => HttpResponse.json({ items: [] })));
    await renderWithProviders(<${screen} />);
    expect(await screen.findByText('Nothing here yet')).toBeOnTheScreen();
  });

  it('shows an error with retry when loading fails', async () => {
    server.use(mock.get('*/${feature.kebab}', () => HttpResponse.json({}, { status: 404 }), { once: true }));
    const user = userEvent.setup();
    await renderWithProviders(<${screen} />);

    expect(await screen.findByText("Couldn't load ${feature.kebab.replace(/-/g, ' ')}")).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByTestId('${item.kebab}-${item.kebab}_1')).toBeOnTheScreen();
  });
});
`,
  );

  create(
    `${dir}/index.ts`,
    `export { ${feature.camel}QueryOptions, ${item.camel}Keys } from './api';
export { type ${item.pascal} } from './schema';
export { ${screen} } from './screens/${screen}';
`,
  );

  // Mock backend: a table that resets with the mock db, and a handler for the list.
  const title = feature.pascal.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
  create(
    `src/mocks/${feature.kebab}.ts`,
    `import { http, HttpResponse } from 'msw';

import { type Db, db } from './db';
import { authenticate, wait } from './helpers';

export type ${item.pascal}Record = { id: string; title: string; created_at: string };

function seed(): ${item.pascal}Record[] {
  const start = Date.parse('2026-10-10T09:00:00Z');
  return Array.from({ length: 5 }, (_, index) => ({
    id: \`${item.kebab}_\${index + 1}\`,
    title: \`${item.pascal.replace(/([a-z0-9])([A-Z])/g, '$1 $2')} \${index + 1}\`,
    created_at: new Date(start - index * 60 * 60_000).toISOString(),
  }));
}

// Keyed by the db instance, so resetDb() (before each test, and on every JS reload) reseeds it.
const tables = new WeakMap<Db, ${item.pascal}Record[]>();
export function ${feature.camel}Table(): ${item.pascal}Record[] {
  let table = tables.get(db.current);
  if (!table) {
    table = seed();
    tables.set(db.current, table);
  }
  return table;
}

export const ${feature.camel}Handlers = [
  http.get('*/${feature.kebab}', async ({ request }) => {
    await wait();
    const user = authenticate(request);
    if (user instanceof Response) return user;
    return HttpResponse.json({ items: ${feature.camel}Table() });
  }),
];
`,
  );
  let handlers = read(HANDLERS);
  handlers = addImport(handlers, [`${feature.camel}Handlers`], `./${feature.kebab}`);
  handlers = insertAbove(handlers, HANDLERS_MARKER, `  ...${feature.camel}Handlers,\n`, HANDLERS);
  write(HANDLERS, handlers);

  addStrings(feature.camel, {
    title,
    emptyTitle: 'Nothing here yet',
    emptyBody: 'New items will show up here.',
    errorTitle: `Couldn't load ${feature.kebab.replace(/-/g, ' ')}`,
  });

  registerScreen({
    route,
    screen,
    feature,
    linking: feature.kebab,
    titleKey: `${feature.camel}.title`,
  });

  return [
    `Open it: navigation.navigate('${route}') or the deep link <scheme>://${feature.kebab}.`,
    `Replace the sample fields (title) in schema.ts and src/mocks/${feature.kebab}.ts with yours.`,
  ];
}

// ------------------------------------------------------------------------------------------- screen

function generateScreen(feature: Names, screenName: Names, param: string | undefined) {
  requireFeature(feature);
  const component = `${screenName.pascal}Screen`;
  const file = `src/features/${feature.kebab}/screens/${component}.tsx`;
  const route = screenName.pascal;
  const titleKey = `${screenName.camel}Title`;
  if (param && !/^[a-z][a-zA-Z0-9]*$/.test(param))
    throw new Error(`--param must be camelCase: ${param}`);
  if (routeExists(route)) throw new Error(`The navigator already has a "${route}" route.`);

  const paramsCode = param
    ? `
// Params can arrive from a deep link, so validate them like any other input.
const ParamsSchema = z.object({ ${param}: z.string().min(1) });

export type ${component}Props = StaticScreenProps<{ ${param}: string }>;
`
    : '';
  create(
    file,
    `${param ? "import { type StaticScreenProps } from '@react-navigation/native';\n" : ''}import { useTranslation } from '@/shared/i18n';
import { Screen } from '@/shared/ui/primitives/Screen';
${param ? "import { ErrorState } from '@/shared/ui/primitives/States';\n" : ''}import { Text } from '@/shared/ui/primitives/Text';
${param ? "import { z } from 'zod';\n" : ''}${paramsCode}
export function ${component}(${param ? `{ route }: ${component}Props` : ''}) {
  const { t } = useTranslation();
${
  param
    ? `  const params = ParamsSchema.safeParse(route.params);
  if (!params.success) return <ErrorState error={params.error} />;
`
    : ''
}
  return (
    <Screen edges={['bottom']} testID="${feature.kebab}-${screenName.kebab}-screen">
      <Text variant="title">{t('${feature.camel}.${titleKey}')}</Text>
    </Screen>
  );
}
`,
  );

  create(
    `src/features/${feature.kebab}/screens/${component}.test.tsx`,
    `import { screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/test/render';

import { ${component} } from './${component}';

describe('${component}', () => {
  it('renders its title', async () => {
    await renderWithProviders(<${component} ${
      param ? `route={{ params: { ${param}: '1' } }} ` : ''
    }/>);
    expect(screen.getByTestId('${feature.kebab}-${screenName.kebab}-screen')).toBeOnTheScreen();
  });
});
`,
  );

  exportFrom(feature, component, `./screens/${component}`);
  addStrings(feature.camel, {
    [titleKey]: screenName.pascal.replace(/([a-z0-9])([A-Z])/g, '$1 $2'),
  });
  registerScreen({
    route,
    screen: component,
    feature,
    linking: `${feature.kebab}/${screenName.kebab}${param ? `/:${param}` : ''}`,
    titleKey: `${feature.camel}.${titleKey}`,
  });

  return [
    `Open it: navigation.navigate('${route}'${param ? `, { ${param}: '…' }` : ''}).`,
    'Translate its strings in the non-English locale files (the generator copied the English text).',
  ];
}

// ----------------------------------------------------------------------------------------- endpoint

function generateEndpoint(feature: Names, endpoint: Names, method: Method, path: string) {
  requireFeature(feature);
  const dir = `src/features/${feature.kebab}`;
  const { params, url } = pathParams(path);
  const schema = `${endpoint.pascal}Schema`;
  const model = endpoint.pascal;
  const args = params.map(param => `${param}: string`).join(', ');

  // Response schema, appended to schema.ts.
  let schemas = existsSync(join(ROOT, `${dir}/schema.ts`))
    ? read(`${dir}/schema.ts`)
    : "import { z } from 'zod';\n";
  if (schemas.includes(`export const ${schema} `)) {
    throw new Error(`${dir}/schema.ts already has ${schema}. Pick another endpoint name.`);
  }
  schemas = addImport(schemas, ['z'], 'zod');
  schemas += `
/** ${method.toUpperCase()} ${path}: what the server sends. Add the fields you need. */
export const ${endpoint.pascal}DtoSchema = z.object({
  id: z.string(),
});

export type ${model} = { id: string };

export const ${schema} = ${endpoint.pascal}DtoSchema.transform((dto): ${model} => ({ id: dto.id }));
`;
  write(`${dir}/schema.ts`, schemas);

  // Query options or a mutation hook, appended to api.ts.
  let api = existsSync(join(ROOT, `${dir}/api.ts`)) ? read(`${dir}/api.ts`) : '';
  api = addImport(api, ['http'], '@/shared/api/http');
  api = addImport(api, [schema], './schema');
  let exported: string;
  if (method === 'get') {
    exported = `${endpoint.camel}QueryOptions`;
    api = addImport(api, ['queryOptions'], '@tanstack/react-query');
    api += `
export const ${exported} = (${args}) =>
  queryOptions({
    queryKey: ['${feature.kebab}', '${endpoint.kebab}'${params.map(param => `, ${param}`).join('')}] as const,
    queryFn: ({ signal }) => http.get(${url}, ${schema}, { signal }),
  });
`;
  } else {
    exported = `use${endpoint.pascal}`;
    const variables = `${endpoint.pascal}Variables`;
    api = addImport(api, ['useMutation', 'useQueryClient'], '@tanstack/react-query');
    const fields = [...params.map(param => `${param}: string`), 'body?: Record<string, unknown>'];
    api += `
export type ${variables} = { ${fields.join('; ')} };

/**
 * ${method.toUpperCase()} ${path}. Fails fast offline (pattern C); pick another offline pattern if it fits
 * better (AGENTS.md › Offline): defineQueuedMutation for A and B, <OnlineOnly> for D.
 */
export function ${exported}() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ ${[...params, 'body'].join(', ')} }: ${variables}) =>
      http.${method}(${url}, ${schema}, { body }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['${feature.kebab}'] }),
  });
}
`;
  }
  write(`${dir}/api.ts`, api);
  exportFrom(feature, exported, './api');

  // Mock handler, in the feature's mock module (created if the feature was written by hand).
  const mockFile = `src/mocks/${feature.kebab}.ts`;
  const mswPath = path.replace(/:([a-zA-Z][a-zA-Z0-9]*)/g, ':$1');
  const handler = `  http.${method}('*${mswPath}', async ({ request${params.length > 0 ? ', params' : ''} }) => {
    await wait();
    const user = authenticate(request);
    if (user instanceof Response) return user;
    return HttpResponse.json({ id: ${params.length > 0 ? `String(params.${params[0]})` : `'${endpoint.kebab}_1'`} });
  }),
`;
  if (existsSync(join(ROOT, mockFile))) {
    const mocks = read(mockFile);
    const end = mocks.lastIndexOf('];');
    if (end === -1) throw new Error(`${mockFile} has no handlers array; add the handler by hand.`);
    write(mockFile, mocks.slice(0, end) + handler + mocks.slice(end));
  } else {
    create(
      mockFile,
      `import { http, HttpResponse } from 'msw';

import { authenticate, wait } from './helpers';

export const ${feature.camel}Handlers = [
${handler}];
`,
    );
    let handlers = read(HANDLERS);
    handlers = addImport(handlers, [`${feature.camel}Handlers`], `./${feature.kebab}`);
    handlers = insertAbove(handlers, HANDLERS_MARKER, `  ...${feature.camel}Handlers,\n`, HANDLERS);
    write(HANDLERS, handlers);
  }

  // Test against the mock handler.
  const sample = params.map(() => "'1'").join(', ');
  const expectedId = params.length > 0 ? "'1'" : `'${endpoint.kebab}_1'`;
  create(
    `${dir}/${endpoint.kebab}.test.ts${method === 'get' ? '' : 'x'}`,
    method === 'get'
      ? `import { queryClient } from '@/data/query-client';
import { signInDemoUser } from '@/test/app';

import { ${exported} } from './api';

describe('${exported}', () => {
  it('fetches and maps the response', async () => {
    await signInDemoUser();
    const result = await queryClient.fetchQuery(${exported}(${sample}));
    expect(result).toEqual({ id: ${expectedId} });
  });
});
`
      : `import { act } from '@testing-library/react-native';

import { signInDemoUser } from '@/test/app';
import { renderHookWithProviders } from '@/test/render';

import { ${exported} } from './api';

describe('${exported}', () => {
  it('sends the request and maps the response', async () => {
    await signInDemoUser();
    const { result } = await renderHookWithProviders(() => ${exported}());
    let response: unknown;
    await act(async () => {
      response = await result.current.mutateAsync({ ${params.map(param => `${param}: '1'`).join(', ')} });
    });
    expect(response).toEqual({ id: ${expectedId} });
  });
});
`,
  );

  return [
    `Use it: ${method === 'get' ? `useQuery(${exported}(…))` : `const mutation = ${exported}()`} in a screen of ${feature.kebab}.`,
    `Fill in the response fields in ${dir}/schema.ts and the mock in ${mockFile}.`,
  ];
}

// --------------------------------------------------------------------------------------------- main

function format() {
  const files = [...touched].map(file => join(ROOT, file));
  const code = files.filter(file => /\.(ts|tsx)$/.test(file));
  if (code.length > 0)
    execFileSync(join(ROOT, 'node_modules/.bin/eslint'), ['--fix', ...code], {
      stdio: 'inherit',
      cwd: ROOT,
    });
  execFileSync(
    join(ROOT, 'node_modules/.bin/prettier'),
    ['--write', '--log-level', 'warn', ...files],
    {
      stdio: 'inherit',
      cwd: ROOT,
    },
  );
}

function main() {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      item: { type: 'string' },
      param: { type: 'string' },
      method: { type: 'string', default: 'get' },
      path: { type: 'string' },
    },
  });
  const [kind, first, second] = positionals;
  let next: string[];
  if (kind === 'feature' && first) {
    next = generateFeature(names(first), names(values.item ?? singular(first)));
  } else if (kind === 'screen' && first && second) {
    next = generateScreen(names(first), names(second), values.param);
  } else if (kind === 'endpoint' && first && second) {
    const method = values.method as Method;
    if (!METHODS.includes(method))
      throw new Error(`--method must be one of ${METHODS.join(', ')}.`);
    next = generateEndpoint(names(first), names(second), method, values.path ?? `/${first}`);
  } else {
    console.log(
      'Usage:\n  pnpm gen feature <name> [--item <name>]\n  pnpm gen screen <feature> <name> [--param <name>]\n' +
        '  pnpm gen endpoint <feature> <name> [--method get|post|put|patch|delete] [--path /x/:id]',
    );
    process.exit(kind ? 1 : 0);
  }
  format();
  console.log('\nChanged:');
  for (const file of [...touched].sort()) console.log(`  ${relative(ROOT, join(ROOT, file))}`);
  console.log('\nNext:');
  for (const line of [...next, 'Run pnpm check.']) console.log(`  - ${line}`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
