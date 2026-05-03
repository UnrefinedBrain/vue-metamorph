import { voidElements } from './stringify';
import * as AST from './ast';

/**
 * Traverses a Node tree and sets the `parent` property for each descendent
 * @param node - The Node to traverse
 * @public
 */
export function setParents(node: AST.Node) {
  AST.traverseNodes(node, {
    enterNode(innerNode, parent) {
      innerNode.parent = parent;
    },
    leaveNode() {
      // empty
    },
  });
}

/**
 * Creates a new VAttribute node (a static HTML attribute, not a directive).
 *
 * @example
 * ```ts
 * // class="active"
 * vAttribute(vIdentifier('class'), vLiteral('active'));
 *
 * // disabled (boolean attribute, no value)
 * vAttribute(vIdentifier('disabled'), null);
 * ```
 *
 * @param key - A VIdentifier node for the attribute name
 * @param value - A VLiteral node for the value, or null for boolean attributes
 * @returns A new VAttribute node
 * @public
 */
export function vAttribute(
  key: AST.VAttribute['key'],
  value: AST.VAttribute['value'],
): AST.VAttribute {
  return {
    type: 'VAttribute',
    directive: false,
    key,
    value,
    // @ts-expect-error Parent is not known yet
    parent: undefined,
  };
}

/**
 * Creates a new VDirective node (a Vue directive like `v-if`, `:prop`, `@click`).
 *
 * Note: VDirective has the AST type `'VAttribute'` with `directive: true`.
 *
 * @example
 * ```ts
 * // v-if="visible"
 * vDirective(
 *   vDirectiveKey(vIdentifier('if')),
 *   vExpressionContainer(builders.identifier('visible')),
 * );
 *
 * // :key="item.id"
 * vDirective(
 *   vDirectiveKey(vIdentifier('bind', ':'), vIdentifier('key')),
 *   vExpressionContainer(
 *     builders.memberExpression(builders.identifier('item'), builders.identifier('id')),
 *   ),
 * );
 * ```
 *
 * @param key - The VDirectiveKey node
 * @param value - A VExpressionContainer node, or null
 * @returns A new VDirective node
 * @public
 */
export function vDirective(
  key: AST.VDirective['key'],
  value: AST.VDirective['value'],
): AST.VDirective {
  return {
    type: 'VAttribute',
    directive: true,
    key,
    value,
    // @ts-expect-error Parent is not known yet
    parent: undefined,
  };
}

/**
 * Creates a new VDirectiveKey node
 *
 * @example
 * ```
 * v-name:argument.modifier1.modifier2
 * ```
 *
 * @param name - A VIdentifier node
 * @param argument - The directive argument, or null
 * @param modifiers - The directive modifiers
 * @returns A new VDirectiveKey node
 * @public
 */
export function vDirectiveKey(
  name: AST.VDirectiveKey['name'],
  argument: AST.VDirectiveKey['argument'] = null,
  modifiers: AST.VDirectiveKey['modifiers'] = [],
): AST.VDirectiveKey {
  return {
    type: 'VDirectiveKey',
    name,
    argument,
    modifiers,
    // @ts-expect-error Parent is not known yet
    parent: undefined,
  };
}

/**
 * Creates a new VDocumentFragment node
 * @param children - The document's children
 * @returns A new VDocumentFragment node
 * @public
 */
export function vDocumentFragment(
  children: AST.VDocumentFragment['children'],
): AST.VDocumentFragment {
  return {
    type: 'VDocumentFragment',
    children,
    // @ts-expect-error Parent is not known yet
    parent: undefined,
  };
}

/**
 * Creates a new VEndTag node
 * @param leadingComment - A HTML comment directly before the end tag, if any
 * @returns A new VEndTag node
 * @public
 */
export function vEndTag(leadingComment?: AST.HtmlComment): AST.VEndTag {
  return {
    type: 'VEndTag',
    leadingComment: leadingComment ?? null,
    // @ts-expect-error Parent is not known yet
    parent: undefined,
  };
}

/**
 * Creates a new VElement node. An end tag is created automatically unless
 * the tag is self-closing or a void element (e.g. `br`, `img`).
 *
 * @example
 * ```ts
 * // <div class="container">Hello</div>
 * vElement(
 *   'div',
 *   vStartTag([
 *     vAttribute(vIdentifier('class'), vLiteral('container')),
 *   ], false),
 *   [vText('Hello')],
 * );
 *
 * // <br /> (void element)
 * vElement('br', vStartTag([], false), []);
 *
 * // <MyComponent />
 * vElement('MyComponent', vStartTag([], true), []);
 * ```
 *
 * @param name - The tag name (e.g. `'div'` or `'MyComponent'`)
 * @param startTag - A VStartTag node
 * @param children - Child nodes (VElement, VText, VExpressionContainer)
 * @param namespace - The element's namespace (defaults to HTML)
 * @returns A new VElement node
 * @public
 */
export function vElement(
  name: string,
  startTag: AST.VStartTag,
  children: AST.VElement['children'],
  namespace: AST.VElement['namespace'] = 'http://www.w3.org/1999/xhtml',
): AST.VElement {
  return {
    type: 'VElement',
    name,
    rawName: name,
    children,
    startTag,
    namespace,
    // @ts-expect-error Parent is not known yet
    parent: undefined,
    endTag: startTag.selfClosing || voidElements[name] ? null : vEndTag(),
  };
}

/**
 * Creates a new VExpressionContainer node. Used for `{{ }}` text interpolation
 * and directive values.
 *
 * @example
 * ```ts
 * // {{ message }}
 * vExpressionContainer(builders.identifier('message'));
 *
 * // Used in a directive: v-if="show"
 * vDirective(
 *   vDirectiveKey(vIdentifier('if')),
 *   vExpressionContainer(builders.identifier('show')),
 * );
 * ```
 *
 * @param expression - The JavaScript expression node
 * @param leadingComment - If the container is a child of a VElement, a HTML comment to print before this node
 * @returns A new VExpressionContainer node
 * @public
 */
export function vExpressionContainer(
  expression: AST.VExpressionContainer['expression'],
  leadingComment?: AST.HtmlComment,
): AST.VExpressionContainer {
  return {
    type: 'VExpressionContainer',
    references: [],
    expression,
    leadingComment: leadingComment ?? null,

    // @ts-expect-error Parent is not known yet
    parent: undefined,
  };
}

/**
 * Creates a new VForExpression node
 * @example
 * ```
 * v-for="`left` in `right`"
 * ```
 * @param left - The pattern on the left side of `in`
 * @param right - The expression node on the right side of `in`
 * @returns A new VForExpression node
 * @public
 */
export function vForExpression(
  left: AST.VForExpression['left'],
  right: AST.VForExpression['right'],
): AST.VForExpression {
  return {
    type: 'VForExpression',
    left,
    right,
    // @ts-expect-error Parent is not known yet
    parent: undefined,
  };
}

/**
 * Creates a new VIdentifier node for attribute names, directive names, arguments,
 * and modifiers. The optional `rawName` controls what gets printed, which is
 * useful for directive shorthands.
 *
 * @example
 * ```ts
 * vIdentifier('class');          // prints: class
 * vIdentifier('bind', ':');      // name is 'bind', prints as ':'
 * vIdentifier('on', '@');        // name is 'on', prints as '@'
 * vIdentifier('slot', '#');      // name is 'slot', prints as '#'
 * ```
 *
 * @param name - The normalized identifier name
 * @param rawName - The value to print (defaults to `name`)
 * @returns A new VIdentifier node
 * @public
 */
export function vIdentifier(
  name: AST.VIdentifier['name'],
  rawName: AST.VIdentifier['rawName'] = name,
): AST.VIdentifier {
  return {
    type: 'VIdentifier',
    name,
    rawName,
    // @ts-expect-error Parent is not known yet
    parent: undefined,
  };
}

/**
 * Creates a new VLiteral node
 * @param value - Text value
 * @returns A new VLiteral node
 * @public
 */
export function vLiteral(value: AST.VLiteral['value']): AST.VLiteral {
  return {
    type: 'VLiteral',
    // @ts-expect-error Parent is not known yet
    parent: undefined,
    value,
  };
}

/**
 * Creates a new VStartTag node
 * @param attributes - Attributes or Directives
 * @param selfClosing - Whether the tag is self-closing. Void elements should not be self-closing
 * @param leadingComment - A HTML comment to print directly before the start tag, if any
 * @returns A new VStartTag node
 * @public
 */
export function vStartTag(
  attributes: AST.VStartTag['attributes'],
  selfClosing: AST.VStartTag['selfClosing'],
  leadingComment?: AST.HtmlComment,
): AST.VStartTag {
  return {
    type: 'VStartTag',
    attributes,
    // @ts-expect-error Parent is not known yet
    parent: undefined,
    selfClosing,
    leadingComment: leadingComment ?? null,
  };
}

/**
 * Create a new VText node
 * @param value - Text value
 * @param leadingComment - A HTML comment directly before the VText, if any
 * @returns A new VText node
 * @public
 */
export function vText(value: AST.VText['value'], leadingComment?: AST.HtmlComment): AST.VText {
  return {
    type: 'VText',
    // @ts-expect-error Parent is not known yet
    parent: undefined,
    value,
    leadingComment: leadingComment ?? null,
  };
}

/**
 * Create a new VOnExpression node
 * @param body - Expression body
 * @returns A VOnExpression node
 * @public
 */
export function vOnExpression(body: AST.VOnExpression['body']): AST.VOnExpression {
  return {
    type: 'VOnExpression',
    // @ts-expect-error Parent is not known yet
    parent: undefined,
    body,
  };
}

/**
 * Creates a new VFilterSequenceExpression node
 * @param expression - The expression to filter
 * @param filters - VFilter nodes
 * @public
 */
export function vFilterSequenceExpression(
  expression: AST.VFilterSequenceExpression['expression'],
  filters: AST.VFilterSequenceExpression['filters'],
): AST.VFilterSequenceExpression {
  return {
    type: 'VFilterSequenceExpression',
    // @ts-expect-error Parent is not known yet
    parent: undefined,
    expression,
    filters,
  };
}

/**
 * Creates a new VFilter node
 * @param callee - Identifier node
 * @param args - Filter arguments, if any
 * @public
 */
export function vFilter(
  callee: AST.VFilter['callee'],
  args: AST.VFilter['arguments'],
): AST.VFilter {
  return {
    type: 'VFilter',
    arguments: args,
    callee,
    // @ts-expect-error Parent is not known yet
    parent: undefined,
  };
}

/**
 * Creates a new HtmlComment
 * @param value The comment's inner value
 * @param leadingComment Any comment directly before this one
 * @public
 */
export function htmlComment(value: string, leadingComment?: AST.HtmlComment): AST.HtmlComment {
  return {
    type: 'HtmlComment',
    value,
    leadingComment: leadingComment ?? null,
    range: [-1, -1],
  };
}
