import MagicString from 'magic-string';
import { cloneDeep, get } from 'lodash-es';
import * as recast from './vendor/recast/main';
import type postcss from 'postcss';
import deepDiff from './vendor/deep-diff/index.js';
import * as AST from './ast';
import { utils, type CodemodPlugin, type PluginOptions, type VueProgram } from './types';
import { getRange, hasRange, type SourceRange } from './node-range';
import { setParents, vText } from './builders';
import { stringifyTemplateReplacement, type PrintContext } from './stringify';
import { parseTs, parseVue } from './parse';
import {
  getCssDialectForFilename,
  getLangAttribute,
  isSupportedLang,
  parseCss,
  syntaxMap,
} from './parse/css';

const recastOptions: recast.Options = {
  tabWidth: 2,
  arrowParensAlways: true,
  quote: 'single',
  trailingComma: true,
};

const ignoreProperties: Record<string, true> = {
  parent: true,
  loc: true,
  range: true,
  variables: true,
  references: true,
};

const NON_RENDERABLE_TYPES = new Set<string>([
  'VStartTag', // VStartTag is rendered as part of VElement, not by itself
]);

const NON_RENDERABLE_AS_CHILD_OF = new Set<string>([
  'VDirectiveKey', // range includes the 'v-' prefix
]);

/**
 * The return type of the `transform` function, which holds the transformed source code and the
 * codemod stats.
 * @public
 */
export type TransformResult = {
  /**
   * The transformed source code.
   */
  code: string;

  /**
   * The number of transforms that each codemod reported.
   */
  stats: [codemodName: string, transformCount: number][];
};

type TraversedNode = { type: string } & Record<string, unknown>;

function isNode(value: unknown): value is TraversedNode {
  return !!value && typeof value === 'object' && 'type' in value && typeof value.type === 'string';
}

/**
 * Walks up a diff property path until it reaches a node that prints as a self-contained unit
 * with a correct range. This function skips non-node segments, such as arrays and primitives,
 * along with the types in `NON_RENDERABLE_TYPES`.
 */
function findRenderableNode(
  root: AST.Node,
  propertyPath: (string | number)[],
): { path: (string | number)[]; range: SourceRange } {
  // Drop the trailing property name so that the path points at the owning node.
  let path = propertyPath.slice(0, -1);
  // Print an expression in its full context for precedence, delimiters, and HTML escaping.
  // This also groups multiple edits to the same expression into a single replacement.
  for (let length = path.length; length > 0; length--) {
    const containerPath = path.slice(0, length);
    const container = get(root, containerPath);
    if (isNode(container) && container.type === 'VExpressionContainer') {
      const range = getRange(container, 'the expression container');
      const parentPath = containerPath.slice(0, -1);
      const parent = get(root, parentPath);
      // Vue's :name shorthand gives its implicit value the name's source range.
      // Replacing that value requires expanding the whole attribute to :name="value".
      if (
        isNode(parent) &&
        parent.type === 'VAttribute' &&
        hasRange(parent.key) &&
        range[0] < parent.key.range[1]
      ) {
        return { path: parentPath, range: getRange(parent, 'the shorthand binding') };
      }
      return { path: containerPath, range };
    }
  }
  while (path.length > 0) {
    const value = get(root, path);
    if (isNode(value) && !NON_RENDERABLE_TYPES.has(value.type)) {
      const parentPath = path.slice(0, -1);
      const parent = parentPath.length > 0 ? get(root, parentPath) : root;
      const blockedByParent = isNode(parent) && NON_RENDERABLE_AS_CHILD_OF.has(parent.type);
      if (!blockedByParent) {
        return { path, range: getRange(value, `the ${value.type} node at ${path.join('.')}`) };
      }
    }
    path = path.slice(0, -1);
  }
  return {
    path,
    range: getRange(root, 'the template root'),
  };
}

const ignoreProperty = (_: unknown, name: string) => !!ignoreProperties[name];

function nodeKey(node: AST.Node): string | null {
  const range = (node as { range?: unknown }).range;

  if (!Array.isArray(range) || range.length !== 2) {
    return null;
  }

  const [start, end] = range as [number, number];

  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start) {
    return null;
  }

  return `${node.type}:${start}:${end}`;
}

/**
 * Indexes every node of the template as it was parsed, keyed by node type and source range. The
 * printer looks a node up here to decide whether it can reuse the original source text.
 */
function indexOriginalNodes(root: AST.Node): Map<string, AST.Node> {
  const index = new Map<string, AST.Node>();

  AST.traverseNodes(root, {
    enterNode(node) {
      const key = nodeKey(node);

      // On a key collision, keep the first node. The comparison against it then fails for
      // everything else that shares the key, which prints those nodes from scratch.
      if (key && !index.has(key)) {
        index.set(key, node);
      }
    },
    leaveNode() {
      // empty
    },
  });

  return index;
}

/**
 * Builds the print context for a template. A node counts as clean when the original template has
 * a node of the same type and range, and the two are deeply equal apart from the properties that
 * carry no printable information.
 */
function createPrintContext(source: string, originalTemplate: AST.Node): PrintContext {
  const index = indexOriginalNodes(originalTemplate);
  const cache = new WeakMap<object, boolean>();

  return {
    source,
    isClean(node) {
      const cached = cache.get(node);

      if (cached !== undefined) {
        return cached;
      }

      const key = nodeKey(node);
      const original = key ? index.get(key) : undefined;
      const clean = !!original && !deepDiff(original, node, ignoreProperty);

      cache.set(node, clean);

      return clean;
    },
  };
}

/**
 * Returns the offset that a node starts printing at. The printer emits the leading comment chain
 * of a node before the node itself, but a leading comment sits outside the range of the node that
 * carries it. Rewriting only the range would leave the original comment in place and print a
 * second copy of it, so the rewrite has to start at the outermost leading comment.
 */
function printedStart(node: AST.Node, start: number): number {
  let comment: AST.HtmlComment | null | undefined =
    node.type === 'VElement'
      ? node.startTag.leadingComment
      : 'leadingComment' in node
        ? node.leadingComment
        : undefined;

  while (comment) {
    if (!hasRange(comment) || comment.range[0] < 0 || comment.range[0] >= start) {
      break;
    }

    start = comment.range[0];
    comment = comment.leadingComment;
  }

  return start;
}

function runCodemods(
  codemods: CodemodPlugin[],
  filename: string,
  opts: PluginOptions,
  asts: {
    scriptASTs: VueProgram[];
    sfcAST: AST.VDocumentFragment | null;
    styleASTs: postcss.Root[];
  },
): [string, number][] {
  return codemods.map((codemod) => [
    codemod.name,
    codemod.transform({ ...asts, filename, utils, opts }),
  ]);
}

/** Copies each script AST's printed source into its SFC element. */
function reprintScriptBlock(node: AST.VElement, script: VueProgram): void {
  const newCode = recast
    .print(script, recastOptions)
    .code.replace(/\/\* METAMORPH_START \*\/(\r?\n)*/g, '\n');
  const text = `${newCode.startsWith('\n') ? '' : '\n'}${newCode}\n`;
  if (node.children[0]?.type === 'VText') {
    node.children[0].value = text;
  } else {
    node.children.unshift(vText(text));
  }
}

function reprintStyleBlock(node: AST.VElement, style: postcss.Root): void {
  const lang = getLangAttribute(node);
  const syntax = syntaxMap[lang];
  if (!syntax) {
    return;
  }
  const newCode = style
    .toString(syntax.stringify)
    .replace(/\/\* METAMORPH_START \*\/(\r?\n)*/g, '\n');
  node.children.length = 0;
  node.children.push(vText(`${newCode.startsWith('\n') ? '' : '\n'}${newCode}`));
}

/**
 * Updates the SFC text nodes from the script and style ASTs after plugins run.
 * Parsed elements retain their AST association by object identity. For new elements, plugins
 * append ASTs to the corresponding array in the order those elements appear in the SFC.
 * Original empty or unsupported blocks don't consume an appended AST.
 */
function synchronizeBlocks(parsed: ReturnType<typeof parseVue>): void {
  const {
    sfcTemplate,
    scriptASTs,
    styleASTs,
    scriptASTMap,
    styleASTMap,
    originalScripts,
    originalStyles,
  } = parsed;
  let nextExtraScript = scriptASTMap.size;
  let nextExtraStyle = styleASTMap.size;

  for (const node of sfcTemplate.children) {
    if (node.type !== 'VElement') {
      continue;
    }
    if (node.name === 'script') {
      let script = scriptASTMap.get(node);
      if (!script && !originalScripts.has(node) && nextExtraScript < scriptASTs.length) {
        script = scriptASTs[nextExtraScript++];
      }
      if (script) {
        reprintScriptBlock(node, script);
      }
    } else if (
      node.name === 'style' &&
      isSupportedLang(getLangAttribute(node)) &&
      node.children[0]?.type === 'VText'
    ) {
      let style = styleASTMap.get(node);
      if (!style && !originalStyles.has(node) && nextExtraStyle < styleASTs.length) {
        style = styleASTs[nextExtraStyle++];
      }
      if (style) {
        reprintStyleBlock(node, style);
      }
    }
  }
}

interface SourceReplacement {
  node: AST.Node;
  start: number;
  end: number;
}

interface ChangedNode extends SourceReplacement {
  path: Array<string | number>;
}

function isAncestorPath(
  ancestor: Array<string | number>,
  descendant: Array<string | number>,
): boolean {
  return (
    ancestor.length <= descendant.length &&
    ancestor.every((segment, index) => segment === descendant[index])
  );
}

/** Keeps each outermost replacement, including its descendants' edits. */
function selectOutermostChanges(changes: ChangedNode[]): ChangedNode[] {
  const selected: ChangedNode[] = [];
  for (const change of [...changes].sort((a, b) => a.path.length - b.path.length)) {
    if (!selected.some((ancestor) => isAncestorPath(ancestor.path, change.path))) {
      selected.push(change);
    }
  }
  return selected;
}

/**
 * Selects source ranges to replace, using the original tree for positions. When replacing
 * the whole document, removes any placeholder template that the parser added.
 */
function planTemplateReplacements(
  original: AST.VDocumentFragment,
  updated: AST.VDocumentFragment,
  neededExtraTemplate: boolean,
): SourceReplacement[] {
  const diff = deepDiff(original, updated, ignoreProperty);
  if (!diff) {
    return [];
  }

  const changes = diff.map((change) => ({
    kind: change.kind,
    ...findRenderableNode(original, [...(change.path ?? [])]),
  }));

  // The document has path [], and its direct children have ['children', index].
  // A nested child starts at path length 4. Structural edits before that depth can
  // change the SFC's block list, so replace the document as a whole.
  const changesBlockStructure = changes.some(({ path, kind }) => path.length < 4 && kind !== 'E');
  if (changesBlockStructure) {
    if (neededExtraTemplate) {
      updated.children = updated.children.filter(
        (node) => node.type !== 'VElement' || node.name !== 'template',
      );
    }
    const [start, end] = getRange(original, 'the template root');
    return [{ node: updated, start, end }];
  }

  const changedNodes: ChangedNode[] = changes.map(({ path, range }) => ({
    path,
    start: printedStart(path.length === 0 ? original : get(original, path), range[0]),
    end: range[1],
    node: path.length === 0 ? updated : get(updated, path),
  }));
  return selectOutermostChanges(changedNodes);
}

function transformVueFile(
  code: string,
  filename: string,
  codemods: CodemodPlugin[],
  opts: PluginOptions,
): TransformResult {
  const parsed = parseVue(code);
  const originalTemplate = cloneDeep(parsed.sfcTemplate);
  const stats = runCodemods(codemods, filename, opts, {
    scriptASTs: parsed.scriptASTs,
    sfcAST: parsed.sfcTemplate,
    styleASTs: parsed.styleASTs,
  });

  setParents(parsed.sfcTemplate);
  synchronizeBlocks(parsed);
  const replacements = planTemplateReplacements(
    originalTemplate,
    parsed.sfcTemplate,
    parsed.neededExtraTemplate,
  );
  if (replacements.length === 0) {
    return { code, stats };
  }
  const printContext = createPrintContext(code, originalTemplate);
  const source = new MagicString(code);
  for (const { start, end, node } of replacements) {
    source.update(start, end, stringifyTemplateReplacement(node, printContext));
  }
  return { code: source.toString(), stats };
}

function transformTypescriptFile(
  code: string,
  filename: string,
  codemods: CodemodPlugin[],
  opts: PluginOptions,
): TransformResult {
  const ast = parseTs(code, /\.[jt]sx$/.test(filename));
  const stats = runCodemods(codemods, filename, opts, {
    scriptASTs: [ast],
    sfcAST: null,
    styleASTs: [],
  });

  return {
    code: `${recast.print(ast, recastOptions).code}\n`,
    stats,
  };
}

function transformCssFile(
  code: string,
  filename: string,
  codemods: CodemodPlugin[],
  opts: PluginOptions,
): TransformResult {
  const dialect = getCssDialectForFilename(filename);

  if (!dialect) {
    return { code, stats: [] };
  }

  const ast = parseCss(code, dialect);
  const stats = runCodemods(codemods, filename, opts, {
    scriptASTs: [],
    sfcAST: null,
    styleASTs: [ast],
  });

  return {
    code: ast.toString(syntaxMap[dialect]),
    stats,
  };
}

/**
 * Parses source code into ASTs, runs codemod plugins against them, and returns the transformed
 * source code. This is the core function of vue-metamorph.
 *
 * The filename determines how vue-metamorph parses the code:
 *
 * - `.vue` — Parsed as a Vue SFC, which covers the template, the scripts, and the styles.
 * - `.js`, `.jsx`, `.ts`, `.tsx` — Parsed as JavaScript or TypeScript.
 * - `.css`, `.scss`, `.sass`, `.less`, `.styl` — Parsed as CSS.
 *
 * @example
 * ```ts
 * import { transform, type CodemodPlugin } from 'vue-metamorph';
 *
 * const myPlugin: CodemodPlugin = {
 *   type: 'codemod',
 *   name: 'my-transform',
 *   transform({ scriptASTs, utils: { traverseScriptAST } }) {
 *     let count = 0;
 *     for (const ast of scriptASTs) {
 *       traverseScriptAST(ast, {
 *         visitLiteral(path) {
 *           if (typeof path.node.value === 'string') {
 *             path.node.value = 'Hello, world!';
 *             count++;
 *           }
 *           return this.traverse(path);
 *         },
 *       });
 *     }
 *     return count;
 *   },
 * };
 *
 * const result = transform(sourceCode, 'file.vue', [myPlugin]);
 * result.code;  // transformed source code
 * result.stats; // [['my-transform', 3]]
 * ```
 *
 * @param code - The source code.
 * @param filename - The name of the file. vue-metamorph selects a parser based on this name.
 * @param plugins - The codemod plugins to run.
 * @param opts - Extra options to pass through to the plugins.
 * @returns An object with a `code` property, which holds the transformed source, and a `stats`
 * property, which holds the per-plugin transform counts.
 * @public
 */
export function transform(
  code: string,
  filename: string,
  plugins: CodemodPlugin[],
  opts: PluginOptions = {},
) {
  if (filename.endsWith('.vue')) {
    return transformVueFile(code, filename, plugins, opts);
  }

  if (getCssDialectForFilename(filename)) {
    return transformCssFile(code, filename, plugins, opts);
  }

  return transformTypescriptFile(code, filename, plugins, opts);
}
