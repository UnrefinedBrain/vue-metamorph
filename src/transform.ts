import MagicString from 'magic-string';
import { cloneDeep, get, uniqWith, isEqual } from 'lodash-es';
import * as recast from 'recast-x';
import type postcss from 'postcss';
import deepDiff from './vendor/deep-diff/index.js';
import * as AST from './ast';
import { utils, type CodemodPlugin, type VueProgram } from './types';
import { setParents, vText } from './builders';
import { stringify } from './stringify';
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
 * Return type of the `transform` function, containing new source code and codemod stats
 * @public
 */
export type TransformResult = {
  /**
   * The new source code
   */
  code: string;

  /**
   * Stats on how many transforms each codemod reported that it made
   */
  stats: [codemodName: string, transformCount: number][];
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RenderableNode = { type: string; range: [number, number] } & Record<string, any>;

function isNode(value: unknown): value is RenderableNode {
  return !!value && typeof value === 'object' && 'type' in value;
}

/**
 * Walk up a diff property-path until we land on a node that prints as a
 * self-contained unit with a correct range. Non-node segments (arrays,
 * primitives) and `NON_RENDERABLE_TYPES` are skipped automatically.
 */
function findRenderableNode(
  root: AST.Node,
  propertyPath: (string | number)[],
): { path: (string | number)[]; node: RenderableNode } {
  // Drop the trailing property name so we're pointing at the owning node.
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

  const diff = deepDiff(originalTemplate, templateAst, (_, name) => !!ignoreProperties[name]);

  if (!diff) {
    return { code: ms.toString(), stats };
  }

  const normalized = diff.map((p) => ({
    diff: p,
    ...findRenderableNode(originalTemplate, [...(p.path ?? [])]),
  }));

  // Adding or removing something near the root of the template means the root's
  // children list has changed, so we re-print the whole template rather than
  // trying to splice individual nodes.
  const rootNodeChanged = normalized.some(
    ({ path, diff: p }) => path.length <= 3 && p.kind !== 'E',
  );

  if (rootNodeChanged) {
    if (neededExtraTemplate) {
      templateAst.children = templateAst.children.filter(
        (el) => el.type !== 'VElement' || el.name !== 'template',
      );
    }
    // the 'range' property is present, though the types don't include it for DX
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [start, end] = (originalTemplate as any).range;
    ms.update(start, end, stringify(templateAst));
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
    start: originalNode.range[0],
    end: originalNode.range[1],
    node: path.length === 0 ? templateAst : get(templateAst, path),
  }));

  /* Collapse the diff results. If two changed paths are
    ['children', 1, 'children', 2]
    ['children', 1]

    We don't need to worry about the deeper changed node since one of its ancestors
    has changed and the deeper node's changes will be printed anyways.

    Sort ascending by path length first: uniqWith keeps the first occurrence
    and drops later matches, so the shorter (ancestor) path needs to land in
    the array before any of its descendants.
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
    ms.update(start, end, stringify(node));
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
 * Parses source code into ASTs, runs codemod plugins against them, and returns
 * the transformed source code. This is the core function of vue-metamorph.
 *
 * The filename determines how code is parsed:
 * - `.vue` — Parsed as a Vue SFC (template + scripts + styles)
 * - `.js`, `.jsx`, `.ts`, `.tsx` — Parsed as JavaScript/TypeScript
 * - `.css`, `.scss`, `.sass`, `.less`, `.styl` — Parsed as CSS
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
 * @param code - Source code string
 * @param filename - The file name (determines parser selection)
 * @param plugins - List of codemod plugins to run
 * @param opts - Additional options passed through to plugins
 * @returns Object with `code` (transformed source) and `stats` (per-plugin transform counts)
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
