import { it, expect } from 'vitest';
import { transform } from '../main';

it('bug 364', () => {
  const src = '<template><div class="foo" v-if="ok"></div></template>';

  const out = transform(src, 'test.vue', [
    {
      type: 'codemod',
      name: 'repro',
      transform({ sfcAST, utils: { traverseTemplateAST } }) {
        if (!sfcAST) {
          throw new Error();
        }
        traverseTemplateAST(sfcAST, {
          enterNode(node) {
            if (node.type === 'VLiteral' && node.parent?.key?.name === 'class') {
              node.value = 'bar';
            }
          },
        });
        return 1;
      },
    },
  ]).code;

  expect(out).toMatchInlineSnapshot('"<template><div class="bar" v-if="ok"></div></template>"');
});
