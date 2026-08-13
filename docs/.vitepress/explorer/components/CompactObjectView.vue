<script setup lang="ts">
/**
 * Ported from AST Explorer (https://github.com/fkling/astexplorer) - MIT,
 * Copyright (c) 2014 Felix Kling.
 */
import { computed } from 'vue';

const props = defineProps<{ keys: string[] }>();

const emit = defineEmits<{ toggle: [MouseEvent] }>();

const summary = computed(() => {
  const { keys } = props;
  const shown = keys.length > 5 ? [...keys.slice(0, 5), `... +${keys.length - 5}`] : keys;
  return shown.join(', ');
});
</script>

<template>
  <span v-if="keys.length === 0" class="p">{ }</span>
  <span v-else>
    <span class="p">{</span>
    <span class="compact placeholder ge" @click="emit('toggle', $event)">{{ summary }}</span>
    <span class="p">}</span>
  </span>
</template>
