import DefaultTheme from 'vitepress/theme';
import type { Theme } from 'vitepress';

import TwoslashFloatingVue from 'vitepress-plugin-twoslash/client';
import 'vitepress-plugin-twoslash/style.css';
import './custom.css';

export default {
  extends: DefaultTheme,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  enhanceApp({ app }: any) {
    app.use(TwoslashFloatingVue);
  },
} satisfies Theme;
