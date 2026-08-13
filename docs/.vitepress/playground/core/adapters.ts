/**
 * Tree adapter configurations for the ASTs vue-metamorph hands to a codemod.
 *
 * Adapted from AST Explorer (https://github.com/fkling/astexplorer) - MIT,
 * Copyright (c) 2014 Felix Kling - narrowed to the parsers vue-metamorph
 * actually uses.
 */

import {
  type Range,
  type TreeAdapterOptions,
  type TreeProperty,
  emptyKeysFilter,
  functionFilter,
  ignoreKeysFilter,
  locationInformationFilter,
} from './tree-adapter';

/** Never walked: `parent` makes the tree infinite, the rest is only noise. */
const ESTREE_IGNORED = new Set(['parent', 'tokens']);
const POSTCSS_IGNORED = new Set(['parent', 'input', 'document', 'proxyCache']);

const ESTREE_LOCATION_PROPS = new Set(['range', 'loc', 'start', 'end']);
const POSTCSS_LOCATION_PROPS = new Set(['source']);

const OPEN_BY_DEFAULT_NODES = new Set(['Program', 'VDocumentFragment']);
const OPEN_BY_DEFAULT_KEYS = new Set([
  'body',
  'children', // template elements
  'declarations', // variable declarations
  'elements', // array literals
  'expression', // expression statements
  'templateBody',
]);

function* walkProperties(node: unknown, ignored: Set<string>): Generator<TreeProperty> {
  if (!node || typeof node !== 'object') {
    return;
  }

  for (const key in node) {
    if (ignored.has(key)) {
      continue;
    }
    yield { key, value: (node as Record<string, unknown>)[key], computed: false };
  }
}

/**
 * ESTree-shaped ASTs: the SFC template AST from vue-eslint-parser and the
 * script ASTs from `@babel/parser`, as parsed through recast.
 */
export function estreeAdapter(mapRange?: (range: Range) => Range | null): TreeAdapterOptions {
  return {
    filters: [
      functionFilter(),
      emptyKeysFilter(),
      locationInformationFilter(ESTREE_LOCATION_PROPS),
    ],
    locationProps: ESTREE_LOCATION_PROPS,
    mapRange,

    openByDefault(node, key) {
      const type = (node as { type?: string } | null)?.type;
      return (
        (!!type && OPEN_BY_DEFAULT_NODES.has(type)) || (!!key && OPEN_BY_DEFAULT_KEYS.has(key))
      );
    },

    nodeToRange(node) {
      if (!node || typeof node !== 'object') {
        return null;
      }

      const candidate = node as { range?: unknown; start?: unknown; end?: unknown };

      if (
        Array.isArray(candidate.range) &&
        typeof candidate.range[0] === 'number' &&
        typeof candidate.range[1] === 'number'
      ) {
        return [candidate.range[0], candidate.range[1]];
      }

      if (typeof candidate.start === 'number' && typeof candidate.end === 'number') {
        return [candidate.start, candidate.end];
      }

      return null;
    },

    nodeToName(node) {
      return (node as { type?: string } | null)?.type;
    },

    walkNode(node) {
      return walkProperties(node, ESTREE_IGNORED);
    },
  };
}

type PostcssPosition = { offset?: number; line?: number; column?: number };
type PostcssSource = { start?: PostcssPosition; end?: PostcssPosition };

/**
 * PostCSS roots, as handed to codemods for every `<style>` block and every
 * standalone stylesheet.
 */
export function postcssAdapter(mapRange?: (range: Range) => Range | null): TreeAdapterOptions {
  return {
    filters: [
      functionFilter(),
      emptyKeysFilter(),
      locationInformationFilter(POSTCSS_LOCATION_PROPS),
      ignoreKeysFilter(new Set(['raws']), 'hideRaws', 'Hide raws'),
    ],
    locationProps: POSTCSS_LOCATION_PROPS,
    mapRange,

    openByDefault(_node, key) {
      return key === 'nodes';
    },

    nodeToRange(node) {
      const source = (node as { source?: PostcssSource } | null)?.source;
      if (typeof source?.start?.offset !== 'number' || typeof source.end?.offset !== 'number') {
        return null;
      }
      return [source.start.offset, source.end.offset];
    },

    nodeToName(node) {
      return (node as { type?: string } | null)?.type;
    },

    walkNode(node) {
      return walkProperties(node, POSTCSS_IGNORED);
    },
  };
}
