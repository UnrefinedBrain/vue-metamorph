/* eslint-disable @typescript-eslint/no-use-before-define */

import * as recast from 'recast';
import * as AST from './ast';

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

      // @ts-expect-error We shouldn't hit this case if the types are correct
      default: throw new Error(`Unexpected argument type: ${node.argument.type}`);
    }
  }

  if (node.modifiers.length > 0) {
    for (const modifier of node.modifiers) {
      str += `.${stringifyVIdentifier(modifier)}`;
    }
  }

  return str;
}

export function stringifyVLiteral(node: AST.VLiteral): string {
  return node.value;
}

export function stringifyVAttribute(node: AST.VAttribute | AST.VDirective): string {
  let str = node.directive
    ? stringifyVDirectiveKey(node.key)
    : node.key.rawName;

  if (node.value) {
    str += `="${stringify(node.value)}"`;
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function stringifyVEndTag(_node: AST.VEndTag): string {
  return '';
}

export function stringifyVElement(node: AST.VElement): string {
  let str = `<${node.rawName}`;

  str += stringifyVStartTag(node.startTag, voidElements[node.rawName] ?? false);
  str += '>';

  if (!node.startTag.selfClosing && !voidElements[node.rawName]) {
    for (const child of node.children) {
      if (child.type === 'VExpressionContainer') {
        str += '{{ ';
      }
      str += stringify(child);

      if (child.type === 'VExpressionContainer') {
        str += ' }}';
      }
    }

    str += `</${node.rawName}>`;
  }

  return str;
}

export function stringifyVExpressionContainer(node: AST.VExpressionContainer): string {
  if (!node.expression) {
    return '';
  }

  if (node.expression.type === 'VSlotScopeExpression'
    || node.expression.type === 'VForExpression'
    || node.expression.type === 'VOnExpression'
    || node.expression.type === 'VFilterSequenceExpression') {
    return stringify(node.expression);
  }

  return stringifyWithRecast(node.expression);
}

export function stringifyVFilterSequenceExpression(node: AST.VFilterSequenceExpression): string {
  let str = stringifyWithRecast(node.expression);

  for (const filter of node.filters) {
    str += ` | ${stringifyWithRecast(filter.callee)}`;
  }

  return str;
}

export function stringifyVForExpression(node: AST.VForExpression): string {
  let str = '';
  const multiple = node.left.length > 1;

  if (multiple) {
    str += '(';
  }

  str += node.left
    .map(stringifyWithRecast)
    .join(', ');

  if (multiple) {
    str += ')';
  }

  str += ` in ${stringifyWithRecast(node.right)}`;

  return str;
}

export function stringifyVOnExpression(node: AST.VOnExpression): string {
  return node.body[0] ? stringifyWithRecast(node.body[0]) : '';
}

export function stringifyVSlotScopeExpression(node: AST.VSlotScopeExpression): string {
  return node.params[0] ? stringifyWithRecast(node.params[0]) : '';
}

export function stringifyVText(node: AST.VText): string {
  return node.value;
}

export function stringifyVDocumentFragment(node: AST.VDocumentFragment): string {
  return node.children.map(stringify).join('');
}

export function stringify(node: AST.Node): string {
  switch (node.type) {
    case 'VAttribute': return stringifyVAttribute(node);
    case 'VDirectiveKey': return stringifyVDirectiveKey(node);
    case 'VElement': return stringifyVElement(node);
    case 'VEndTag': return stringifyVEndTag(node);
    case 'VExpressionContainer': return stringifyVExpressionContainer(node);
    case 'VIdentifier': return stringifyVIdentifier(node);
    case 'VLiteral': return stringifyVLiteral(node);
    case 'VStartTag': return stringifyVStartTag(node);
    case 'VText': return stringifyVText(node);
    case 'VForExpression': return stringifyVForExpression(node);
    case 'VOnExpression': return stringifyVOnExpression(node);
    case 'VSlotScopeExpression': return stringifyVSlotScopeExpression(node);
    case 'VFilterSequenceExpression': return stringifyVFilterSequenceExpression(node);
    case 'VDocumentFragment': return stringifyVDocumentFragment(node);
    default: return stringifyWithRecast(node);
  }
}
