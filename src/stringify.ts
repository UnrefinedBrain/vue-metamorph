/* eslint-disable @typescript-eslint/no-use-before-define */

import * as recast from './vendor/recast/main';
import * as AST from './ast';

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
export type PrintContext = {
  /**
   * The source code that the AST was parsed from.
   */
  source: string;

  /**
   * Returns whether a node and everything under it is unchanged since the parse.
   */
  isClean: (node: AST.Node) => boolean;
};

let printContext: PrintContext | null = null;

/**
 * Runs `print` with a print context, so that the stringify functions copy the original source text
 * for the nodes that no codemod touched. Without a context they print every node from scratch.
 *
 * @param context - The source code and the cleanliness test to print against.
 * @param print - The function that does the printing.
 * @returns Whatever `print` returns.
 * @public
 */
export function withPrintContext<T>(context: PrintContext, print: () => T): T {
  const previous = printContext;
  printContext = context;
  try {
    return print();
  } finally {
    printContext = previous;
  }
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
function originalSource(node: AST.Node): string | null {
  const context = printContext;

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

function childFieldNames(node: recast.types.ASTNode): readonly string[] {
  return vueExpressionChildFields[node.type] ?? recast.types.getFieldNames(node);
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

  const record = node as Record<string, any>;

  if (record.type === 'Literal' && typeof record.value === 'string') {
    const original = record.value;
    restore.push(() => {
      record.value = original;
    });
    record.value = escapeAttributeValue(original);
    return;
  }

  if (record.type === 'TemplateElement' && record.value) {
    const { raw, cooked } = record.value;
    restore.push(() => {
      record.value.raw = raw;
      record.value.cooked = cooked;
    });
    record.value.raw = escapeAttributeValue(raw);
    if (typeof cooked === 'string') {
      record.value.cooked = escapeAttributeValue(cooked);
    }
    return;
  }

  for (const key of childFieldNames(record as recast.types.ASTNode)) {
    escapeExpressionStrings(record[key], restore);
  }
}

function stringifyExpressionAttributeValue(node: AST.VExpressionContainer): string {
  const restore: (() => void)[] = [];
  escapeExpressionStrings(node.expression, restore);

  try {
    return stringifyVExpressionContainer(node);
  } finally {
    restore.forEach((fn) => fn());
  }
}

export function stringifyVLiteral(node: AST.VLiteral): string {
  return `"${escapeAttributeValue(node.value)}"`;
}

export function stringifyVAttribute(node: AST.VAttribute | AST.VDirective): string {
  const original = originalSource(node);

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
      str += `="${escapeAttributeValue(stringify(node.value))}"`;
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
function stringifyVStartTagFromSource(node: AST.VStartTag, isVoidElement: boolean): string | null {
  const context = printContext;
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

    str += stringifyVAttribute(attribute);
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

export function stringifyVStartTag(node: AST.VStartTag, isVoidElement = false): string {
  const fromSource = stringifyVStartTagFromSource(node, isVoidElement);

  if (fromSource !== null) {
    return fromSource;
  }

  let str = '';

  for (const attribute of node.attributes) {
    str += ` ${stringifyVAttribute(attribute)}`;
  }

  if (node.selfClosing && !isVoidElement) {
    str += ' /';
  }

  return str;
}

export function stringifyVEndTag(node: AST.VEndTag): string {
  return stringifyHtmlComment(node.leadingComment);
}

export function stringifyVElement(node: AST.VElement): string {
  let str = `${stringifyHtmlComment(node.startTag.leadingComment)}<${node.rawName}`;

  str += stringifyVStartTag(node.startTag, voidElements[node.rawName] ?? false);
  str += '>';

  if (!node.startTag.selfClosing && !voidElements[node.rawName]) {
    for (const child of node.children) {
      if (child.type === 'VExpressionContainer') {
        str += stringifyHtmlComment(child.leadingComment);
        str += '{{ ';
      }
      str += stringify(child);

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

export function stringifyVDocumentFragment(node: AST.VDocumentFragment): string {
  return node.children.map(stringify).join('');
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

export function stringify(node: AST.Node): string {
  const original = originalSource(node);

  if (original !== null) {
    return original;
  }

  switch (node.type) {
    case 'VAttribute':
      return stringifyVAttribute(node);
    case 'VDirectiveKey':
      return stringifyVDirectiveKey(node);
    case 'VElement':
      return stringifyVElement(node);
    case 'VEndTag':
      return stringifyVEndTag(node);
    case 'VExpressionContainer':
      return stringifyVExpressionContainer(node);
    case 'VIdentifier':
      return stringifyVIdentifier(node);
    case 'VLiteral':
      return stringifyVLiteral(node);
    case 'VStartTag':
      return stringifyVStartTag(node);
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
      return stringifyVDocumentFragment(node);
    case 'VGenericExpression':
      return stringifyVGenericExpression(node);
    default:
      return stringifyWithRecast(node);
  }
}
