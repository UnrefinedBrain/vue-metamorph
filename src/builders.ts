import { voidElements } from './stringify';
import * as AST from './ast';

/**
 * Traverses a node tree and sets the `parent` property on every descendant.
 * @param node - The node to traverse.
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
 * Creates a `VAttribute` node, which is a static HTML attribute rather than a directive.
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
 * @param key - A `VIdentifier` node for the attribute name.
 * @param value - A `VLiteral` node for the value, or `null` for a boolean attribute.
 * @returns A new `VAttribute` node.
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
 * Creates a `VDirective` node, which represents a Vue directive such as `v-if`, `:prop`, or
 * `@click`.
 *
 * Note that a `VDirective` node has the AST type `'VAttribute'` with `directive: true`.
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
 * @param key - The `VDirectiveKey` node.
 * @param value - A `VExpressionContainer` node, or `null`.
 * @returns A new `VDirective` node.
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
 * Creates a `VDirectiveKey` node.
 *
 * @example
 * ```
 * v-name:argument.modifier1.modifier2
 * ```
 *
 * @param name - A `VIdentifier` node for the directive name.
 * @param argument - The directive argument, or `null`.
 * @param modifiers - The directive modifiers.
 * @returns A new `VDirectiveKey` node.
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
 * Creates a `VDocumentFragment` node.
 * @param children - The child nodes of the document.
 * @returns A new `VDocumentFragment` node.
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
 * Creates a `VEndTag` node.
 * @param leadingComment - An HTML comment to print directly before the end tag, if any.
 * @returns A new `VEndTag` node.
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
 * Creates a `VElement` node. This function creates an end tag automatically, unless the tag is
 * self-closing or a void element such as `br` or `img`.
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
 * @param name - The tag name, such as `'div'` or `'MyComponent'`.
 * @param startTag - A `VStartTag` node.
 * @param children - The child nodes: `VElement`, `VText`, or `VExpressionContainer` nodes.
 * @param namespace - The namespace of the element. Defaults to the HTML namespace.
 * @returns A new `VElement` node.
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
 * Creates a `VExpressionContainer` node, which holds either `{{ }}` text interpolation or a
 * directive value.
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
 * @param expression - The JavaScript expression node.
 * @param leadingComment - An HTML comment to print directly before this node. vue-metamorph
 * prints the comment only when the container is a child of a `VElement`.
 * @returns A new `VExpressionContainer` node.
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
 * Creates a `VForExpression` node.
 * @example
 * ```
 * v-for="`left` in `right`"
 * ```
 * @param left - The pattern on the left side of `in`.
 * @param right - The expression node on the right side of `in`.
 * @returns A new `VForExpression` node.
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
 * Creates a `VIdentifier` node for an attribute name, a directive name, a directive argument, or
 * a directive modifier. The optional `rawName` parameter controls what vue-metamorph prints,
 * which is useful for directive shorthands.
 *
 * @example
 * ```ts
 * vIdentifier('class');          // prints: class
 * vIdentifier('bind', ':');      // name is 'bind', prints as ':'
 * vIdentifier('on', '@');        // name is 'on', prints as '@'
 * vIdentifier('slot', '#');      // name is 'slot', prints as '#'
 * ```
 *
 * @param name - The normalized identifier name.
 * @param rawName - The value to print. Defaults to `name`.
 * @returns A new `VIdentifier` node.
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
 * Creates a `VLiteral` node, which holds the quoted value of a static attribute.
 * @param value - The text value.
 * @returns A new `VLiteral` node.
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
 * Creates a `VStartTag` node.
 * @param attributes - The `VAttribute` and `VDirective` nodes on the tag.
 * @param selfClosing - Whether the tag is self-closing. A void element must not be self-closing.
 * @param leadingComment - An HTML comment to print directly before the start tag, if any.
 * @returns A new `VStartTag` node.
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
 * Creates a `VText` node, which holds plain text inside an element.
 * @param value - The text value.
 * @param leadingComment - An HTML comment to print directly before the text, if any.
 * @returns A new `VText` node.
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
 * Creates a `VOnExpression` node, which holds the statements of a `v-on` directive.
 * @param body - The statements in the expression.
 * @returns A new `VOnExpression` node.
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
 * Creates a `VFilterSequenceExpression` node, which represents Vue 2 filter syntax.
 * @param expression - The expression to filter.
 * @param filters - The `VFilter` nodes to apply.
 * @returns A new `VFilterSequenceExpression` node.
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
 * Creates a `VFilter` node, which represents one filter in a Vue 2 filter sequence.
 * @param callee - An `Identifier` node for the filter name.
 * @param args - The filter arguments, if any.
 * @returns A new `VFilter` node.
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
 * Creates an `HtmlComment` node. To attach the comment to another node, set the
 * `leadingComment` property of that node.
 * @param value - The text inside the comment.
 * @param leadingComment - An HTML comment to print directly before this one, if any.
 * @returns A new `HtmlComment` node.
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
