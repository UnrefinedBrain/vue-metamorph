<script setup lang="ts">
/**
 * CodeMirror 6 editor: reports where the cursor is so the tree can follow it,
 * and paints the range of whichever node the pointer is over.
 */
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { Compartment, EditorState, StateEffect, StateField } from '@codemirror/state';
import { Decoration, type DecorationSet, EditorView, keymap, lineNumbers } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { bracketMatching, indentOnInput, syntaxHighlighting } from '@codemirror/language';
import { classHighlighter } from '@lezer/highlight';
import { css } from '@codemirror/lang-css';
import { javascript } from '@codemirror/lang-javascript';
import { vue } from '@codemirror/lang-vue';
import type { EditorLanguage } from '../core/source-types';
import type { Range } from '../core/tree-adapter';

const props = defineProps<{
  modelValue: string;
  language: EditorLanguage;
  /** Range to paint, in source offsets. */
  highlight: Range | null;
}>();

const emit = defineEmits<{
  'update:modelValue': [string];
  cursor: [number | null];
}>();

const host = ref<HTMLElement | null>(null);
const language = new Compartment();

let view: EditorView | null = null;

const setHighlight = StateEffect.define<Range | null>();

const highlightMark = Decoration.mark({ class: 'cm-node-highlight' });

const highlightField = StateField.define<DecorationSet>({
  create: () => Decoration.none,

  update(decorations, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(setHighlight)) {
        const range = effect.value;
        const length = transaction.state.doc.length;

        if (!range || range[0] >= range[1]) {
          return Decoration.none;
        }

        return Decoration.set([
          highlightMark.range(Math.min(range[0], length), Math.min(range[1], length)),
        ]);
      }
    }

    return transaction.docChanged ? Decoration.none : decorations;
  },

  provide: (field) => EditorView.decorations.from(field),
});

function languageExtension(name: EditorLanguage) {
  switch (name) {
    case 'vue':
      return vue();
    case 'css':
      return css();
    case 'typescript':
      return javascript({ typescript: true, jsx: true });
    case 'javascript':
      return javascript({ jsx: true });
  }
}

onMounted(() => {
  view = new EditorView({
    parent: host.value!,
    state: EditorState.create({
      doc: props.modelValue,
      extensions: [
        lineNumbers(),
        history(),
        indentOnInput(),
        bracketMatching(),
        syntaxHighlighting(classHighlighter),
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        EditorView.lineWrapping,
        highlightField,
        language.of(languageExtension(props.language)),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            emit('update:modelValue', update.state.doc.toString());
          }

          // The position outlives the focus: clicking into the tree should not
          // close everything the cursor just opened.
          if (update.selectionSet) {
            emit('cursor', update.state.selection.main.head);
          }
        }),
      ],
    }),
  });
});

onBeforeUnmount(() => {
  view?.destroy();
  view = null;
});

watch(
  () => props.modelValue,
  (value) => {
    if (view && value !== view.state.doc.toString()) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } });
    }
  },
);

watch(
  () => props.language,
  (value) => {
    view?.dispatch({ effects: language.reconfigure(languageExtension(value)) });
  },
);

watch(
  () => props.highlight,
  (value) => {
    view?.dispatch({ effects: setHighlight.of(value) });
  },
);
</script>

<template>
  <div ref="host" class="source-editor" />
</template>
