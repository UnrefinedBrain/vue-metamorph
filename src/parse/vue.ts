import * as vueParser from 'vue-eslint-parser';
import htmlParser from 'node-html-parser';
import type postcss from 'postcss';
import { VueProgram } from '../types';
import { findAll } from '../ast-helpers';
import * as AST from '../ast';
import { getLoc, getRange, hasRange } from '../node-range';
import { toPluginAST } from '../plugin-ast';
import { parseTs, tsParser } from './typescript';
import { getLangAttribute, isSupportedLang, parseCss } from './css';

/**
 * Parses Vue source code.
 * @param code - The source code.
 * @returns The SFC AST, the script ASTs, and the style roots.
 */
export function parseVue(code: string): {
  neededExtraTemplate: boolean;
  sfcAST: vueParser.AST.ESLintProgram;
  scriptASTs: VueProgram[];
  styleASTs: postcss.Root[];
  sfcTemplate: AST.VDocumentFragment;
  scriptASTMap: Map<AST.VElement, VueProgram>;
  styleASTMap: Map<AST.VElement, postcss.Root>;
  originalScripts: Set<AST.VElement>;
  originalStyles: Set<AST.VElement>;
} {
  const extraTemplate = '\n<template></template>';
  let neededExtraTemplate = false;
  if (!htmlParser.parse(code).querySelector('template')) {
    // If the SFC has no <template>, templateBody is null and the VDocumentFragment isn't
    // reachable, so parse a placeholder template to get one.
    code += extraTemplate;
    neededExtraTemplate = true;
  }

  const sfcAST: vueParser.AST.ESLintProgram = vueParser.parse(code, {
    parser: tsParser(true),
    sourceType: 'module',
  });

  const comments = (sfcAST.templateBody!.comments ?? []).map(
    (token): AST.HtmlComment => ({
      type: 'HtmlComment',
      value: token.value,
      range: token.range,
      leadingComment: null,
    }),
  );

  const documentFragment = sfcAST.templateBody?.parent;

  if (documentFragment?.type !== 'VDocumentFragment') {
    throw new Error('Expected the parsed SFC to have a VDocumentFragment at its root.');
  }

  // Comments go in the list too, because a comment can follow another comment.
  const canHaveLeadingComment: (AST.HtmlComment | vueParser.AST.Node)[] = [...comments];

  vueParser.AST.traverseNodes(documentFragment, {
    enterNode(node) {
      if (
        node.type === 'VText' ||
        node.type === 'VExpressionContainer' ||
        node.type === 'VEndTag' ||
        node.type === 'VStartTag'
      ) {
        canHaveLeadingComment.push(node);
      }
    },

    leaveNode() {
      // empty
    },
  });

  const positionLookup = new Map<number, AST.HtmlComment>();

  comments.forEach((comment) => {
    const [, end] = comment.range;
    positionLookup.set(end - 1, comment);
  });

  canHaveLeadingComment.forEach((node) => {
    // Built nodes have no range, and so have no comment sitting in front of them.
    const adjacentNode = hasRange(node) ? positionLookup.get(node.range[0] - 1) : undefined;

    Object.assign(node, { leadingComment: adjacentNode ?? null });
  });

  const sfcTemplate = toPluginAST(documentFragment);

  const scripts = findAll(sfcTemplate, {
    type: 'VElement',
    name: 'script',
  });

  const styles = findAll(sfcTemplate, {
    type: 'VElement',
    name: 'style',
  });

  const scriptASTMap = new Map<AST.VElement, VueProgram>();
  const scriptASTs: VueProgram[] = [];
  for (const el of scripts) {
    if (el.children.length === 0) continue;

    // Offset the source locations so that they line up with the original file.
    const blankLines = '\n'.repeat(getLoc(el, 'a <script> element').start.line - 1);
    const [start, end] = getRange(el.children[0], 'the contents of a <script> element');

    const isJsx = el.startTag.attributes.some(
      (attr) =>
        !attr.directive &&
        attr.key.rawName === 'lang' &&
        attr.value &&
        ['jsx', 'tsx'].includes(attr.value.value),
    );

    const ast = parseTs(`/* METAMORPH_START */${blankLines}${code.slice(start, end)}`, isJsx);

    ast.isScriptSetup = el.startTag.attributes.some(
      (attr) => !attr.directive && attr.key.rawName === 'setup',
    );

    scriptASTs.push(ast);
    scriptASTMap.set(el, ast);
  }

  const styleASTMap = new Map<AST.VElement, postcss.Root>();
  const styleASTs: postcss.Root[] = [];
  for (const el of styles) {
    if (el.children.length === 0 || !isSupportedLang(getLangAttribute(el))) continue;

    // Offset the source locations so that they line up with the original file.
    const blankLines = '\n'.repeat(getLoc(el, 'a <style> element').start.line - 1);
    const [start] = getRange(el.children[0], 'the contents of a <style> element');
    const [, end] = getRange(el.children.at(-1), 'the contents of a <style> element');

    const lang = getLangAttribute(el);

    const ast = parseCss(`/* METAMORPH_START */${blankLines}${code.slice(start, end)}`, lang);
    styleASTs.push(ast);
    styleASTMap.set(el, ast);
  }

  if (neededExtraTemplate) {
    sfcAST.templateBody!.parent!.range[1] -= extraTemplate.length;
    sfcAST.templateBody!.parent!.end! -= extraTemplate.length;
  }

  return {
    neededExtraTemplate,
    sfcAST,
    sfcTemplate,
    scriptASTs,
    styleASTs,
    scriptASTMap,
    styleASTMap,
    originalScripts: new Set(scripts),
    originalStyles: new Set(styles),
  };
}
