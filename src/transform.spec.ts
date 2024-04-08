import { describe, expect, it } from 'vitest';
import { transform } from './transform';
import { CodemodPlugin } from './types';

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
<script setup>
const someRef = ref('my string');
</script>
<script lang="ts">
import { defineComponent } from 'vue';

type Foo = {
  bar: string
};

export default defineComponent({
  name: 'Test',
});
</script>

<style src="./style.css"></style>
<style src="./style.css" />

<style lang="less">
.className {
  $variable: 1234;
  color: red;
}
</style>

<style lang="unknown lang">
.red
  color ---> red
</style>


<style lang="scss">
.className {
  $variable: 1234;
  color: blue;
}
</style>
`;

const stringLiteralPlugin: CodemodPlugin = {
  name: 'test',
  type: 'codemod',
  transform({
    scriptASTs,
    sfcAST,
    styleASTs,
    utils: {
      traverseScriptAST,
      traverseTemplateAST,
      builders,
      astHelpers,
    },
  }) {
    if (!sfcAST) {
      return 0;
    }

    let count = 0;

    for (const style of styleASTs) {
      style.walkDecls('color', (decl) => {
        decl.important = true;
        decl.after('\n  background-color: black');
      });
    }

    for (const script of scriptASTs) {
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

    traverseTemplateAST(sfcAST, {
      enterNode(node) {
        if (node.type === 'VElement' && node.rawName === 'script') {
          node.startTag.attributes.push(
            builders.vAttribute(
              builders.vIdentifier('setup'),
              null,
            ),
          );

          count++;
        }
        if (node.type === 'VElement' && node.rawName === 'div') {
          count++;
          node.rawName = 'strong';

          node.startTag.attributes.push(
            builders.vAttribute(
              builders.vIdentifier('hi'),
              null,
            ),
          );
        }
      },
      leaveNode() {
        // empty
      },
    });

    astHelpers.findAll(sfcAST, {
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
};

describe('transform', () => {
  it('should work with the test file', () => {
    const res = transform(example, 'file.vue', [stringLiteralPlugin]);

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
      <script setup setup>
      const someRef = ref('my string');
      </script>
      <script lang="ts" setup>
      import { defineComponent } from 'vue';

      type Foo = {
        bar: string
      };

      export default defineComponent({
        name: 'transformed string',
      });
      </script>

      <style src="./style.css"></style>
      <style src="./style.css" />

      <style lang="less">
      .className {
        $variable: 1234;
        color: red !important;
        background-color: black;
      }
      </style>

      <style lang="unknown lang">
      .red
        color ---> red
      </style>


      <style lang="scss">
      .className {
        $variable: 1234;
        color: blue !important;
        background-color: black;
      }
      </style>
      ",
        "stats": [
          [
            "test",
            5,
          ],
        ],
      }
    `);
  });

  it('should transform jsx', () => {
    const input = 'const btn = () => <button>Hello</button>';
    const codemod: CodemodPlugin = {
      type: 'codemod',
      name: 'test',
      transform({ scriptASTs, utils }) {
        let count = 0;
        for (const scriptAST of scriptASTs) {
          utils.astHelpers.findAll(scriptAST, {
            type: 'JSXElement',
          })
            .forEach((el) => {
              if (el.openingElement.name.type === 'JSXIdentifier') {
                el.openingElement.name.name = 'div';
              }

              if (el.closingElement?.name.type === 'JSXIdentifier') {
                el.closingElement.name.name = 'div';
              }

              count++;
            });
        }

        return count;
      },
    };

    expect(transform(input, 'file.jsx', [codemod]).code).toMatchInlineSnapshot(`
      "const btn = () => <div>Hello</div>
      "
    `);
  });

  it('should not mess up formatting when the <script> is first', () => {
    const i = `<script>
export default {
  name: 'MyComponent',
  methods: {
    foo() {
      return 5;
    },
  },
};
</script>

<template>
  <div>
    Hi
  </div>
</template>
`;

    expect(transform(i, 'file.vue', [stringLiteralPlugin]).code).toMatchInlineSnapshot(`
      "<script setup>
      export default {
        name: 'transformed string',
        methods: {
          foo() {
            return 5;
          },
        },
      };
      </script>

      <template>
        <strong hi>
          Hi
        </strong>
      </template>
      "
    `);
  });
});
