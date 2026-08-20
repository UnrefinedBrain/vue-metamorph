import { defineConfig } from 'vitepress';
import { transformerTwoslash } from '@shikijs/vitepress-twoslash';
import { playgroundPlugin } from './playground/plugin';

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: 'vue-metamorph',
  description: 'Codemod framework for Vue projects',

  base: '/',

  lastUpdated: true,
  cleanUrls: true,

  markdown: {
    codeTransformers: [transformerTwoslash()],
  },

  head: [
    [
      'link',
      {
        rel: 'icon',
        type: 'image/x-icon',
        href: '/favicon.ico',
      },
    ],
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
      { text: 'Playground', link: '/playground' },
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
            text: 'Installation and scaffolding',
            link: '/guide/installation',
          },
          {
            text: 'Command-line interface',
            link: '/guide/cli',
          },
          {
            text: 'API',
            link: '/api/vue-metamorph',
          },
          {
            text: 'Playground',
            link: '/playground',
          },
          {
            text: 'Ecosystem',
            link: '/guide/ecosystem',
          },
        ],
      },
      {
        text: 'Writing plugins',
        items: [
          {
            text: 'Codemods',
            link: '/guide/writing-codemods',
          },
          {
            text: 'Helpers and builders',
            link: '/guide/helpers-and-builders',
          },
          {
            text: 'SFC AST reference',
            link: '/guide/sfc-ast-reference',
          },
          {
            text: 'Manual migrations',
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

  vite: {
    plugins: [playgroundPlugin()],

    server: {
      allowedHosts: true,
    },
  },
});
