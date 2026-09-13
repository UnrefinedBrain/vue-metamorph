import DefaultTheme from 'vitepress/theme';
import type { EnhanceAppContext, Theme } from 'vitepress';

import TwoslashFloatingVue from '@shikijs/vitepress-twoslash/client';
import '@shikijs/vitepress-twoslash/style.css';
import Playground from './Playground.vue';
import './custom.css';

export default {
  extends: DefaultTheme,
  enhanceApp({ app }: EnhanceAppContext) {
    app.use(TwoslashFloatingVue);
    app.component('Playground', Playground);
  },
} satisfies Theme;
