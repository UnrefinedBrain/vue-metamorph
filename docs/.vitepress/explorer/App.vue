<script setup lang="ts">
/**
 * An AST explorer for vue-metamorph, in the shape of AST Explorer
 * (https://github.com/fkling/astexplorer) by Felix Kling - MIT - with the
 * parser list narrowed to what vue-metamorph runs and the transform pane
 * wired to `transform()`.
 *
 * The parsers are imported from this repository's `src/`, so what the tree
 * shows is what a codemod plugin is handed.
 */
import { computed, onBeforeUnmount, onMounted, provide, ref, shallowRef, watch } from 'vue';
import { EXPLORER_CONTEXT, type ExplorerContext } from './core/context';
import { type ParseResult, parseSource } from './core/parse';
import { type TransformOutcome, runTransform } from './core/run-transform';
import { SOURCE_TYPES, type SourceType, findSourceType } from './core/source-types';
import { SAMPLE_CODEMOD, sampleFor } from './core/samples';
import { buildShareUrl, readSharedState } from './core/share';
import type { CodemodLanguageService } from './core/language-service';
import type { Range } from './core/tree-adapter';
import AstTree from './components/AstTree.vue';
import SourceEditor from './components/SourceEditor.vue';
import SplitPane from './components/SplitPane.vue';
import TransformPane from './components/TransformPane.vue';
import './explorer.css';

const PARSE_DELAY_MS = 150;
const STORAGE_PREFIX = 'vue-metamorph:explorer:';

const storage = {
  read(key: string): string | null {
    try {
      return localStorage.getItem(STORAGE_PREFIX + key);
    } catch {
      return null;
    }
  },
  write(key: string, value: string) {
    try {
      localStorage.setItem(STORAGE_PREFIX + key, value);
    } catch {
      // private mode, quota, blocked storage: the explorer still works
    }
  },
};

const shared = readSharedState();

const sourceType = ref<SourceType>(
  findSourceType(shared?.type ?? storage.read('source-type') ?? undefined),
);
const code = ref(
  shared?.code ?? storage.read(`code:${sourceType.value.id}`) ?? sampleFor(sourceType.value.id),
);
const codemodSource = ref(shared?.codemod || storage.read('codemod') || SAMPLE_CODEMOD);
const showTransform = ref(storage.read('show-transform') === 'true');

const cursor = ref<number | null>(null);
const highlight = shallowRef<Range | null>(null);
const selectedNode = shallowRef<unknown>(null);

// TypeScript and vue-metamorph's declarations are a few megabytes between
// them, so they are fetched the first time the codemod pane is opened rather
// than with the rest of the page.
const languageService = shallowRef<CodemodLanguageService | null>(null);
const languageServiceState = ref<'idle' | 'loading' | 'ready' | 'unavailable'>('idle');

async function ensureLanguageService() {
  if (languageServiceState.value !== 'idle') {
    return;
  }

  languageServiceState.value = 'loading';

  const { loadCodemodLanguageService } = await import('./core/language-service');
  const service = await loadCodemodLanguageService();

  languageService.value = service;
  languageServiceState.value = service ? 'ready' : 'unavailable';
}

const parseResult = shallowRef<ParseResult>(parseSource(code.value, sourceType.value));
const transformOutcome = shallowRef<TransformOutcome | null>(null);
const activePanelId = ref<string | null>(null);

const mainSplit = ref(Number(storage.read('split:main') ?? 45));
const leftSplit = ref(Number(storage.read('split:left') ?? 55));
const rightSplit = ref(Number(storage.read('split:right') ?? 55));

const panels = computed(() => parseResult.value.panels);
const activePanel = computed(
  () => panels.value.find((panel) => panel.id === activePanelId.value) ?? panels.value[0],
);

const copied = ref(false);
let copiedTimer: ReturnType<typeof setTimeout> | undefined;
let parseTimer: ReturnType<typeof setTimeout> | undefined;

function refresh() {
  parseResult.value = parseSource(code.value, sourceType.value);
  transformOutcome.value = showTransform.value
    ? runTransform(code.value, sourceType.value, codemodSource.value)
    : null;
}

function scheduleRefresh() {
  clearTimeout(parseTimer);
  parseTimer = setTimeout(refresh, PARSE_DELAY_MS);
}

watch([code, codemodSource, sourceType, showTransform], scheduleRefresh);

watch(code, (value) => storage.write(`code:${sourceType.value.id}`, value));
watch(codemodSource, (value) => storage.write('codemod', value));
watch(showTransform, (value) => {
  storage.write('show-transform', String(value));
  if (value) {
    void ensureLanguageService();
  }
});
watch(mainSplit, (value) => storage.write('split:main', String(value)));
watch(leftSplit, (value) => storage.write('split:left', String(value)));
watch(rightSplit, (value) => storage.write('split:right', String(value)));

watch(sourceType, (type) => {
  storage.write('source-type', type.id);
  code.value = storage.read(`code:${type.id}`) ?? sampleFor(type.id);
  cursor.value = null;
  activePanelId.value = null;
});

// Keep the selected tab pointing at something that still exists.
watch(panels, (value) => {
  if (!value.some((panel) => panel.id === activePanelId.value)) {
    activePanelId.value = value[0]?.id ?? null;
  }
});

const focusedElements = new Set<HTMLElement>();

const context: ExplorerContext = {
  setHighlight(range) {
    highlight.value = range;
  },

  selectedNode,

  selectNode(node) {
    selectedNode.value = node;

    // AST Explorer publishes the selected node for poking at in the console.
    if (node) {
      (window as unknown as { $node: unknown }).$node = node;
    } else {
      delete (window as unknown as { $node?: unknown }).$node;
    }
  },

  trackFocused(element, focused) {
    if (focused) {
      focusedElements.add(element);
    } else {
      focusedElements.delete(element);
    }
  },

  /**
   * A position in the source can match several nodes at once. Scroll to
   * whichever is closest to the middle of the tree rather than the first.
   */
  scrollToFocused() {
    const elements = [...focusedElements];
    const container = elements[0]?.closest('.ast-tree-root');

    if (!elements[0] || !container) {
      return;
    }

    const bounds = container.getBoundingClientRect();
    const center = bounds.top + bounds.height / 2;

    const closest = elements.reduce(
      (best, element) => {
        const rect = element.getBoundingClientRect();
        const distance = Math.min(Math.abs(rect.top - center), Math.abs(rect.bottom - center));
        return distance < best.distance ? { element, distance } : best;
      },
      { element: elements[0], distance: Number.POSITIVE_INFINITY },
    );

    closest.element.scrollIntoView({ block: 'nearest' });
  },
};

provide(EXPLORER_CONTEXT, context);

function reset() {
  code.value = sampleFor(sourceType.value.id);
  codemodSource.value = SAMPLE_CODEMOD;
}

async function copyLink() {
  const url = buildShareUrl({
    type: sourceType.value.id,
    code: code.value,
    codemod: codemodSource.value,
  });

  window.history.replaceState(null, '', url);

  try {
    await navigator.clipboard.writeText(url);
    copied.value = true;
    clearTimeout(copiedTimer);
    copiedTimer = setTimeout(() => {
      copied.value = false;
    }, 2000);
  } catch {
    // clipboard access denied; the address bar now holds the link anyway
  }
}

onMounted(() => {
  refresh();
  if (showTransform.value) {
    void ensureLanguageService();
  }
});

onBeforeUnmount(() => {
  clearTimeout(parseTimer);
  clearTimeout(copiedTimer);
});
</script>

<template>
  <div class="ast-explorer">
    <header class="explorer-toolbar">
      <label class="explorer-field">
        Source
        <select v-model="sourceType">
          <option v-for="type in SOURCE_TYPES" :key="type.id" :value="type">
            {{ type.label }}
          </option>
        </select>
      </label>

      <span class="explorer-filename">{{ sourceType.filename }}</span>

      <!-- Start fetching TypeScript on the way to the checkbox. -->
      <label class="explorer-field" @mouseenter="ensureLanguageService">
        <input v-model="showTransform" type="checkbox" />
        Codemod
      </label>

      <span class="explorer-toolbar-spacer" />

      <a
        class="explorer-credit"
        href="https://github.com/fkling/astexplorer"
        target="_blank"
        rel="noreferrer"
      >
        after AST Explorer
      </a>

      <button type="button" title="Restore the example source" @click="reset">Reset</button>
      <button type="button" title="Put the source and codemod in the URL" @click="copyLink">
        {{ copied ? 'Copied' : 'Copy link' }}
      </button>
    </header>

    <SplitPane v-model="mainSplit" direction="horizontal" class="explorer-body">
      <template #a>
        <SplitPane v-model="leftSplit" direction="vertical" :collapsed="!showTransform">
          <template #a>
            <section class="explorer-pane">
              <h2 class="explorer-pane-title">Source</h2>
              <SourceEditor
                v-model="code"
                :language="sourceType.language"
                :highlight="highlight"
                @cursor="cursor = $event"
              />
            </section>
          </template>

          <template #b>
            <section class="explorer-pane">
              <h2 class="explorer-pane-title">
                Codemod
                <span v-if="languageServiceState === 'loading'" class="explorer-pane-status">
                  loading TypeScript…
                </span>
                <span
                  v-else-if="languageServiceState === 'unavailable'"
                  class="explorer-pane-status"
                >
                  type checking needs the package built
                </span>
              </h2>
              <SourceEditor
                v-model="codemodSource"
                language="typescript"
                :highlight="null"
                :language-service="languageService"
              />
            </section>
          </template>
        </SplitPane>
      </template>

      <template #b>
        <SplitPane v-model="rightSplit" direction="vertical" :collapsed="!showTransform">
          <template #a>
            <section class="explorer-pane">
              <div class="explorer-pane-title explorer-tabs">
                <button
                  v-for="panel in panels"
                  :key="panel.id"
                  type="button"
                  class="explorer-tab"
                  :class="{ active: panel.id === activePanel?.id }"
                  @click="activePanelId = panel.id"
                >
                  {{ panel.label }}
                </button>
                <span v-if="activePanel?.note" class="explorer-tab-note">{{
                  activePanel.note
                }}</span>
              </div>

              <details v-if="activePanel?.warnings?.length" class="explorer-warnings">
                <summary>
                  {{ activePanel.warnings.length }} syntax error{{
                    activePanel.warnings.length === 1 ? '' : 's'
                  }}
                  recovered from
                </summary>
                <p v-for="warning in activePanel.warnings" :key="warning">{{ warning }}</p>
              </details>

              <p v-if="parseResult.error" class="explorer-error">{{ parseResult.error }}</p>
              <AstTree
                v-else-if="activePanel"
                :key="activePanel.id"
                :ast="activePanel.ast"
                :options="activePanel.adapter"
                :position="cursor"
              />
            </section>
          </template>

          <template #b>
            <section class="explorer-pane">
              <h2 class="explorer-pane-title">Transform output</h2>
              <TransformPane :outcome="transformOutcome" />
            </section>
          </template>
        </SplitPane>
      </template>
    </SplitPane>
  </div>
</template>
