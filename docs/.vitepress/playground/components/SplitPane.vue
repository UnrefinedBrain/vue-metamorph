<script setup lang="ts">
/** Two panes and a divider the user can drag. */
import { ref } from 'vue';

const props = withDefaults(
  defineProps<{
    direction: 'horizontal' | 'vertical';
    modelValue: number;
    min?: number;
    max?: number;
    /** Hides the second pane and gives all the room to the first. */
    collapsed?: boolean;
  }>(),
  { min: 15, max: 85, collapsed: false },
);

const emit = defineEmits<{ 'update:modelValue': [number] }>();

const container = ref<HTMLElement | null>(null);
const dragging = ref(false);

function onPointerMove(event: PointerEvent) {
  const bounds = container.value?.getBoundingClientRect();
  if (!bounds) {
    return;
  }

  const ratio =
    props.direction === 'horizontal'
      ? (event.clientX - bounds.left) / bounds.width
      : (event.clientY - bounds.top) / bounds.height;

  emit('update:modelValue', Math.min(Math.max(ratio * 100, props.min), props.max));
}

function onPointerUp(event: PointerEvent) {
  dragging.value = false;
  (event.target as HTMLElement).releasePointerCapture(event.pointerId);
  window.removeEventListener('pointermove', onPointerMove);
  window.removeEventListener('pointerup', onPointerUp);
}

function onPointerDown(event: PointerEvent) {
  dragging.value = true;
  (event.target as HTMLElement).setPointerCapture(event.pointerId);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
}
</script>

<template>
  <div ref="container" class="split-pane" :class="[direction, { dragging }]">
    <div class="split-pane-section" :style="{ flexBasis: collapsed ? '100%' : `${modelValue}%` }">
      <slot name="a" />
    </div>

    <template v-if="!collapsed">
      <div
        class="split-pane-divider"
        role="separator"
        :aria-orientation="direction === 'horizontal' ? 'vertical' : 'horizontal'"
        @pointerdown="onPointerDown"
      />

      <div class="split-pane-section" :style="{ flexBasis: `${100 - modelValue}%` }">
        <slot name="b" />
      </div>
    </template>
  </div>
</template>
