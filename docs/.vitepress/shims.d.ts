declare module '*.vue' {
  import type { DefineComponent } from 'vue';

  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>;
  export default component;
}

declare module '*.css';

declare module 'virtual:vue-metamorph-types' {
  /** Declaration files keyed by their path in the in-browser file system. */
  export const TYPE_FILES: Record<string, string> | null;
}

declare module 'virtual:vue-metamorph-explorer' {
  import type { DefineComponent } from 'vue';

  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>;
  export default component;
}
