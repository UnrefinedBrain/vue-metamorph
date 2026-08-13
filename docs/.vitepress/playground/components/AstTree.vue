<script setup lang="ts">
/**
 * Ported from AST Explorer (https://github.com/fkling/astexplorer),
 * website/src/components/visualization/Tree.js - MIT, Copyright (c) 2014
 * Felix Kling.
 */
import { computed, markRaw, nextTick, watch } from 'vue';
import { TreeAdapter, type TreeAdapterOptions } from '../core/tree-adapter';
import { useTreeSettings } from '../core/settings';
import { usePlaygroundContext } from '../core/context';
import TreeElement from './TreeElement.vue';

const props = defineProps<{
  ast: unknown;
  options: TreeAdapterOptions;
  position: number | null;
}>();

const settings = useTreeSettings();
const context = usePlaygroundContext();

const adapter = computed(() => markRaw(new TreeAdapter(props.options, settings)));
const filters = computed(() => adapter.value.getConfigurableFilters());

// The cursor can match several nodes at once; scroll to whichever is nearest
// the middle of the view rather than jumping to the first one.
watch(
  () => [props.position, props.ast, settings.autofocus],
  async () => {
    if (!settings.autofocus) {
      return;
    }
    await nextTick();
    context.scrollToFocused();
  },
);
</script>

<template>
  <div class="ast-tree">
    <div class="ast-tree-toolbar">
      <label title="Open and scroll to the node under the cursor">
        <input v-model="settings.autofocus" type="checkbox" />
        Autofocus
      </label>
      <label v-for="filter in filters" :key="filter.key">
        <input v-model="settings[filter.key]" type="checkbox" />
        {{ filter.label }}
      </label>
    </div>

    <ul class="ast-tree-root" @mouseleave="context.setHighlight(null)">
      <TreeElement
        :value="ast"
        :adapter="adapter"
        :level="0"
        :position="position"
        :autofocus="settings.autofocus"
      />
    </ul>
  </div>
</template>
