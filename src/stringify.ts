/* eslint-disable @typescript-eslint/no-use-before-define */

import * as recast from './vendor/recast/main';
import * as AST from './ast';
import { getProperty, getStringProperty } from './object-access';

// The void elements, as listed in the HTML markup specification:
// https://www.w3.org/TR/2011/WD-html-markup-20110113/syntax.html#syntax-elements
export const voidElements: Record<string, true> = {
  area: true,
  base: true,
  br: true,
  col: true,
  command: true,
  embed: true,
  hr: true,
  img: true,
  input: true,
  keygen: true,
  link: true,
  meta: true,
  param: true,
  source: true,
  track: true,
  wbr: true,
};

/**
 * Everything the printer needs in order to reuse the formatting of the file it parsed.
 * @public
 */
export interface PrintContext {
  /**
   * The source code that the AST was parsed from.
   */
  source: string;

  /**
   * Returns whether a node and everything under it is unchanged since the parse.
   */
  isClean: (node: AST.Node) => boolean;
}

// The other node types either have ranges that don't line up with what the printer emits, or get
// wrapped in delimiters that their own range doesn't cover. VExpressionContainer is the clearest
// example: its range covers the `{{ }}` that stringifyVElement adds around the printed child.
const SOURCE_REUSABLE_TYPES = new Set<string>(['VElement', 'VAttribute', 'VText']);

function rangeOf(node: unknown): [number, number] | null {
  const range = (node as { range?: unknown } | null)?.range;

  if (!Array.isArray(range) || range.length !== 2) {
    return null;
  }

  const [start, end] = range as [number, number];

  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start) {
    return null;
  }

  return [start, end];
}

// A leading comment sits outside the range of the node that carries it, so reusing that range
// would drop the comment.
function hasLeadingComment(node: AST.Node): boolean {
  if (node.type === 'VElement') {
    return !!node.startTag.leadingComment || !!node.endTag?.leadingComment;
  }

  return !!(node as { leadingComment?: AST.HtmlComment | null }).leadingComment;
}

/**
 * Returns the original source text of a node, or null when the printer has to build the text
 * itself. The text is reusable only when a context is set, the node type prints as the exact span
 * that its range covers, the range fits inside the source, and no codemod touched the node.
 */
function originalSource(node: AST.Node, context?: PrintContext): string | null {
  if (!context || !SOURCE_REUSABLE_TYPES.has(node.type) || hasLeadingComment(node)) {
    return null;
  }

  const range = rangeOf(node);

  if (!range || range[1] > context.source.length || !context.isClean(node)) {
    return null;
  }

  return context.source.slice(range[0], range[1]);
}

function stringifyWithRecast(node: recast.types.ASTNode) {
  return recast.prettyPrint(node, {
    quote: 'single',
    tabWidth: 2,
    trailingComma: true,
  }).code;
}

export function stringifyVIdentifier(node: AST.VIdentifier): string {
  return node.rawName;
}

const shorthands: Record<string, string> = {
  bind: ':',
  on: '@',
  slot: '#',
  generic: 'generic',
};

export function stringifyVDirectiveKey(node: AST.VDirectiveKey): string {
  let str = '';
  let shorthand = false;

  if (shorthands[node.name.name] && shorthands[node.name.name] === node.name.rawName) {
    shorthand = true;
    str += node.name.rawName;
  } else {
    str += `v-${stringifyVIdentifier(node.name)}`;
  }

  if (node.argument) {
    if (!shorthand) {
      str += ':';
    }

    switch (node.argument.type) {
      case 'VExpressionContainer': {
        str += '[';
        str += stringifyVExpressionContainer(node.argument);
        str += ']';
        break;
      }

      case 'VIdentifier': {
        str += stringifyVIdentifier(node.argument);
        break;
      }

      default:
        // @ts-expect-error This case is unreachable when the types are correct.
        throw new Error(`Unexpected argument type: ${node.argument.type}`);
    }
  }

  if (node.modifiers.length > 0) {
    for (const modifier of node.modifiers) {
      str += `.${stringifyVIdentifier(modifier)}`;
    }
  }

  return str;
}

function escapeAttributeValue(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

const vueExpressionChildFields: Record<string, readonly string[]> = {
  VForExpression: ['left', 'right'],
  VOnExpression: ['body'],
  VSlotScopeExpression: ['params'],
  VFilterSequenceExpression: ['expression', 'filters'],
  VFilter: ['callee', 'arguments'],
  VGenericExpression: ['params'],
};

function nodeType(node: object): string | undefined {
  return getStringProperty(node, 'type');
}

function childFieldNames(node: object): readonly string[] {
  const type = nodeType(node);
  const vueChildFields = type === undefined ? undefined : vueExpressionChildFields[type];

  return vueChildFields ?? recast.types.getFieldNames(node);
}

/**
 * A `Literal` node whose value is a string, the only kind of literal that needs escaping.
 */
interface StringLiteralNode {
  value: string;
}

/**
 * A `TemplateElement` node. Its `raw` text always needs escaping, and its `cooked` text needs
 * escaping when the node has one.
 */
interface TemplateElementNode {
  value: { raw: string; cooked?: unknown };
}

function isStringLiteral(node: object): node is StringLiteralNode {
  if (nodeType(node) !== 'Literal' || !('value' in node)) {
    return false;
  }

  return typeof node.value === 'string';
}

function isTemplateElement(node: object): node is TemplateElementNode {
  if (nodeType(node) !== 'TemplateElement' || !('value' in node)) {
    return false;
  }

  const { value } = node;

  return !!value && typeof value === 'object' && 'raw' in value && typeof value.raw === 'string';
}

function escapeExpressionStrings(node: unknown, restore: (() => void)[]): void {
  if (!node || typeof node !== 'object') {
    return;
  }

  if (Array.isArray(node)) {
    for (const child of node) {
      escapeExpressionStrings(child, restore);
    }
    return;
  }

  if (isStringLiteral(node)) {
    const original = node.value;
    restore.push(() => {
      node.value = original;
    });
    node.value = escapeAttributeValue(original);
    return;
  }

  if (isTemplateElement(node)) {
    const { raw, cooked } = node.value;
    restore.push(() => {
      node.value.raw = raw;
      node.value.cooked = cooked;
    });
    node.value.raw = escapeAttributeValue(raw);
    if (typeof cooked === 'string') {
      node.value.cooked = escapeAttributeValue(cooked);
    }
    return;
  }

  for (const key of childFieldNames(node)) {
    escapeExpressionStrings(getProperty(node, key), restore);
  }
}

/**
 * Temporarily escapes string values for an HTML attribute, then restores the AST even if
 * escaping or printing throws. Recast needs the escaped values while it prints JavaScript;
 * escaping the resulting JavaScript text would also change its operators and delimiters.
 */
function withEscapedExpressionStrings<T>(node: AST.VExpressionContainer, print: () => T): T {
  const restore: Array<() => void> = [];
  try {
    escapeExpressionStrings(node.expression, restore);
    return print();
  } finally {
    // Restore in reverse order in case multiple paths reach the same object.
    for (const restoreValue of restore.reverse()) {
      restoreValue();
    }
  }
}

function stringifyExpressionAttributeValue(node: AST.VExpressionContainer): string {
  return withEscapedExpressionStrings(node, () => stringifyVExpressionContainer(node));
}

export function stringifyVLiteral(node: AST.VLiteral): string {
  return `"${escapeAttributeValue(node.value)}"`;
}

export function stringifyVAttribute(
  node: AST.VAttribute | AST.VDirective,
  context?: PrintContext,
): string {
  const original = originalSource(node, context);

  if (original !== null) {
    return original;
  }

  let str = node.directive ? stringifyVDirectiveKey(node.key) : node.key.rawName;

  if (node.value) {
    if (node.value.type === 'VLiteral') {
      str += `="${escapeAttributeValue(node.value.value)}"`;
    } else if (node.value.type === 'VExpressionContainer') {
      str += `="${stringifyExpressionAttributeValue(node.value)}"`;
    } else {
      str += `="${escapeAttributeValue(stringify(node.value, context))}"`;
    }
  }

  return str;
}

function isWhitespace(text: string): boolean {
  return text.trim() === '';
}

/**
 * Prints the inside of a start tag, from the end of the tag name up to the `>` or `/>`, keeping
 * the whitespace that separated the attributes in the original source. Returns null when the tag
 * can't be matched up with the source, in which case the caller falls back to printing the
 * attributes one space apart.
 *
 * An attribute contributes its original separator only when that separator is still whitespace.
 * When a codemod removes an attribute, the gap in front of the next attribute covers the removed
 * text, so the separator collapses to a single space instead of reprinting what was removed.
 */
function stringifyVStartTagFromSource(
  node: AST.VStartTag,
  isVoidElement: boolean,
  context?: PrintContext,
): string | null {
  const tagRange = rangeOf(node);
  const element = node.parent;

  if (!context || !tagRange || element?.type !== 'VElement') {
    return null;
  }

  const [tagStart, tagEnd] = tagRange;

  if (tagEnd > context.source.length) {
    return null;
  }

  const selfClosing = node.selfClosing && !isVoidElement;
  const attributesStart = tagStart + 1 + element.rawName.length;

  // Make sure the range really points at the tag this node came from. A mismatch means the node
  // was renamed, moved, or rebuilt, so its range says nothing about the source.
  if (
    context.source[tagEnd - 1] !== '>' ||
    context.source.slice(tagStart, attributesStart) !== `<${element.rawName}`
  ) {
    return null;
  }

  // Find the closing delimiter in the source rather than trusting node.selfClosing, which a
  // codemod may have toggled since the parse. The `/` counts as the delimiter only when it sits
  // outside every attribute, so an unquoted value that ends in `/` isn't mistaken for one.
  const lastAttributeEnd = node.attributes.reduce(
    (end, attribute) => Math.max(end, rangeOf(attribute)?.[1] ?? attributesStart),
    attributesStart,
  );
  const closesWithSlash = context.source[tagEnd - 2] === '/' && lastAttributeEnd <= tagEnd - 2;
  const attributesEnd = tagEnd - (closesWithSlash ? 2 : 1);

  if (attributesEnd < attributesStart) {
    return null;
  }

  let str = '';
  let cursor = attributesStart;

  for (const attribute of node.attributes) {
    const attributeRange = rangeOf(attribute);
    const separator =
      attributeRange && attributeRange[0] >= cursor && attributeRange[1] <= attributesEnd
        ? context.source.slice(cursor, attributeRange[0])
        : null;

    if (separator !== null && isWhitespace(separator)) {
      str += separator;
      cursor = attributeRange![1];
    } else {
      str += ' ';
    }

    str += stringifyVAttribute(attribute, context);
  }

  // The whitespace in front of the closing delimiter belongs to the closing form that the source
  // used, so it only carries over while a codemod leaves that form alone.
  const trailing =
    closesWithSlash === selfClosing ? context.source.slice(cursor, attributesEnd) : '';
  str += isWhitespace(trailing) ? trailing : '';

  if (selfClosing) {
    str += str.endsWith(' ') || str.endsWith('\n') ? '/' : ' /';
  }

  return str;
}

export function stringifyVStartTag(
  node: AST.VStartTag,
  isVoidElement = false,
  context?: PrintContext,
): string {
  const fromSource = stringifyVStartTagFromSource(node, isVoidElement, context);

  if (fromSource !== null) {
    return fromSource;
  }

  let str = '';

  for (const attribute of node.attributes) {
    str += ` ${stringifyVAttribute(attribute, context)}`;
  }

  if (node.selfClosing && !isVoidElement) {
    str += ' /';
  }

  return str;
}

export function stringifyVEndTag(node: AST.VEndTag): string {
  return stringifyHtmlComment(node.leadingComment);
}

export function stringifyVElement(node: AST.VElement, context?: PrintContext): string {
  let str = `${stringifyHtmlComment(node.startTag.leadingComment)}<${node.rawName}`;

  str += stringifyVStartTag(node.startTag, voidElements[node.rawName] ?? false, context);
  str += '>';

  if (!node.startTag.selfClosing && !voidElements[node.rawName]) {
    for (const child of node.children) {
      if (child.type === 'VExpressionContainer') {
        str += stringifyHtmlComment(child.leadingComment);
        str += '{{ ';
      }
      str += stringify(child, context);

      if (child.type === 'VExpressionContainer') {
        str += ' }}';
      }
    }
    if (node.endTag) {
      str += stringifyVEndTag(node.endTag);
    }
    str += `</${node.rawName}>`;
  }

  return str;
}

/** Prints a complete source replacement, including an expression container's delimiters. */
export function stringifyTemplateReplacement(node: AST.Node, context?: PrintContext): string {
  if (node.type !== 'VExpressionContainer') {
    return stringify(node, context);
  }

  if (node.parent.type === 'VAttribute') {
    return `"${stringifyExpressionAttributeValue(node)}"`;
  }
  if (node.parent.type === 'VDirectiveKey') {
    return `[${stringifyVExpressionContainer(node)}]`;
  }
  if (node.parent.type === 'VElement' && node.parent.name === 'style') {
    return `v-bind(${stringifyVExpressionContainer(node)})`;
  }
  return `${stringifyHtmlComment(node.leadingComment)}{{ ${stringifyVExpressionContainer(node)} }}`;
}

export function stringifyVExpressionContainer(node: AST.VExpressionContainer): string {
  if (!node.expression) {
    return '';
  }

  if (
    node.expression.type === 'VSlotScopeExpression' ||
    node.expression.type === 'VForExpression' ||
    node.expression.type === 'VOnExpression' ||
    node.expression.type === 'VFilterSequenceExpression' ||
    node.expression.type === 'VGenericExpression'
  ) {
    return stringify(node.expression);
  }

  return stringifyWithRecast(node.expression);
}

export function stringifyVFilterSequenceExpression(node: AST.VFilterSequenceExpression): string {
  let str = stringifyWithRecast(node.expression);

  for (const filter of node.filters) {
    str += ` | ${stringifyWithRecast(filter.callee)}`;

    if (filter.arguments.length) {
      str += '(';
      str += filter.arguments.map(stringifyWithRecast).join(', ');
      str += ')';
    }
  }

  return str;
}

export function stringifyVForExpression(node: AST.VForExpression): string {
  let str = '';
  const multiple = node.left.length > 1;

  if (multiple) {
    str += '(';
  }

  str += node.left.map(stringifyWithRecast).join(', ');

  if (multiple) {
    str += ')';
  }

  str += ` in ${stringifyWithRecast(node.right)}`;

  return str;
}

export function stringifyVOnExpression(node: AST.VOnExpression): string {
  return node.body.map(stringifyWithRecast).join(' ');
}

export function stringifyVSlotScopeExpression(node: AST.VSlotScopeExpression): string {
  return node.params[0] ? stringifyWithRecast(node.params[0]) : '';
}

export function stringifyVText(node: AST.VText): string {
  return stringifyHtmlComment(node.leadingComment) + node.value;
}

export function stringifyVDocumentFragment(
  node: AST.VDocumentFragment,
  context?: PrintContext,
): string {
  return node.children.map((child) => stringify(child, context)).join('');
}

export function stringifyVGenericExpression(node: AST.VGenericExpression): string {
  return node.params.map(stringifyWithRecast).join(', ');
}

export function stringifyHtmlComment(node: AST.HtmlComment | null) {
  if (!node) {
    return '';
  }

  if (node.value.includes('-->') || node.value.includes('--!>') || node.value.includes('<!--')) {
    throw new Error(
      `HTML comment value contains a comment terminator: ${JSON.stringify(node.value)}`,
    );
  }

  let leadingComments = '';
  if (node.leadingComment) {
    leadingComments += stringifyHtmlComment(node.leadingComment);
  }

  return `${leadingComments}<!--${node.value}-->`;
}

export function stringify(node: AST.Node, context?: PrintContext): string {
  const original = originalSource(node, context);

  if (original !== null) {
    return original;
  }

  switch (node.type) {
    case 'VAttribute':
      return stringifyVAttribute(node, context);
    case 'VDirectiveKey':
      return stringifyVDirectiveKey(node);
    case 'VElement':
      return stringifyVElement(node, context);
    case 'VEndTag':
      return stringifyVEndTag(node);
    case 'VExpressionContainer':
      return stringifyVExpressionContainer(node);
    case 'VIdentifier':
      return stringifyVIdentifier(node);
    case 'VLiteral':
      return stringifyVLiteral(node);
    case 'VStartTag':
      return stringifyVStartTag(node, false, context);
    case 'VText':
      return stringifyVText(node);
    case 'VForExpression':
      return stringifyVForExpression(node);
    case 'VOnExpression':
      return stringifyVOnExpression(node);
    case 'VSlotScopeExpression':
      return stringifyVSlotScopeExpression(node);
    case 'VFilterSequenceExpression':
      return stringifyVFilterSequenceExpression(node);
    case 'VDocumentFragment':
      return stringifyVDocumentFragment(node, context);
    case 'VGenericExpression':
      return stringifyVGenericExpression(node);
    default:
      return stringifyWithRecast(node);
  }
}
