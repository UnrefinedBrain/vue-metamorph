import * as vueParser from 'vue-eslint-parser';
import * as recast from 'recast';
import htmlParser from 'node-html-parser';
import { VueProgram } from '../types';
import { findAll } from '../ast-helpers';
import { VDocumentFragment } from '../ast';
import { tsParser } from './typescript';
import { getLangAttribute, isSupportedLang, parseCss } from './css';

/**
 * Parse Vue code
 * @param code Source code
 * @returns SFC AST and Script AST
 */
export function parseVue(code: string) {
  if (!htmlParser.parse(code).querySelector('template')) {
    // hack: if no <template> is present, templateBody will be null
    // and we cannot access the VDocumentFragment
    code += '\n<template></template>';
  }

  const sfcAST = vueParser.parse(code, {
    parser: tsParser(true),
    sourceType: 'module',
  });

  const scripts = findAll(sfcAST.templateBody!.parent as VDocumentFragment, {
    type: 'VElement',
    name: 'script',
  }) as vueParser.AST.VElement[];

  const styles = findAll(sfcAST.templateBody!.parent as VDocumentFragment, {
    type: 'VElement',
    name: 'style',
  }) as vueParser.AST.VElement[];

  const scriptASTs = scripts.map((el) => {
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

  return {
    sfcAST,
    scriptASTs,
    styleASTs,
  };
}
