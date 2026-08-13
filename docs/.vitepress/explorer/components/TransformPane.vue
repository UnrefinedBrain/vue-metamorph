<script setup lang="ts">
/**
 * Runs a codemod plugin written in the editor against the source, and shows
 * what `transform()` printed.
 */
import { computed } from 'vue';
import type { TransformOutcome } from '../core/run-transform';

const props = defineProps<{ outcome: TransformOutcome | null }>();

const stats = computed(() => props.outcome?.stats ?? []);
</script>

<template>
  <div class="transform-output">
    <div v-if="!outcome" class="transform-placeholder">
      Write a codemod on the left to see its output here.
    </div>

    <template v-else-if="outcome.error">
      <p class="explorer-error">{{ outcome.error }}</p>
    </template>

    <template v-else>
      <div class="transform-stats">
        <span v-for="[name, count] in stats" :key="name" class="transform-stat">
          {{ name }}: {{ count }} transform{{ count === 1 ? '' : 's' }}
        </span>
      </div>
      <pre class="transform-code"><code>{{ outcome.code }}</code></pre>
    </template>
  </div>
</template>
