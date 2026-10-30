// Structured data (schema.org JSON-LD) for search engines and AI answer engines. The @ids match the
// maintainer's portfolio (www.praveensingh.co.in), so both sites describe the same person and project.

export const site = 'https://bareship.praveensingh.co.in';

export const ids = {
  website: `${site}/#website`,
  software: `${site}/#software`,
  person: 'https://www.praveensingh.co.in/#person',
};

const description =
  'Bareship is a production-ready, offline-first bare React Native template for teams and AI agents.';

export const author = {
  '@type': 'Person',
  '@id': ids.person,
  name: 'Praveen Singh',
  url: 'https://www.praveensingh.co.in/',
  jobTitle: 'Senior React Native Engineer',
  sameAs: ['https://www.linkedin.com/in/praveens2/', 'https://github.com/psingh2907'],
};

export const website = {
  '@type': 'WebSite',
  '@id': ids.website,
  url: `${site}/`,
  name: 'Bareship',
  description,
  inLanguage: 'en',
  publisher: { '@id': ids.person },
};

export const software = {
  '@type': 'SoftwareSourceCode',
  '@id': ids.software,
  name: 'Bareship',
  description,
  url: `${site}/`,
  codeRepository: 'https://github.com/psingh2907/bareship',
  sameAs: [
    'https://www.npmjs.com/package/create-bareship',
    'https://www.npmjs.com/package/bareship',
    'https://reactnative.directory/package/create-bareship',
    'https://github.com/psingh2907/bareship',
  ],
  programmingLanguage: 'TypeScript',
  runtimePlatform: 'React Native',
  license: 'https://spdx.org/licenses/MIT.html',
  author,
  keywords:
    'React Native template, bare React Native, offline-first, TypeScript, AI coding agents, fastlane',
};

// Markdown to plain text, for answers quoted out of context.
const plain = (md: string) =>
  md
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    // Backticks and asterisks only: underscores belong to names like API_URL.
    .replace(/[`*]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** "### Question" headings and the paragraphs under them, or `<details>` blocks whose `<summary>` is the
 * question, as FAQPage questions. */
export function faqPage(body: string) {
  const details = [...body.matchAll(/<summary>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/g)];
  if (details.length)
    return faqNode(details.map(([, name, text]) => ({ name: plain(name), text: plain(text) })));
  const questions: { name: string; text: string }[] = [];
  let current: { name: string; lines: string[] } | undefined;
  const flush = () => {
    if (current?.lines.join('').trim())
      questions.push({ name: current.name, text: plain(current.lines.join('\n')) });
  };
  for (const line of body.split('\n')) {
    if (line.startsWith('#')) {
      flush();
      current = line.startsWith('### ') ? { name: plain(line.slice(4)), lines: [] } : undefined;
    } else current?.lines.push(line);
  }
  flush();
  return faqNode(questions);
}

const faqNode = (questions: { name: string; text: string }[]) => ({
  '@type': 'FAQPage',
  mainEntity: questions.map(q => ({
    '@type': 'Question',
    name: q.name,
    acceptedAnswer: { '@type': 'Answer', text: q.text },
  })),
});

/** One @graph document; escaping "<" keeps a stray "</script>" from closing the tag. */
export const graph = (...nodes: object[]) =>
  JSON.stringify({ '@context': 'https://schema.org', '@graph': nodes }).replace(/</g, '\\u003c');
