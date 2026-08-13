/**
 * Ported from AST Explorer (https://github.com/fkling/astexplorer),
 * website/src/components/visualization/tree/Element.js - MIT, Copyright (c)
 * 2014 Felix Kling.
 *
 * A node opens for three different reasons - the user clicked it, an ancestor
 * was deep-opened, or the cursor moved into its range - and it has to close
 * again for only some of them. The state machine keeps those apart, so a node
 * the user opened by hand does not snap shut when the cursor wanders off.
 */

import { type Ref, ref, watch } from 'vue';

export const OPEN_STATES = {
  DEFAULT: 0,
  OPEN: 1,
  DEEP_OPEN: 2,
  FOCUS_OPEN: 3,
  CLOSED: 4,
} as const;

export type OpenState = (typeof OPEN_STATES)[keyof typeof OPEN_STATES];

const EVENTS = {
  GAIN_FOCUS: 'gain-focus',
  LOSE_FOCUS: 'lose-focus',
  DEEP_OPEN: 'deep-open',
} as const;

type Event = (typeof EVENTS)[keyof typeof EVENTS];

function transition(currentState: OpenState, event: Event): OpenState {
  switch (currentState) {
    case OPEN_STATES.DEFAULT:
    case OPEN_STATES.CLOSED:
      switch (event) {
        case EVENTS.DEEP_OPEN:
          return OPEN_STATES.DEEP_OPEN;
        case EVENTS.GAIN_FOCUS:
          return OPEN_STATES.FOCUS_OPEN;
        case EVENTS.LOSE_FOCUS:
          return OPEN_STATES.DEFAULT;
      }
      break;

    case OPEN_STATES.OPEN:
      return event === EVENTS.DEEP_OPEN ? OPEN_STATES.DEEP_OPEN : currentState;

    case OPEN_STATES.DEEP_OPEN:
      return OPEN_STATES.DEEP_OPEN;

    case OPEN_STATES.FOCUS_OPEN:
      switch (event) {
        case EVENTS.GAIN_FOCUS:
          return OPEN_STATES.FOCUS_OPEN;
        case EVENTS.LOSE_FOCUS:
          return OPEN_STATES.DEFAULT;
        case EVENTS.DEEP_OPEN:
          return OPEN_STATES.DEEP_OPEN;
      }
      break;
  }

  return currentState;
}

export function useOpenState(openFromParent: Ref<boolean>, focused: Ref<boolean>) {
  const ownState = ref<OpenState>(OPEN_STATES.DEFAULT);
  const openState = ref<OpenState>(OPEN_STATES.DEFAULT);

  watch(ownState, (state) => {
    openState.value = state;
  });

  watch(focused, (isFocused, wasFocused) => {
    openState.value = transition(
      openState.value,
      isFocused && !wasFocused ? EVENTS.GAIN_FOCUS : EVENTS.LOSE_FOCUS,
    );

    // A node the user closed by hand stays closed until the cursor leaves it,
    // at which point it goes back to following the defaults.
    if (!isFocused && wasFocused && ownState.value === OPEN_STATES.CLOSED) {
      ownState.value = OPEN_STATES.DEFAULT;
    }
  });

  watch(openFromParent, (isOpen, wasOpen) => {
    if (isOpen && !wasOpen) {
      openState.value = transition(openState.value, EVENTS.DEEP_OPEN);
    }
  });

  const setOpenState = (state: OpenState) => {
    // Re-assigning the same value has to re-trigger, e.g. two deep-opens in a
    // row on the same node.
    if (ownState.value === state) {
      openState.value = state;
    } else {
      ownState.value = state;
    }
  };

  return { openState, setOpenState };
}
