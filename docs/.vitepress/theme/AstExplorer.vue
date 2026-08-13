<script setup lang="ts">
/**
 * Loads the explorer in the browser only. It carries the parsers with it, so
 * it is fetched on demand rather than with the rest of the docs, and it is
 * never rendered during the static build.
 */
import { defineAsyncComponent, h } from 'vue';

const Explorer = defineAsyncComponent({
  loader: () => import('virtual:vue-metamorph-explorer'),
  loadingComponent: () => h('div', { class: 'ast-explorer-loading' }, 'Loading parsers…'),
  errorComponent: () =>
    h('div', { class: 'ast-explorer-loading' }, 'The AST explorer failed to load.'),
  delay: 0,
});
</script>

<template>
  <ClientOnly>
    <Explorer />
  </ClientOnly>
</template>

<style>
.ast-explorer-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: calc(100vh - var(--vp-nav-height));
  color: var(--vp-c-text-2);
}
</style>
