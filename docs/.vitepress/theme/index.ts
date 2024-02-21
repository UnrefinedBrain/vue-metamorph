import DefaultTheme from 'vitepress/theme';
import type { Theme } from 'vitepress';

import TwoslashFloatingVue from '@shikijs/vitepress-twoslash/client';
import '@shikijs/vitepress-twoslash/style.css';
import './custom.css';

export default {
  extends: DefaultTheme,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  enhanceApp({ app }: any) {
    app.use(TwoslashFloatingVue);
  },
} satisfies Theme;
