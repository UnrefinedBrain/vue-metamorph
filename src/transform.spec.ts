import { describe, expect, it } from 'vitest';
import { transform } from './transform';

const example = `
<template>
  <div>
    <custom />
    <span v-if="hello">
      <em>Hi there</em>
      {{ value | someFilter | otherFilter }}
      <div v-for="(item, index) in someArray">
        {{ item | myFilter(arg1) }}
      </div>
    </span>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';

type Foo = {
  bar: string
};

export default defineComponent({
  name: 'Test',
});
</script>

<style>
.className {
  color: red;
}
</style>
`;

describe('transform', () => {
  it('should ', () => {
    const res = transform(example, 'file.vue', [{
      name: 'test',
      type: 'codemod',
      transform(
        script,
        template,
        _filename,
        {
          traverseScriptAST, traverseTemplateAST, templateBuilders, astHelpers,
        },
      ) {
        if (!template) {
          return 0;
        }

        let count = 0;

        if (script) {
          traverseScriptAST(script, {
            visitProperty(path) {
              if (path.node.value.type === 'Literal'
              && typeof path.node.value.value === 'string') {
                path.node.value.value = 'transformed string';
              }
              return this.traverse(path);
            },
          });
        }

        traverseTemplateAST(template, {
          enterNode(node) {
            if (node.type === 'VElement' && node.rawName === 'script') {
              node.startTag.attributes.push(
                templateBuilders.vAttribute(
                  templateBuilders.vIdentifier('setup'),
                  null,
                ),
              );

              count++;
            }
            if (node.type === 'VElement' && node.rawName === 'div') {
              count++;
              node.rawName = 'strong';

              node.startTag.attributes.push(
                templateBuilders.vAttribute(
                  templateBuilders.vIdentifier('hi'),
                  null,
                ),
              );
            }
          },
          leaveNode() {
            // empty
          },
        });

        astHelpers.findAll(template, {
          type: 'VElement',
          name: 'custom',
        })
          .forEach((element) => {
            if (element.children.length === 0 && element.startTag.selfClosing) {
              element.startTag.selfClosing = false;
              count++;
            }
          });

        return count;
      },
    }]);

    expect(res).toMatchInlineSnapshot(`
      {
        "code": "
      <template>
        <strong hi>
          <custom></custom>
          <span v-if="hello">
            <em>Hi there</em>
            {{ value | someFilter | otherFilter }}
            <strong v-for="(item, index) in someArray" hi>
              {{ item | myFilter(arg1) }}
            </strong>
          </span>
        </strong>
      </template>

      <script lang="ts" setup>
      import { defineComponent } from 'vue';

      type Foo = {
        bar: string
      };

      export default defineComponent({
        name: 'transformed string',
      });
      </script>

      <style>
      .className {
        color: red;
      }
      </style>
      ",
        "stats": [
          [
            "test",
            4,
          ],
        ],
      }
    `);
  });
});
