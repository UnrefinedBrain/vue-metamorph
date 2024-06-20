// plugin.ts
import { namedTypes as n } from 'ast-types';
import { test, expect } from 'vitest';
import { CodemodPlugin, AST, transform } from './main';

const checkKeyProp = (node: AST.VAttribute | AST.VDirective) => (
  node.key.type === 'VDirectiveKey' && node.key.argument?.type === 'VIdentifier' && node.key.argument?.name === 'key'
);

export const vueRequireVForKeyCodemod: CodemodPlugin = {
  type: 'codemod',
  name: 'vue-require-v-for-key',
  transform({
    sfcAST, utils: {
      traverseTemplateAST, builders,
    },
  }) {
    let transformCount = 0;

    function fix(hostElement: AST.VElement, directive: AST.VDirective, keyPrefix?: string) {
      const hasKeyProp = hostElement.startTag.attributes.some((node) => checkKeyProp(node));

      if (hasKeyProp) {
        // empty
      } else {
        let indexIdentifier;

        if (directive.value?.expression?.type === 'VForExpression') {
          const vForExpression = directive.value?.expression;

          if (vForExpression.left.length > 1) {
            indexIdentifier = vForExpression.left[1] as n.Identifier;
          } else {
            indexIdentifier = builders.identifier('index');
            vForExpression.left.push(indexIdentifier);

            transformCount++;
          }
        }

        hostElement.startTag.attributes.push(
          builders.vDirective(
            builders.vDirectiveKey(builders.vIdentifier('bind', ':'), builders.vIdentifier('key', 'key')),
            builders.vExpressionContainer(
              keyPrefix
                ? builders.binaryExpression(
                  '+',
                  builders.literal(keyPrefix),
                  builders.identifier(indexIdentifier!.name),
                )
                : builders.identifier(indexIdentifier!.name),
            ),
          ),
        );

        transformCount++;
      }
    }

    if (sfcAST) {
      traverseTemplateAST(sfcAST, {
        enterNode(node) {
          if (node.type === 'VIdentifier' && node.name === 'for') {
            const directive = (node.parent as AST.VDirectiveKey).parent;
            const hostElement = node.parent.parent.parent.parent as AST.VElement;

            const isReservedTag = hostElement.rawName === 'template' || hostElement.rawName === 'slot';

            if (isReservedTag) {
              hostElement.children
                .filter((e) => e.type === 'VElement')
                .forEach((childHostElement, index) => {
                  fix(childHostElement as AST.VElement, directive, String(index));
                });
            } else {
              fix(hostElement, directive);
            }
          }
        },
      });
    }

    return transformCount;
  },
};

test('v-for on template', () => {
  const source = `<template>
<div class="TeamInfo">
  <template v-for="item in teamInfoList">
    <bTypography variant="caption" component="dt">{{ item.dt }}</bTypography>
  </template>
</div>
</template>
`;

  const expected = `<template>
<div class="TeamInfo">
  <template v-for="(item, index) in teamInfoList">
    <bTypography variant="caption" component="dt" :key="'0' + index">{{ item.dt }}</bTypography>
  </template>
</div>
</template>
`;

  expect(transform(source, 'file.vue', [vueRequireVForKeyCodemod]).code).toBe(expected);
});
