import { defineConfig } from 'vitepress';
import { transformerTwoslash } from 'vitepress-plugin-twoslash';

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: 'vue-metamorph',
  description: 'Codemod framework for Vue projects',

  base: '/vue-metamorph/',

  lastUpdated: true,
  cleanUrls: true,

  markdown: {

    codeTransformers: [
      transformerTwoslash(),
    ],
  },

  head: [
    ['link', {
      rel: 'icon',
      type: 'image/x-icon',
      href: '/vue-metamorph/favicon.ico',
    }],
  ],

  themeConfig: {
    logo: '/logo-large.png',

    search: {
      provider: 'local',
    },

    editLink: {
      pattern: 'https://github.com/UnrefinedBrain/vue-metamorph/edit/master/docs/:path',
      text: 'Edit this page on GitHub',
    },

    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Documentation', link: '/guide/installation' },
    ],

    sidebar: [
      {
        text: 'Guide',
        items: [
          {
            text: 'What is vue-metamorph?',
            link: '/guide/what-is-vue-metamorph',
          },
          {
            text: 'Installation / Scaffolding',
            link: '/guide/installation',
          },
          {
            text: 'Command-line Interface',
            link: '/guide/cli',
          },
          {
            text: 'API',
            link: '/api/vue-metamorph',
          },
        ],
      },
      {
        text: 'Writing Plugins',
        items: [
          {
            text: 'Codemods',
            link: '/guide/writing-codemods',
          },
          {
            text: 'Manual Migrations',
            link: '/guide/manual-migrations',
          },
        ],
      },
    ],

    socialLinks: [
      { icon: 'npm', link: 'https://npmjs.com/package/vue-metamorph' },
      { icon: 'github', link: 'https://github.com/UnrefinedBrain/vue-metamorph' },
    ],
  },
});
