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

export function stringifyVStartTag(node: AST.VStartTag, isVoidElement = false): string {
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
