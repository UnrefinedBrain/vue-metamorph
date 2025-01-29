import * as vueParser from 'vue-eslint-parser';
import * as recast from 'recast-x';
import htmlParser from 'node-html-parser';
import { VueProgram } from '../types';
import { findAll } from '../ast-helpers';
import * as AST from '../ast';
import { tsParser } from './typescript';
import { getLangAttribute, isSupportedLang, parseCss } from './css';

/**
 * Parse Vue code
 * @param code Source code
 * @returns SFC AST and Script AST
 */
export function parseVue(code: string) {
  const extraTemplate = '\n<template></template>';
  let neededExtraTemplate = false;
  if (!htmlParser.parse(code).querySelector('template')) {
    // hack: if no <template> is present, templateBody will be null
    // and we cannot access the VDocumentFragment
    code += extraTemplate;
    neededExtraTemplate = true;
  }

  const sfcAST = vueParser.parse(code, {
    parser: tsParser(true),
    sourceType: 'module',
  });

  const comments = (sfcAST.templateBody!.comments ?? [])
    .map((token): AST.HtmlComment => ({
      type: 'HtmlComment',
      value: token.value,
      range: token.range,
      leadingComment: null,
    }));

  const canHaveLeadingComment: AST.HasLeadingComment[] = [...comments];
  const positionLookup = new Map<number, AST.Node | AST.HtmlComment>();

  vueParser.AST.traverseNodes(sfcAST.templateBody!.parent as vueParser.AST.VDocumentFragment, {
    enterNode(node) {
      const prev = positionLookup.get(node.range[0] - 1);
      if (prev?.type === 'HtmlComment') {
        (node as unknown as AST.HasLeadingComment).leadingComment = prev;
      }

      if (node.type === 'VText'
        || node.type === 'VExpressionContainer'
        || node.type === 'VEndTag'
        || node.type === 'VStartTag'
      ) {
        canHaveLeadingComment.push(node as never);
      }
    },

    leaveNode() {
      // empty
    },
  });

  comments.forEach((comment) => {
    const [, end] = comment.range;
    positionLookup.set(end - 1, comment);
  });

  canHaveLeadingComment.forEach((node) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adjacentNode = positionLookup.get((node as any).range[0] - 1);
    if (adjacentNode?.type === 'HtmlComment') {
      node.leadingComment = adjacentNode;
    } else {
      node.leadingComment = null;
    }
  });

  const scripts = findAll(sfcAST.templateBody!.parent as unknown as AST.VDocumentFragment, {
    type: 'VElement',
    name: 'script',
  }) as unknown as vueParser.AST.VElement[];

  const styles = findAll(sfcAST.templateBody!.parent as unknown as AST.VDocumentFragment, {
    type: 'VElement',
    name: 'style',
  }) as unknown as vueParser.AST.VElement[];

  const scriptASTs = scripts
    .filter((el) => el.children.length > 0)
    .map((el) => {
    // hack: make the source locations line up properly
      const blankLines = '\n'.repeat(el.loc.start.line - 1);
      const start = el.children[0]?.range[0];
      const end = el.children[0]?.range[1];

      const isJsx = el.startTag.attributes.some((attr) => !attr.directive && attr.key.rawName === 'lang' && attr.value && ['jsx', 'tsx'].includes(attr.value.value));

      const ast = recast.parse(`/* METAMORPH_START */${blankLines}${code.slice(start, end)}`, {
        parser: tsParser(isJsx),
      }).program as VueProgram;

      ast.isScriptSetup = el.startTag.attributes.some((attr) => !attr.directive && attr.key.rawName === 'setup');

      return ast;
    });

  const styleASTs = styles
    .filter((el) => el.children.length > 0 && isSupportedLang(getLangAttribute(el as never)))
    .map((el) => {
      // hack: make the source locations line up properly
      const blankLines = '\n'.repeat(el.loc.start.line - 1);
      const start = el.children[0]?.range[0];
      const end = el.children.at(-1)!.range[1];

      const lang = getLangAttribute(el as never);

      return parseCss(`/* METAMORPH_START */${blankLines}${code.slice(start, end)}`, lang);
    });

  if (neededExtraTemplate) {
    sfcAST.templateBody!.parent!.range[1] -= extraTemplate.length;
    sfcAST.templateBody!.parent!.end! -= extraTemplate.length;
  }

  return {
    neededExtraTemplate,
    sfcAST,
    scriptASTs,
    styleASTs,
  };
}
