<script setup lang="ts">
/**
 * Ported from AST Explorer (https://github.com/fkling/astexplorer),
 * website/src/components/visualization/tree/Element.js - MIT, Copyright (c)
 * 2014 Felix Kling.
 *
 * One node of the AST, rendered as one `<li>`. Objects and arrays recurse;
 * everything else prints as a value.
 */
import { computed, onBeforeUnmount, ref, toRef, watch } from 'vue';
import type { TreeAdapter, TreeProperty } from '../core/tree-adapter';
import { OPEN_STATES, type OpenState, useOpenState } from '../core/use-open-state';
import { stringify } from '../core/stringify';
import { useExplorerContext } from '../core/context';
import CompactArrayView from './CompactArrayView.vue';
import CompactObjectView from './CompactObjectView.vue';

const props = withDefaults(
  defineProps<{
    value: unknown;
    adapter: TreeAdapter;
    level: number;
    position: number | null;
    autofocus: boolean;
    name?: string;
    /** The property is computed rather than a plain key. */
    computedKey?: boolean;
    /** An ancestor was deep-opened (shift-click). */
    deepOpen?: boolean;
  }>(),
  { name: undefined, computedKey: false, deepOpen: false },
);

const emit = defineEmits<{ open: [state: OpenState] }>();

const context = useExplorerContext();
const element = ref<HTMLElement | null>(null);

const isInRange = computed(() => props.adapter.isInRange(props.value, props.name, props.position));
const hasChildrenInRange = computed(() =>
  props.adapter.hasChildrenInRange(props.value, props.name, props.position),
);

const { openState, setOpenState } = useOpenState(
  toRef(props, 'deepOpen'),
  computed(() => props.autofocus && (isInRange.value || hasChildrenInRange.value)),
);

const opensByDefault = computed(
  () => props.adapter.opensByDefault(props.value, props.name) || props.level === 0,
);

const isOpen = computed(() =>
  openState.value === OPEN_STATES.DEFAULT
    ? opensByDefault.value
    : openState.value !== OPEN_STATES.CLOSED,
);

/** The deepest match under the cursor is the one worth scrolling to. */
const isFocusTarget = computed(
  () => props.autofocus && isInRange.value && !hasChildrenInRange.value,
);

watch([isFocusTarget, element], ([focused, node]) => {
  if (node) {
    context.trackFocused(node, focused);
  }
});

onBeforeUnmount(() => {
  if (element.value) {
    context.trackFocused(element.value, false);
  }
});

const isObjectLike = computed(() => !!props.value && typeof props.value === 'object');

const isArrayLike = computed(
  () => isObjectLike.value && typeof (props.value as { length?: unknown }).length === 'number',
);

const arrayLength = computed(() =>
  isArrayLike.value ? (props.value as { length: number }).length : 0,
);

const properties = computed<TreeProperty[]>(() =>
  isObjectLike.value ? Array.from(props.adapter.walkNode(props.value)) : [],
);

/** Array indices render without a key, named properties render with one. */
const children = computed(() =>
  isArrayLike.value
    ? properties.value
        .filter((property) => property.key !== 'length')
        .map((property) => ({
          ...property,
          name: Number.isInteger(Number(property.key)) ? undefined : property.key,
        }))
    : properties.value.map((property) => ({ ...property, name: property.key })),
);

const nodeName = computed(() =>
  isObjectLike.value && !isArrayLike.value ? props.adapter.getNodeName(props.value) : undefined,
);

const showToggler = computed(() => {
  if (!isObjectLike.value) {
    return false;
  }
  return isArrayLike.value ? arrayLength.value > 0 : children.value.length > 0;
});

const isCollapsedArray = computed(
  () => isArrayLike.value && !(arrayLength.value > 0 && isOpen.value),
);
const isCollapsedObject = computed(() => isObjectLike.value && !isArrayLike.value && !isOpen.value);
const showChildren = computed(() => isObjectLike.value && isOpen.value && !isCollapsedArray.value);

const brackets = computed(() => (isArrayLike.value ? ['[', ']'] : ['{', '}']));

const selected = computed(() => context.selectedNode.value === props.value);

const highlighted = computed(() => {
  if (isInRange.value) {
    return !hasChildrenInRange.value || !isOpen.value;
  }
  return hasChildrenInRange.value && !isOpen.value;
});

const range = computed(() => props.adapter.getRange(props.value));

function onToggle(event: MouseEvent) {
  if (!isObjectLike.value) {
    return;
  }

  const next = event.shiftKey
    ? OPEN_STATES.DEEP_OPEN
    : isOpen.value
      ? OPEN_STATES.CLOSED
      : OPEN_STATES.OPEN;

  setOpenState(next);
  context.selectNode(next === OPEN_STATES.CLOSED ? null : props.value);
  emit('open', next);
}

/** A child opening drags its ancestors open with it. */
function onChildOpen() {
  setOpenState(OPEN_STATES.OPEN);
  emit('open', OPEN_STATES.OPEN);
}

function onPointerEnter(event: MouseEvent) {
  if (range.value && props.level !== 0) {
    event.stopPropagation();
    context.setHighlight(range.value);
  }
}

function onPointerLeave(event: MouseEvent) {
  if (range.value && props.level !== 0) {
    event.stopPropagation();
    context.setHighlight(null);
  }
}
</script>

<template>
  <li
    ref="element"
    class="entry"
    :class="{ highlighted, toggable: showToggler, open: isOpen }"
    @mouseover="onPointerEnter"
    @mouseleave="onPointerLeave"
  >
    <span v-if="name" class="key">
      <span class="name nb" @click="onToggle">
        <span v-if="computedKey" title="computed">*{{ name }}</span>
        <template v-else>{{ name }}</template>
      </span>
      <span class="p">:&nbsp;</span>
    </span>

    <span class="value">
      <template v-if="isObjectLike">
        <span v-if="nodeName" class="tokenName nc" @click="onToggle">
          {{ nodeName }}
          <span v-if="selected" class="ge selected-node">= $node</span>
        </span>
        <CompactArrayView v-if="isCollapsedArray" :length="arrayLength" @toggle="onToggle" />
        <CompactObjectView
          v-else-if="isCollapsedObject"
          :keys="children.map((child) => child.key)"
          @toggle="onToggle"
        />
      </template>
      <span v-else class="s">{{ stringify(value) }}</span>
    </span>

    <template v-if="showChildren">
      <span class="prefix p">&nbsp;{{ brackets[0] }}</span>
      <ul class="value-body">
        <TreeElement
          v-for="(child, index) in children"
          :key="`${child.key}-${index}`"
          :name="child.name"
          :value="child.value"
          :computed-key="child.computed"
          :adapter="adapter"
          :level="level + 1"
          :position="position"
          :autofocus="autofocus"
          :deep-open="openState === OPEN_STATES.DEEP_OPEN"
          @open="onChildOpen"
        />
      </ul>
      <div class="suffix p">{{ brackets[1] }}</div>
    </template>
  </li>
</template>
