import { describe, expect, it } from 'vitest';
import postcss from 'postcss';
import { transform } from './transform';
import { CodemodPlugin } from './types';

const example = `
<template>
  <div>
    <custom />
    <span v-if="hello"><!-- 1 comment -->
      <!-- 2 comment -->
      <em>Hi there</em>
      <!-- 3 comment --><!-- 4 comment -->
      {{ value | someFilter | otherFilter }}
      <div v-for="(item, index) in someArray">
        <!-- 5 comment -->{{ item | myFilter(arg1) }}
      </div>
    <!-- 6 comment --></span>
  </div>
</template>
<script setup lang="ts" generic="T extends string">
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

<style lang="stylus">
.className
  $variable= 1234
  color green
</style>
`;

const example2 = `<script setup lang="ts" generic="T extends string">const someRef = ref('my string');
</script>

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

<style lang="stylus">
.className
  $variable= 1234
  color green
</style>
`.replaceAll(/\n/g, '\r\n');

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
        decl.after(postcss.decl({
          prop: 'background-color',
          value: 'black',
        }));
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
    const res2 = transform(example2, 'file2.vue', [stringLiteralPlugin]);

    expect(res).toMatchInlineSnapshot(`
      {
        "code": "
      <template>
        <strong hi>
          <custom></custom>
          <span v-if="hello"><!-- 1 comment -->
            <!-- 2 comment -->
            <em>Hi there</em>
            <!-- 3 comment --><!-- 4 comment -->
            {{ value | someFilter | otherFilter }}
            <strong v-for="(item, index) in someArray" hi>
              <!-- 5 comment -->{{ item | myFilter(arg1) }}
            </strong>
          <!-- 6 comment --></span>
        </strong>
      </template>
      <script setup lang="ts" generic="T extends string" setup>
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

      <style lang="stylus">
      .className
        $variable= 1234
        color green !important;
        background-color: black
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

    expect(res2).toMatchInlineSnapshot(`
      {
        "code": "<script setup lang="ts" generic="T extends string" setup>
      const someRef = ref('my string');
      </script>

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

      <style lang="stylus">
      .className
        $variable= 1234
        color green !important;
        background-color: black
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

  it('should tranform stylus', () => {
    const input = `
.className
  $variable= 1234
  color green
`;
    expect(transform(input, 'file.styl', [{
      name: 'test',
      type: 'codemod',
      transform({ styleASTs }) {
        for (const ast of styleASTs) {
          ast.walkDecls('color', (decl) => {
            decl.after(postcss.decl({
              prop: 'background-color',
              value: 'black',
            }));
          });
        }

        return 1;
      },
    }]).code).toMatchInlineSnapshot(`
      "
      .className
        $variable= 1234
        color green;
        background-color: black
      "
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

  it('can use v-bind in CSS', () => {
    const i = `
<template>
  <div class="className">
    Hi 
  </div>
</template>
<script setup>
import { ref } from 'vue';
const color = ref('red');
</script>
<style lang="css" scoped>
.className {
  color: v-bind(color);
}
</style>
      `;

    expect(transform(i, 'file.vue', []).code).toMatchInlineSnapshot(`
      "
      <template>
        <div class="className">
          Hi 
        </div>
      </template>
      <script setup>
      import { ref } from 'vue';
      const color = ref('red');
      </script>
      <style lang="css" scoped>
      .className {
        color: v-bind(color);
      }
      </style>
            "
    `);
  });

  it('should not fail when the script tag is empty', () => {
    const i = `<template>
      <div>
        Hi
      </div>
    </template>
    <script></script>
    `;

    expect(transform(i, 'file.vue', [stringLiteralPlugin]).code).toMatchInlineSnapshot(`
      "<template>
            <strong hi>
              Hi
            </strong>
          </template>
          <script setup></script>
          "
    `);
  });

  it('should add a new element to the sfc ast', () => {
    const input = `<template>
  <div></div>
</template>

<script>
export default {};
</script>
`;
    const plugin: CodemodPlugin = {
      type: 'codemod',
      name: '',
      transform({ sfcAST, utils: { builders } }) {
        let transformCount = 0;

        if (sfcAST) {
          sfcAST.children.push(
            builders.vElement(
              'script',
              builders.vStartTag([
                builders.vAttribute(
                  builders.vIdentifier('setup'),
                  null,
                ),
              ], false),
              [
                builders.vText('\nconst { t } = useI18n();\n'),
              ],
            ),
          );

          transformCount++;
        }

        return transformCount;
      },
    };

    expect(transform(input, 'file.vue', [plugin]).code).toMatchInlineSnapshot(`
      "<template>
        <div></div>
      </template>

      <script>
      export default {};
      </script>
      <script setup>
      const { t } = useI18n();
      </script>"
    `);
  });

  it('should add a new element to the sfc ast', () => {
    const input = `<template>
  <div></div>
</template>

<script>
export default {};
</script>
`;
    const plugin: CodemodPlugin = {
      type: 'codemod',
      name: '',
      transform({ scriptASTs, sfcAST, utils: { builders } }) {
        let transformCount = 0;

        if (sfcAST) {
          sfcAST.children.push(
            builders.vElement(
              'script',
              builders.vStartTag([
                builders.vAttribute(
                  builders.vIdentifier('setup'),
                  null,
                ),
              ], false),
              [],
            ),
          );

          scriptASTs.push(
            builders.program([
              builders.variableDeclaration(
                'const',
                [
                  builders.variableDeclarator(
                    builders.objectPattern([
                      (() => {
                        const prop = builders.property(
                          'init',
                          builders.identifier('t'),
                          builders.identifier('t'),
                        );

                        prop.shorthand = true;

                        return prop;
                      })(),
                    ]),
                    builders.callExpression(
                      builders.identifier('useI18n'),
                      [],
                    ),
                  ),
                ],
              ),
            ]) as never,
          );

          transformCount++;
        }

        return transformCount;
      },
    };

    expect(transform(input, 'file.vue', [plugin]).code).toMatchInlineSnapshot(`
      "<template>
        <div></div>
      </template>

      <script>
      export default {};
      </script>
      <script setup>
      const {
        t,
      } = useI18n();
      </script>"
    `);
  });
});

it('should add a new <script>', () => {
  const input = '<template><div /></template>';

  const cm: CodemodPlugin = {
    type: 'codemod',
    name: 'new-script',
    transform({ sfcAST, scriptASTs, utils: { builders } }) {
      sfcAST?.children.push(
        builders.vText('\n\n'),
        builders.vElement('script', builders.vStartTag([], false), []),
      );
      scriptASTs.push(builders.program([
        builders.expressionStatement(
          builders.binaryExpression(
            '+',
            builders.identifier('a'),
            builders.identifier('b'),
          ),
        ),
      ]) as never);
      return 1;
    },
  };

  expect(transform(input, 'file.vue', [cm]).code).toMatchInlineSnapshot(`
    "<template><div /></template>

    <script>
    a + b;
    </script>"
  `);
});

it('should add a lang to a <script>', () => {
  const input = `
<template>
  <div />
</template>

<script>
export default {

};
</script>
`;

  const cm: CodemodPlugin = {
    type: 'codemod',
    name: 'add lang',
    transform({ sfcAST, utils: { builders } }) {
      if (sfcAST) {
        for (const child of sfcAST.children) {
          if (child.type === 'VElement' && child.name === 'script') {
            child.startTag.attributes.push(
              builders.vAttribute(
                builders.vIdentifier('lang'),
                builders.vLiteral('js'),
              ),
            );
          }
        }
      }
      return 1;
    },
  };

  expect(transform(input, 'file.vue', [cm]).code).toMatchInlineSnapshot(`
    "
    <template>
      <div />
    </template>

    <script lang="js">
    export default {

    };
    </script>
    "
  `);
});
