// Website and docs for Bareship. Astro Starlight. Pages come from the repo's docs/ and from content/
// (scripts/sync-docs.mjs writes them into src/content/docs/), so the docs are written once.
import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';

export default defineConfig({
  // Canonical URLs and the sitemap (ADR 0016).
  site: 'https://bareship.praveensingh.co.in',
  // The repo's root tsconfig.json extends a React Native package the website doesn't install, so on Vercel
  // any build step that reads it fails. Vite is pointed at the website's own tsconfig for compiling .ts files
  // and .astro frontmatter, and tsconfig paths stay off (the site has no aliases).
  vite: { tsconfig: './tsconfig.json', resolve: { tsconfigPaths: false } },
  integrations: [
    starlight({
      title: 'Bareship',
      logo: {
        light: './src/assets/logo-light.svg',
        dark: './src/assets/logo-dark.svg',
        alt: 'Bareship logo',
      },
      favicon: '/favicon.svg',
      customCss: ['./src/styles/theme.css'],
      components: {
        Footer: './src/components/Footer.astro',
        Head: './src/components/Head.astro',
        Hero: './src/components/Hero.astro',
      },
      // Share-preview tags per page (src/routeData.ts), and the AI-tools index (src/pages/llms.txt.ts).
      routeMiddleware: './src/routeData.ts',
      head: [
        { tag: 'meta', attrs: { name: 'author', content: 'Praveen Singh' } },
        { tag: 'link', attrs: { rel: 'author', href: 'https://www.praveensingh.co.in/' } },
        {
          tag: 'link',
          attrs: { rel: 'alternate', type: 'text/markdown', href: '/llms.txt', title: 'llms.txt' },
        },
      ],
      description:
        'Bareship is a production-ready, offline-first bare React Native template for teams and AI agents.',
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/psingh2907/bareship' },
        { icon: 'npm', label: 'npm', href: 'https://www.npmjs.com/package/create-bareship' },
      ],
      sidebar: [
        {
          label: 'Start here',
          items: [
            'start-here/introduction',
            'start-here/how-to-choose',
            'start-here/quick-start',
            'start-here/environments',
            'start-here/faq',
          ],
        },
        {
          label: 'Build your app',
          items: [
            'build/architecture',
            'build/offline',
            'build/languages',
            'build/social-sign-in',
            'build/app-icon-and-splash',
            'build/generators',
            'build/ai-agents',
            'build/styling',
            'build/testing',
            'build/project-rules',
          ],
        },
        {
          label: 'Production',
          items: [
            'production/going-live',
            'production/releasing',
            'production/demo-build',
            'production/native-changes',
          ],
        },
        {
          label: 'Reference',
          items: [
            {
              label: 'Decisions',
              collapsed: true,
              items: [{ autogenerate: { directory: 'reference/decisions' } }],
            },
            'reference/version-matrix',
            'reference/best-practices-audit',
            'reference/contributing',
            'reference/changelog',
          ],
        },
      ],
    }),
  ],
});
