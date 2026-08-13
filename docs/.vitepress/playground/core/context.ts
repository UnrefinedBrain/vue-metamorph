import { type InjectionKey, type ShallowRef, inject } from 'vue';
import type { Range } from './tree-adapter';

/**
 * Shared by the tree and the editor. AST Explorer wires these up with a pubsub
 * module and a React context; provide/inject covers both and keeps a page with
 * two playgrounds on it from crossing wires.
 */
export type PlaygroundContext = {
  /** Highlights a source range while the pointer is over a node. */
  setHighlight(range: Range | null): void;
  /** The node the user last clicked, also published as `$node`. */
  selectedNode: ShallowRef<unknown>;
  selectNode(node: unknown): void;
  /** Tracks the elements matching the cursor so the tree can scroll to one. */
  trackFocused(element: HTMLElement, focused: boolean): void;
  /** Brings the tracked element nearest the middle of the view into sight. */
  scrollToFocused(): void;
};

export const PLAYGROUND_CONTEXT: InjectionKey<PlaygroundContext> = Symbol(
  'vue-metamorph-playground',
);

export function usePlaygroundContext(): PlaygroundContext {
  const context = inject(PLAYGROUND_CONTEXT);

  if (!context) {
    throw new Error('usePlaygroundContext must be used inside the playground');
  }

  return context;
}
