import { namedTypes } from 'ast-types';
import { ExpressionKind, PatternKind, StatementKind } from 'ast-types/gen/kinds';
import { AST } from 'vue-eslint-parser';

// Adapted from https://github.com/vuejs/vue-eslint-parser/blob/master/src/ast/nodes.ts

// Removed HasLocation from types for better compatibility with builders
// Also changed ESLint* types to namedTypes types

/*
 * MIT License
 * Copyright (c) 2016 Toru Nagashima
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

/**
 * @public
 */
export interface HasParent {
  parent?: Node | null;
}

/**
 * @public
 */
export const NS = Object.freeze({
  HTML: 'http://www.w3.org/1999/xhtml' as const,
  MathML: 'http://www.w3.org/1998/Math/MathML' as const,
  SVG: 'http://www.w3.org/2000/svg' as const,
  XLink: 'http://www.w3.org/1999/xlink' as const,
  XML: 'http://www.w3.org/XML/1998/namespace' as const,
  XMLNS: 'http://www.w3.org/2000/xmlns/' as const,
});

/**
 * Type of namespaces.
 * @public
 */
export type Namespace =
  | typeof NS.HTML
  | typeof NS.MathML
  | typeof NS.SVG
  | typeof NS.XLink
  | typeof NS.XML
  | typeof NS.XMLNS;

/**
 * The union type for all nodes.
 * @public
 */
export type Node =
  | Exclude<namedTypes.ASTNode & HasParent, namedTypes.Program | namedTypes.File>
  | VNode
  | VForExpression
  | VOnExpression
  | VSlotScopeExpression
  | VFilterSequenceExpression
  | VGenericExpression
  | VFilter
  | VDocumentFragment;

/**
 * The node of `v-for` directives.
 * @public
 */
export interface VForExpression extends HasParent {
  type: 'VForExpression';
  parent: VExpressionContainer;
  left: PatternKind[];
  right: ExpressionKind;
}

/**
 * The node of `v-on` directives.
 * @public
 */
export interface VOnExpression extends HasParent {
  type: 'VOnExpression';
  parent: VExpressionContainer;
  body: StatementKind[];
}

/**
 * The node of `slot-scope` directives.
 * @public
 */
export interface VSlotScopeExpression extends HasParent {
  type: 'VSlotScopeExpression';
  parent: VExpressionContainer;
  params: PatternKind[];
}

/**
 * The node of a filter sequence which is separated by `|`.
 * @public
 */
export interface VFilterSequenceExpression extends HasParent {
  type: 'VFilterSequenceExpression';
  parent: VExpressionContainer;
  expression: ExpressionKind;
  filters: VFilter[];
}

/**
 * The node of a filter sequence which is separated by `|`.
 * @public
 */
export interface VFilter extends HasParent {
  type: 'VFilter';
  parent: VFilterSequenceExpression;
  callee: namedTypes.Identifier;
  arguments: (ExpressionKind | namedTypes.SpreadElement)[];
}

/**
 * The generic expression on a <script setup lang="ts" generic="..."> node
 */
export interface VGenericExpression extends HasParent {
  type: 'VGenericExpression';
  parent: VExpressionContainer;
  params: namedTypes.TSTypeParameterDeclaration['params'];
  rawParams: string[];
}

/**
 * The union type of any nodes.
 * @public
 */
export type VNode =
  | VAttribute
  | VDirective
  | VDirectiveKey
  | VDocumentFragment
  | VElement
  | VEndTag
  | VExpressionContainer
  | VIdentifier
  | VLiteral
  | VStartTag
  | VText;

/**
 * Text nodes.
 * @public
 */
export interface VText extends HasParent {
  type: 'VText';
  parent: VDocumentFragment | VElement;
  value: string;
}

/**
 * The node of JavaScript expression in text.
 * e.g. `{{ name }}`
 * @public
 */
export interface VExpressionContainer extends HasParent {
  type: 'VExpressionContainer';
  parent: VDocumentFragment | VElement | VDirective | VDirectiveKey;
  expression:
  | ExpressionKind
  | PatternKind
  | VFilterSequenceExpression
  | VForExpression
  | VOnExpression
  | VSlotScopeExpression
  | VGenericExpression
  | null;

}

/**
 * Attribute name nodes.
 * @public
 */
export interface VIdentifier extends HasParent {
  type: 'VIdentifier';
  parent: VAttribute | VDirectiveKey;
  name: string;
  rawName: string;
}

/**
 * Attribute name nodes.
 * @public
 */
export interface VDirectiveKey extends HasParent {
  type: 'VDirectiveKey';
  parent: VDirective;
  name: VIdentifier;
  argument: VExpressionContainer | VIdentifier | null;
  modifiers: VIdentifier[];
}

/**
 * Attribute value nodes.
 * @public
 */
export interface VLiteral extends HasParent {
  type: 'VLiteral';
  parent: VAttribute;
  value: string;
}

/**
 * Static attribute nodes.
 * @public
 */
export interface VAttribute extends HasParent {
  type: 'VAttribute';
  parent: VStartTag;
  directive: false;
  key: VIdentifier;
  value: VLiteral | null;
}

/**
 * Directive nodes.
 * @public
 */
export interface VDirective extends HasParent {
  type: 'VAttribute';
  parent: VStartTag;
  directive: true;
  key: VDirectiveKey;
  value: VExpressionContainer | null;
}

/**
 * Start tag nodes.
 * @public
 */
export interface VStartTag extends HasParent {
  type: 'VStartTag';
  parent: VElement;
  selfClosing: boolean;
  attributes: (VAttribute | VDirective)[];
}

/**
 * End tag nodes.
 * @public
 */
export interface VEndTag extends HasParent {
  type: 'VEndTag';
  parent: VElement;
}

/**
 * Element nodes.
 * @public
 */
export interface VElement extends HasParent {
  type: 'VElement';
  parent: VDocumentFragment | VElement;
  namespace: Namespace;
  name: string;
  rawName: string;
  startTag: VStartTag;
  children: (VElement | VText | VExpressionContainer)[];
  endTag: VEndTag | null;

}

/**
 * Root nodes.
 * @public
 */
export interface VDocumentFragment extends HasParent {
  type: 'VDocumentFragment';
  parent: null;
  children: (VElement | VText | VExpressionContainer | VStyleElement)[];
}

/**
 * Style element nodes.
 * @public
 */
export interface VStyleElement extends VElement {
  type: 'VElement';
  name: 'style';
  style: true;
  children: (VText | VExpressionContainer)[];
}

/**
 * @public
 */
export const traverseNodes = (node: Node, visitor: {
  enterNode?(node: Node, parent: Node | null): void;
  leaveNode?(node: Node, parent: Node | null): void;
}) => {
  const noop = () => {};

  // eslint-disable-next-line @typescript-eslint/ban-types
  (AST.traverseNodes as Function)(node, {
    enterNode: visitor.enterNode ?? noop,
    leaveNode: visitor.leaveNode ?? noop,
  });
};
