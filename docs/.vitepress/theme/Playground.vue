<script setup lang="ts">
/**
 * Loads the playground in the browser only. It carries the parsers with it, so
 * it is fetched on demand rather than with the rest of the docs, and it is
 * never rendered during the static build.
 */
import { defineAsyncComponent, h } from 'vue';

const PlaygroundApp = defineAsyncComponent({
  loader: () => import('virtual:vue-metamorph-playground'),
  loadingComponent: () => h('div', { class: 'playground-loading' }, 'Loading parsers…'),
  errorComponent: () => h('div', { class: 'playground-loading' }, 'The playground failed to load.'),
  delay: 0,
});
</script>

<template>
  <ClientOnly>
    <PlaygroundApp />
  </ClientOnly>
</template>

<style>
.playground-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: calc(100vh - var(--vp-nav-height));
  color: var(--vp-c-text-2);
}
</style>
