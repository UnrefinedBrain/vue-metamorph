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
import { getNumberProperty, getProperty, getStringProperty } from './object-access';

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
    yield { key, value: getProperty(node, key), computed: false };
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
      const type = getStringProperty(node, 'type');
      return (
        (!!type && OPEN_BY_DEFAULT_NODES.has(type)) || (!!key && OPEN_BY_DEFAULT_KEYS.has(key))
      );
    },

    nodeToRange(node) {
      const range = getProperty(node, 'range');

      if (Array.isArray(range) && typeof range[0] === 'number' && typeof range[1] === 'number') {
        return [range[0], range[1]];
      }

      const start = getNumberProperty(node, 'start');
      const end = getNumberProperty(node, 'end');

      if (start !== undefined && end !== undefined) {
        return [start, end];
      }

      return null;
    },

    nodeToName(node) {
      return getStringProperty(node, 'type');
    },

    walkNode(node) {
      return walkProperties(node, ESTREE_IGNORED);
    },
  };
}

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
      const source = getProperty(node, 'source');
      const start = getNumberProperty(getProperty(source, 'start'), 'offset');
      const end = getNumberProperty(getProperty(source, 'end'), 'offset');

      if (start === undefined || end === undefined) {
        return null;
      }

      return [start, end];
    },

    nodeToName(node) {
      return getStringProperty(node, 'type');
    },

    walkNode(node) {
      return walkProperties(node, POSTCSS_IGNORED);
    },
  };
}
