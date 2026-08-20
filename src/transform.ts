import MagicString from 'magic-string';
import { cloneDeep, get, uniqWith, isEqual } from 'lodash-es';
import * as recast from './vendor/recast/main';
import type postcss from 'postcss';
import deepDiff from './vendor/deep-diff/index.js';
import * as AST from './ast';
import { utils, type CodemodPlugin, type VueProgram } from './types';
import { setParents, vText } from './builders';
import { stringify, withPrintContext, type PrintContext } from './stringify';
import { parseTs, parseVue } from './parse';
import { VDocumentFragment } from './ast';
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
  'VExpressionContainer', // VExpressionContainer has wrong locations from vue-eslint-parser sometimes
]);

const NON_RENDERABLE_AS_CHILD_OF = new Set<string>([
  'VDirectiveKey', // range includes the 'v-' prefix
  'VExpressionContainer', // VExpressionContainer has wrong locations from vue-eslint-parser, so all of its children could as well
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RenderableNode = { type: string; range: [number, number] } & Record<string, any>;

function isNode(value: unknown): value is RenderableNode {
  return !!value && typeof value === 'object' && 'type' in value;
}

/**
 * Walks up a diff property path until it reaches a node that prints as a self-contained unit
 * with a correct range. This function skips non-node segments, such as arrays and primitives,
 * along with the types in `NON_RENDERABLE_TYPES`.
 */
function findRenderableNode(
  root: AST.Node,
  propertyPath: (string | number)[],
): { path: (string | number)[]; node: RenderableNode } {
  // Drop the trailing property name so that the path points at the owning node.
  let path = propertyPath.slice(0, -1);
  while (path.length > 0) {
    const value = get(root, path);
    if (isNode(value) && !NON_RENDERABLE_TYPES.has(value.type)) {
      const parentPath = path.slice(0, -1);
      const parent = parentPath.length > 0 ? get(root, parentPath) : root;
      const blockedByParent = isNode(parent) && NON_RENDERABLE_AS_CHILD_OF.has(parent.type);
      if (!blockedByParent) {
        return { path, node: value };
      }
    }
    path = path.slice(0, -1);
  }
  return {
    path,
    node: root as RenderableNode,
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

  AST.traverseNodes(root as never, {
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
function printedStart(node: RenderableNode): number {
  let comment: AST.HtmlComment | null | undefined =
    node.type === 'VElement' ? node.startTag?.leadingComment : node.leadingComment;
  let start = node.range[0];

  while (comment) {
    const range = comment.range;

    if (!Array.isArray(range) || range[0] < 0 || range[0] >= start) {
      break;
    }

    start = range[0];
    comment = comment.leadingComment;
  }

  return start;
}

function runCodemods(
  codemods: CodemodPlugin[],
  filename: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  opts: Record<string, any>,
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

function transformVueFile(
  code: string,
  filename: string,
  codemods: CodemodPlugin[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  opts: Record<string, any>,
): TransformResult {
  const ms = new MagicString(code);
  const {
    scriptASTs,
    sfcAST,
    styleASTs,
    scriptASTMap,
    styleASTMap,
    originalScripts,
    originalStyles,
    neededExtraTemplate,
  } = parseVue(code);
  const originalScriptCount = scriptASTMap.size;
  const originalStyleCount = styleASTMap.size;
  const templateAst = sfcAST.templateBody?.parent as unknown as VDocumentFragment;
  const originalTemplate = cloneDeep(templateAst);

  const stats = runCodemods(codemods, filename, opts, {
    scriptASTs,
    sfcAST: templateAst ?? null,
    styleASTs,
  });

  if (!templateAst || !originalTemplate) {
    return { code: ms.toString(), stats };
  }

  setParents(templateAst);

  let nextExtraScript = originalScriptCount;
  let nextExtraStyle = originalStyleCount;

  const reprintScriptBlock = (node: AST.VElement) => {
    if (node.name !== 'script' || node.parent !== templateAst) return;

    let scriptAst = scriptASTMap.get(node as never);
    if (!scriptAst && !originalScripts.has(node as never) && nextExtraScript < scriptASTs.length) {
      scriptAst = scriptASTs[nextExtraScript++];
    }
    if (!scriptAst) return;

    const newCode = recast
      .print(scriptAst, recastOptions)
      .code.replace(/\/\* METAMORPH_START \*\/(\r?\n)*/g, '\n');

    const text = `${newCode.startsWith('\n') ? '' : '\n'}${newCode}\n`;
    if (node.children[0]?.type === 'VText') {
      node.children[0].value = text;
    } else {
      node.children.unshift(vText(text));
    }
  };

  const reprintStyleBlock = (node: AST.VElement) => {
    if (
      node.name !== 'style' ||
      node.parent !== templateAst ||
      !isSupportedLang(getLangAttribute(node)) ||
      node.children[0]?.type !== 'VText'
    ) {
      return;
    }

    let styleAst = styleASTMap.get(node as never);
    if (!styleAst && !originalStyles.has(node as never) && nextExtraStyle < styleASTs.length) {
      styleAst = styleASTs[nextExtraStyle++];
    }
    if (!styleAst) return;

    const newCode = styleAst
      .toString(syntaxMap[getLangAttribute(node)]!.stringify)
      .replace(/\/\* METAMORPH_START \*\/(\r?\n)*/g, '\n');

    node.children.length = 0;
    node.children.push(vText(`${newCode.startsWith('\n') ? '' : '\n'}${newCode}`));
  };

  AST.traverseNodes(templateAst as never, {
    enterNode(node) {
      if (node.type === 'VElement') {
        reprintScriptBlock(node);
        reprintStyleBlock(node);
      }
    },
    leaveNode() {
      // empty
    },
  });

  const diff = deepDiff(originalTemplate, templateAst, ignoreProperty);

  if (!diff) {
    return { code: ms.toString(), stats };
  }

  const normalized = diff.map((p) => ({
    diff: p,
    ...findRenderableNode(originalTemplate, [...(p.path ?? [])]),
  }));

  // Adding or removing something near the root of the template changes the children list of
  // the root, so reprint the whole template rather than splicing individual nodes.
  const rootNodeChanged = normalized.some(
    ({ path, diff: p }) => path.length <= 3 && p.kind !== 'E',
  );

  const printContext = createPrintContext(code, originalTemplate);

  if (rootNodeChanged) {
    if (neededExtraTemplate) {
      templateAst.children = templateAst.children.filter(
        (el) => el.type !== 'VElement' || el.name !== 'template',
      );
    }
    // The 'range' property is present at runtime, but the types leave it out for DX.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [start, end] = (originalTemplate as any).range;
    ms.update(
      start,
      end,
      withPrintContext(printContext, () => stringify(templateAst)),
    );
    return { code: ms.toString(), stats };
  }

  type ChangedNode = {
    path: (string | number)[];
    node: AST.Node;
    start: number;
    end: number;
  };

  const changedNodes: ChangedNode[] = normalized.map(({ path, node: originalNode }) => ({
    path,
    start: printedStart(originalNode),
    end: originalNode.range[1],
    node: path.length === 0 ? templateAst : get(templateAst, path),
  }));

  /* Collapse the diff results. Consider two changed paths:
    ['children', 1, 'children', 2]
    ['children', 1]

    The deeper node needs no separate handling, because one of its ancestors changed and the
    changes to the deeper node get printed along with that ancestor.

    Sort ascending by path length first. uniqWith keeps the first occurrence and drops later
    matches, so the shorter ancestor path has to land in the array before any of its
    descendants.
  */
  const collapsedChanges = uniqWith(
    [...changedNodes].sort((a, b) => a.path.length - b.path.length),
    (a, b) => {
      if (a.path.length === b.path.length) {
        return isEqual(a.path, b.path);
      }
      const lesser = a.path.length < b.path.length ? a : b;
      const greater = lesser === a ? b : a;
      return isEqual(lesser.path, greater.path.slice(0, lesser.path.length));
    },
  ).sort((a, b) => b.path.length - a.path.length);

  for (const { start, end, node } of collapsedChanges) {
    ms.update(
      start,
      end,
      withPrintContext(printContext, () => stringify(node)),
    );
  }

  return { code: ms.toString(), stats };
}

function transformTypescriptFile(
  code: string,
  filename: string,
  codemods: CodemodPlugin[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  opts: Record<string, any>,
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  opts: Record<string, any>,
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  opts: Record<string, any> = {},
) {
  if (filename.endsWith('.vue')) {
    return transformVueFile(code, filename, plugins, opts);
  }

  if (getCssDialectForFilename(filename)) {
    return transformCssFile(code, filename, plugins, opts);
  }

  return transformTypescriptFile(code, filename, plugins, opts);
}
