/**
 * @fileoverview The seam between vue-eslint-parser's template AST types and this library's.
 *
 * The `ast.ts` module re-declares the Vue node types rather than re-exporting them, because
 * the plugin API needs script expressions modelled as ast-types nodes, a `leadingComment` on
 * the nodes a comment can precede, and no required `range` or `loc`, so that builders can
 * create a node without inventing a source position for it.
 *
 * The two families describe the same runtime objects but aren't assignable to each other,
 * and they can't be reconciled property by property: `parent` and `children` are mutually
 * recursive, so TypeScript reaches the cycle before any individual difference. Converting
 * between them takes an assertion, so this module holds them all.
 */

import { AST as parserAST } from 'vue-eslint-parser';
import type * as vueParser from 'vue-eslint-parser';
import type * as AST from './ast';

/**
 * Reinterprets a parsed document fragment as the AST that plugins receive.
 */
export function toPluginAST(root: vueParser.AST.VDocumentFragment): AST.VDocumentFragment {
  // Safe because this is identity at runtime: vue-eslint-parser produced the fragment, so it
  // carries `range` and `loc`, and `parseVue` attaches `leadingComment` before handing it over.
  return root as unknown as AST.VDocumentFragment;
}

/**
 * Walks a template AST using vue-eslint-parser's traversal, which takes the parser's own node
 * and visitor types. Borrowing it avoids keeping a second copy of every node's child keys in
 * step with the parser's.
 */
export function traverseWithParser(
  node: AST.Node,
  visitor: {
    enterNode(node: AST.Node, parent: AST.Node | null): void;
    leaveNode(node: AST.Node, parent: AST.Node | null): void;
  },
): void {
  // Safe because both are identity at runtime: the parser walks the same objects, and hands
  // the visitor back the same nodes it was given.
  const parserNode = node as unknown as vueParser.AST.VNode;
  const parserVisitor = visitor as unknown as Parameters<typeof parserAST.traverseNodes>[1];

  parserAST.traverseNodes(parserNode, parserVisitor);
}
