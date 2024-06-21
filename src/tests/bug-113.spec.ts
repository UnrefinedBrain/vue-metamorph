import { test, expect } from 'vitest';
import { CodemodPlugin, transform } from '../main';

export const compatibleVBindCodemod: CodemodPlugin = {
  type: 'codemod',
  name: 'compatible-v-bind',
  transform({
    sfcAST,
    utils: {
      astHelpers,
    },
  }) {
    let transformCount = 0;

    if (sfcAST) {
      const templateElement = astHelpers.findFirst(sfcAST, {
        type: 'VElement',
        name: 'template',
      });

      if (templateElement) {
        const elements = astHelpers.findAll(templateElement, {
          type: 'VElement',
        });

        elements.forEach(({ startTag: { attributes } }) => {
          const idx = attributes.findIndex((attr) => (
            attr.key.type === 'VDirectiveKey' && attr.key.name.rawName === 'bind'
          ));

          if (idx > 0) {
            // @ts-expect-error ignore
            [attributes[0], attributes[idx]] = [attributes[idx], attributes[0]];

            transformCount++;
          }
        });
      }
    }

    return transformCount;
  },
};

test('bug 113', () => {
  const source = `<template>
<SitemapItem :id="!isShow" v-bind="passProps" />
</template>`;

  const expected = `<template>
<SitemapItem v-bind="passProps" :id="!isShow" />
</template>`;

  expect(
    transform(source, 'file.vue', [compatibleVBindCodemod]).code,
  ).toBe(expected);
});
