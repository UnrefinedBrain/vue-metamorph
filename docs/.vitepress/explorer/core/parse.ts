/**
 * Runs vue-metamorph's own parsers over the editor contents.
 *
 * The explorer deliberately imports the parsing code rather than
 * reimplementing it, so what the tree shows is what a codemod plugin receives:
 * `sfcAST` for the template, one `scriptASTs` entry per `<script>` block, one
 * `styleASTs` entry per supported `<style>` block.
 */

import type { AST } from 'vue-eslint-parser';
import { parseVue } from '../../../../src/parse/vue';
import { parseTs } from '../../../../src/parse/typescript';
import { getCssDialectForFilename, parseCss } from '../../../../src/parse/css';
import type { TreeAdapterOptions } from './tree-adapter';
import { estreeAdapter, postcssAdapter } from './adapters';
import type { SourceType } from './source-types';

/** vue-metamorph prefixes extracted blocks with this so ranges line up. */
const BLOCK_PREFIX = '/* METAMORPH_START */';

export type AstPanel = {
  id: string;
  label: string;
  ast: unknown;
  adapter: TreeAdapterOptions;
  note?: string;
  /** Syntax errors the parser recovered from rather than threw. */
  warnings?: string[];
};

export type ParseResult = {
  panels: AstPanel[];
  error: string | null;
};

const STYLUS_HINT =
  'Stylus is supported by vue-metamorph, but its parser only runs in Node, so it is not part of ' +
  'this page. Use the postcss-styl playground at https://stylus.github.io/postcss-styl/ instead.';

function describeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('postcss-styl is not bundled') ? STYLUS_HINT : message;
}

/** Renders a block back as its opening tag, e.g. `<script setup lang="ts">`. */
function describeBlock(element: AST.VElement): string {
  const attributes = element.startTag.attributes
    .filter((attribute) => !attribute.directive)
    .map((attribute) => {
      const value = attribute.value?.value;
      return value ? `${attribute.key.rawName}="${value}"` : attribute.key.rawName;
    });

  return `<${[element.name, ...attributes].join(' ')}>`;
}

/**
 * A block is parsed from the marker comment, plus enough blank lines to keep
 * the line numbers honest, plus the block's own text. Every offset in the
 * resulting AST therefore sits `prefixLength - start` away from where it
 * belongs in the editor.
 */
function blockRangeMapper(element: AST.VElement, start: number, end: number) {
  const prefixLength = BLOCK_PREFIX.length + (element.loc.start.line - 1);
  const clamp = (offset: number) => Math.min(Math.max(offset - prefixLength + start, start), end);

  return (range: [number, number]): [number, number] => [clamp(range[0]), clamp(range[1])];
}

function parseVueSource(code: string): AstPanel[] {
  const result = parseVue(code);
  const panels: AstPanel[] = [];

  const templateAst = result.sfcAST.templateBody?.parent;
  if (templateAst) {
    panels.push({
      id: 'template',
      label: 'Template',
      ast: templateAst,
      adapter: estreeAdapter(),
      // vue-eslint-parser recovers from template syntax errors rather than
      // throwing, and so do the codemods that run on the result.
      warnings: (templateAst.errors ?? []).map(
        (error) => `Line ${error.lineNumber}, column ${error.column}: ${error.message}`,
      ),
      note: result.neededExtraTemplate
        ? 'This file has no <template>, so vue-metamorph appended an empty one to get a document ' +
          'fragment to work with. Codemods see it too.'
        : undefined,
    });
  }

  let scriptIndex = 0;
  for (const [element, ast] of result.scriptASTMap) {
    const start = element.children[0]?.range[0] ?? element.range[0];
    const end = element.children[0]?.range[1] ?? element.range[1];

    panels.push({
      id: `script-${scriptIndex}`,
      label: `Script${result.scriptASTMap.size > 1 ? ` #${scriptIndex + 1}` : ''}`,
      ast,
      adapter: estreeAdapter(blockRangeMapper(element, start, end)),
      note: describeBlock(element),
    });
    scriptIndex += 1;
  }

  let styleIndex = 0;
  for (const [element, root] of result.styleASTMap) {
    const start = element.children[0]?.range[0] ?? element.range[0];
    const end = element.children.at(-1)?.range[1] ?? element.range[1];

    panels.push({
      id: `style-${styleIndex}`,
      label: `Style${result.styleASTMap.size > 1 ? ` #${styleIndex + 1}` : ''}`,
      ast: root,
      adapter: postcssAdapter(blockRangeMapper(element, start, end)),
      note: describeBlock(element),
    });
    styleIndex += 1;
  }

  return panels;
}

export function parseSource(code: string, sourceType: SourceType): ParseResult {
  try {
    if (sourceType.filename.endsWith('.vue')) {
      return { panels: parseVueSource(code), error: null };
    }

    const dialect = getCssDialectForFilename(sourceType.filename);
    if (dialect) {
      return {
        panels: [
          {
            id: 'style',
            label: 'Stylesheet',
            ast: parseCss(code, dialect),
            adapter: postcssAdapter(),
          },
        ],
        error: null,
      };
    }

    return {
      panels: [
        {
          id: 'script',
          label: 'Script',
          ast: parseTs(code, /\.[jt]sx$/.test(sourceType.filename)),
          adapter: estreeAdapter(),
        },
      ],
      error: null,
    };
  } catch (error) {
    return { panels: [], error: describeError(error) };
  }
}

export { describeError };
