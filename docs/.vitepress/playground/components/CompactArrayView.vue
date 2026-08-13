<script setup lang="ts">
/**
 * Ported from AST Explorer (https://github.com/fkling/astexplorer) - MIT,
 * Copyright (c) 2014 Felix Kling.
 */
import { computed } from 'vue';

const props = defineProps<{ length: number }>();

const emit = defineEmits<{ toggle: [MouseEvent] }>();

const summary = computed(() => `${props.length} element${props.length > 1 ? 's' : ''}`);
</script>

<template>
  <span v-if="length === 0" class="p">[ ]</span>
  <span v-else>
    <span class="p">[</span>
    <span class="compact placeholder ge" @click="emit('toggle', $event)">{{ summary }}</span>
    <span class="p">]</span>
  </span>
</template>
