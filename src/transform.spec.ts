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

const example2 =
  `<script setup lang="ts" generic="T extends string">const someRef = ref('my string');
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
    utils: { traverseScriptAST, traverseTemplateAST, builders, astHelpers },
  }) {
    if (!sfcAST) {
      return 0;
    }

    let count = 0;

    for (const style of styleASTs) {
      style.walkDecls('color', (decl) => {
        decl.important = true;
        decl.after(
          postcss.decl({
            prop: 'background-color',
            value: 'black',
          }),
        );
      });
    }

    for (const script of scriptASTs) {
      traverseScriptAST(script, {
        visitProperty(path) {
          if (path.node.value.type === 'Literal' && typeof path.node.value.value === 'string') {
            path.node.value.value = 'transformed string';
          }
          return this.traverse(path);
        },
      });
    }

    traverseTemplateAST(sfcAST, {
      enterNode(node) {
        if (node.type === 'VElement' && node.rawName === 'script') {
          node.startTag.attributes.push(builders.vAttribute(builders.vIdentifier('setup'), null));

          count++;
        }
        if (node.type === 'VElement' && node.rawName === 'div') {
          count++;
          node.rawName = 'strong';

          node.startTag.attributes.push(builders.vAttribute(builders.vIdentifier('hi'), null));
        }
      },
      leaveNode() {
        // empty
      },
    });

    astHelpers
      .findAll(sfcAST, {
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
    expect(
      transform(input, 'file.styl', [
        {
          name: 'test',
          type: 'codemod',
          transform({ styleASTs }) {
            for (const ast of styleASTs) {
              ast.walkDecls('color', (decl) => {
                decl.after(
                  postcss.decl({
                    prop: 'background-color',
                    value: 'black',
                  }),
                );
              });
            }

            return 1;
          },
        },
      ]).code,
    ).toMatchInlineSnapshot(`
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
          utils.astHelpers
            .findAll(scriptAST, {
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

  it('should not inject script AST into a preceding empty <script> tag', () => {
    const input = `<template>
  <div></div>
</template>
<script></script>
<script setup>
const a = 'hello';
</script>
`;

    const plugin: CodemodPlugin = {
      type: 'codemod',
      name: 'rewrite-literal',
      transform({ scriptASTs, utils: { traverseScriptAST } }) {
        let count = 0;
        for (const ast of scriptASTs) {
          traverseScriptAST(ast, {
            visitLiteral(path) {
              if (typeof path.node.value === 'string') {
                path.node.value = 'world';
                count++;
              }
              return this.traverse(path);
            },
          });
        }
        return count;
      },
    };

    const out = transform(input, 'file.vue', [plugin]).code;
    // empty script must stay empty; populated <script setup> must receive the rewrite
    expect(out).toContain('<script></script>');
    expect(out).toContain("const a = 'world';");
    expect(out).not.toMatch(/<script>\s*const a = /);
  });

  it('should not inject style AST into a preceding empty <style> tag', () => {
    const input = `<template>
  <div></div>
</template>
<style></style>
<style scoped>
.foo { color: red; }
</style>
`;

    const plugin: CodemodPlugin = {
      type: 'codemod',
      name: 'rewrite-color',
      transform({ styleASTs }) {
        let count = 0;
        for (const style of styleASTs) {
          style.walkDecls('color', (decl) => {
            decl.value = 'blue';
            count++;
          });
        }
        return count;
      },
    };

    const out = transform(input, 'file.vue', [plugin]).code;
    expect(out).toContain('<style></style>');
    expect(out).toContain('color: blue');
    expect(out).not.toMatch(/<style>\s*\.foo \{/);
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
              builders.vStartTag([builders.vAttribute(builders.vIdentifier('setup'), null)], false),
              [builders.vText('\nconst { t } = useI18n();\n')],
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
              builders.vStartTag([builders.vAttribute(builders.vIdentifier('setup'), null)], false),
              [],
            ),
          );

          scriptASTs.push(
            builders.program([
              builders.variableDeclaration('const', [
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
                  builders.callExpression(builders.identifier('useI18n'), []),
                ),
              ]),
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
        scriptASTs.push(
          builders.program([
            builders.expressionStatement(
              builders.binaryExpression('+', builders.identifier('a'), builders.identifier('b')),
            ),
          ]) as never,
        );
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
                builders.vAttribute(builders.vIdentifier('lang'), builders.vLiteral('js')),
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

  describe('file type routing', () => {
    it('should handle .ts files', () => {
      const plugin: CodemodPlugin = {
        type: 'codemod',
        name: 'test',
        transform({ scriptASTs }) {
          expect(scriptASTs).toHaveLength(1);
          return 0;
        },
      };
      const result = transform('const x = 1;', 'file.ts', [plugin]);
      expect(result.code).toContain('const x = 1');
    });

    it('should handle .tsx files with JSX', () => {
      const plugin: CodemodPlugin = {
        type: 'codemod',
        name: 'test',
        transform() {
          return 0;
        },
      };
      const result = transform('const el = <div>hi</div>;', 'file.tsx', [plugin]);
      expect(result.code).toContain('<div>');
    });

    it('should handle .css files', () => {
      const plugin: CodemodPlugin = {
        type: 'codemod',
        name: 'test',
        transform({ styleASTs }) {
          expect(styleASTs).toHaveLength(1);
          return 0;
        },
      };
      const result = transform('.foo { color: red; }', 'file.css', [plugin]);
      expect(result.code).toContain('color: red');
    });

    it('should handle .scss files', () => {
      const plugin: CodemodPlugin = {
        type: 'codemod',
        name: 'test',
        transform({ styleASTs }) {
          expect(styleASTs).toHaveLength(1);
          return 0;
        },
      };
      const result = transform('$var: red; .foo { color: $var; }', 'file.scss', [plugin]);
      expect(result.code).toContain('$var');
    });

    it('should route .less files to CSS transform', () => {
      const plugin: CodemodPlugin = {
        type: 'codemod',
        name: 'test',
        transform({ styleASTs }) {
          expect(styleASTs).toHaveLength(1);
          return 0;
        },
      };
      const result = transform('@var: red; .foo { color: @var; }', 'file.less', [plugin]);
      expect(result.code).toContain('@var');
    });
  });

  describe('Vue transforms', () => {
    it('should handle Vue file with no template', () => {
      const input = `<script>
export default { name: 'NoTemplate' };
</script>`;
      const plugin: CodemodPlugin = {
        type: 'codemod',
        name: 'test',
        transform({ scriptASTs }) {
          expect(scriptASTs).toHaveLength(1);
          return 0;
        },
      };
      const result = transform(input, 'file.vue', [plugin]);
      expect(result.code).toContain('NoTemplate');
    });

    it('should pass opts to codemods', () => {
      const plugin: CodemodPlugin = {
        type: 'codemod',
        name: 'test',
        transform({ opts }) {
          expect(opts.myOption).toBe('hello');
          return 0;
        },
      };
      transform('const x = 1;', 'file.js', [plugin], { myOption: 'hello' });
    });

    it('should collect stats from multiple plugins', () => {
      const plugin1: CodemodPlugin = {
        type: 'codemod',
        name: 'plugin-1',
        transform: () => 3,
      };
      const plugin2: CodemodPlugin = {
        type: 'codemod',
        name: 'plugin-2',
        transform: () => 7,
      };
      const result = transform('const x = 1;', 'file.js', [plugin1, plugin2]);
      expect(result.stats).toEqual([
        ['plugin-1', 3],
        ['plugin-2', 7],
      ]);
    });

    it('should handle empty plugin list', () => {
      const result = transform('const x = 1;', 'file.js', []);
      expect(result.code).toContain('const x = 1');
      expect(result.stats).toEqual([]);
    });

    it('should pass filename to codemods', () => {
      const plugin: CodemodPlugin = {
        type: 'codemod',
        name: 'test',
        transform({ filename }) {
          expect(filename).toBe('src/MyComponent.vue');
          return 0;
        },
      };
      transform('<template><div /></template>', 'src/MyComponent.vue', [plugin]);
    });

    it('should handle Vue file with only a style block', () => {
      const input = `<style lang="css">
.foo { color: red; }
</style>`;
      const plugin: CodemodPlugin = {
        type: 'codemod',
        name: 'test',
        transform({ styleASTs }) {
          for (const ast of styleASTs) {
            ast.walkDecls('color', (decl) => {
              decl.value = 'blue';
            });
          }
          return 1;
        },
      };
      const result = transform(input, 'file.vue', [plugin]);
      expect(result.code).toContain('color: blue');
    });

    it('should provide utils in the context', () => {
      const plugin: CodemodPlugin = {
        type: 'codemod',
        name: 'test',
        transform({ utils }) {
          expect(utils.builders).toBeDefined();
          expect(utils.astHelpers).toBeDefined();
          expect(utils.traverseScriptAST).toBeDefined();
          expect(utils.traverseTemplateAST).toBeDefined();
          return 0;
        },
      };
      transform('const x = 1;', 'file.js', [plugin]);
    });

    it('should handle multiple style blocks with different langs', () => {
      const input = `<template><div /></template>
<style lang="css">
.a { color: red; }
</style>
<style lang="scss">
.b { color: blue; }
</style>`;
      const plugin: CodemodPlugin = {
        type: 'codemod',
        name: 'test',
        transform({ styleASTs }) {
          expect(styleASTs).toHaveLength(2);
          return 0;
        },
      };
      transform(input, 'file.vue', [plugin]);
    });
  });

  describe('no-op transforms', () => {
    it('should return identical code when no codemods make changes (JS)', () => {
      const input = 'const x = 1;\n';
      const plugin: CodemodPlugin = {
        type: 'codemod',
        name: 'noop',
        transform: () => 0,
      };
      const result = transform(input, 'file.js', [plugin]);
      expect(result.code).toBe('const x = 1;\n');
    });

    it('should return identical code when no codemods make changes (Vue)', () => {
      const input = `<template>
  <div>Hello</div>
</template>

<script>
export default {};
</script>
`;
      const plugin: CodemodPlugin = {
        type: 'codemod',
        name: 'noop',
        transform: () => 0,
      };
      const result = transform(input, 'file.vue', [plugin]);
      expect(result.code).toBe(input);
    });

    it('should return identical code when no codemods make changes (CSS)', () => {
      const input = '.foo { color: red; }';
      const plugin: CodemodPlugin = {
        type: 'codemod',
        name: 'noop',
        transform: () => 0,
      };
      const result = transform(input, 'file.css', [plugin]);
      expect(result.code).toContain('color: red');
    });
  });

  describe('multiple codemods mutating the same file', () => {
    it('should apply sequential codemods in order (JS)', () => {
      const plugin1: CodemodPlugin = {
        type: 'codemod',
        name: 'add-import',
        transform({ scriptASTs, utils: { astHelpers } }) {
          if (scriptASTs[0]) {
            astHelpers.createNamedImport(scriptASTs[0], 'vue', 'ref');
          }
          return 1;
        },
      };
      const plugin2: CodemodPlugin = {
        type: 'codemod',
        name: 'add-another-import',
        transform({ scriptASTs, utils: { astHelpers } }) {
          if (scriptASTs[0]) {
            astHelpers.createNamedImport(scriptASTs[0], 'vue', 'computed');
          }
          return 1;
        },
      };
      const result = transform('const x = 1;', 'file.js', [plugin1, plugin2]);
      expect(result.code).toContain('ref');
      expect(result.code).toContain('computed');
      expect(result.stats).toEqual([
        ['add-import', 1],
        ['add-another-import', 1],
      ]);
    });

    it('should apply sequential codemods on Vue template', () => {
      const input = `<template>
  <div class="a">Hello</div>
</template>
<script>
export default {};
</script>
`;
      const plugin1: CodemodPlugin = {
        type: 'codemod',
        name: 'rename-div',
        transform({ sfcAST, utils: { astHelpers } }) {
          if (sfcAST) {
            astHelpers.findAll(sfcAST, { type: 'VElement', name: 'div' }).forEach((el) => {
              el.rawName = 'section';
              el.name = 'section';
            });
          }
          return 1;
        },
      };
      const plugin2: CodemodPlugin = {
        type: 'codemod',
        name: 'add-attr',
        transform({ sfcAST, utils: { astHelpers, builders } }) {
          if (sfcAST) {
            astHelpers.findAll(sfcAST, { type: 'VElement', name: 'section' }).forEach((el) => {
              el.startTag.attributes.push(
                builders.vAttribute(builders.vIdentifier('data-v'), null),
              );
            });
          }
          return 1;
        },
      };
      const result = transform(input, 'file.vue', [plugin1, plugin2]);
      expect(result.code).toContain('<section');
      expect(result.code).toContain('data-v');
      expect(result.code).not.toContain('<div');
    });
  });

  describe('template-only Vue file', () => {
    it('should handle template-only Vue file (no script, no style)', () => {
      const input = `<template>
  <div>Hello</div>
</template>
`;
      const plugin: CodemodPlugin = {
        type: 'codemod',
        name: 'test',
        transform({ sfcAST, scriptASTs, styleASTs }) {
          expect(sfcAST).not.toBeNull();
          expect(scriptASTs).toHaveLength(0);
          expect(styleASTs).toHaveLength(0);
          return 0;
        },
      };
      const result = transform(input, 'file.vue', [plugin]);
      expect(result.code).toContain('<div>Hello</div>');
    });

    it('should be able to modify a template-only Vue file', () => {
      const input = `<template>
  <div>Hello</div>
</template>
`;
      const plugin: CodemodPlugin = {
        type: 'codemod',
        name: 'test',
        transform({ sfcAST, utils: { astHelpers } }) {
          if (sfcAST) {
            astHelpers.findAll(sfcAST, { type: 'VElement', name: 'div' }).forEach((el) => {
              el.rawName = 'span';
            });
          }
          return 1;
        },
      };
      const result = transform(input, 'file.vue', [plugin]);
      expect(result.code).toContain('<span>Hello</span>');
      expect(result.code).not.toContain('<div>');
    });
  });

  describe('CRLF preservation', () => {
    it('should handle CRLF in JS files', () => {
      const input = 'const x = 1;\r\nconst y = 2;\r\n';
      const plugin: CodemodPlugin = {
        type: 'codemod',
        name: 'test',
        transform: () => 0,
      };
      const result = transform(input, 'file.js', [plugin]);
      expect(result.code).toBeDefined();
    });
  });

  describe('CSS transforms', () => {
    it('should transform CSS declarations', () => {
      const input = '.foo { color: red; }';
      const plugin: CodemodPlugin = {
        type: 'codemod',
        name: 'test',
        transform({ styleASTs }) {
          for (const ast of styleASTs) {
            ast.walkDecls('color', (decl) => {
              decl.value = 'blue';
            });
          }
          return 1;
        },
      };
      const result = transform(input, 'file.css', [plugin]);
      expect(result.code).toContain('color: blue');
    });

    it('should collect stats from CSS transforms', () => {
      const plugin: CodemodPlugin = {
        type: 'codemod',
        name: 'css-plugin',
        transform: () => 5,
      };
      const result = transform('.foo { color: red; }', 'file.css', [plugin]);
      expect(result.stats).toEqual([['css-plugin', 5]]);
    });

    it('should pass empty scriptASTs and null sfcAST for CSS files', () => {
      const plugin: CodemodPlugin = {
        type: 'codemod',
        name: 'test',
        transform({ scriptASTs, sfcAST }) {
          expect(scriptASTs).toEqual([]);
          expect(sfcAST).toBeNull();
          return 0;
        },
      };
      transform('.foo { color: red; }', 'file.css', [plugin]);
    });
  });

  describe('multi-statement v-on handlers', () => {
    it('preserves every statement when a template re-print is forced', () => {
      const input = `<template>
  <button @click="a(); b()">click</button>
</template>
`;
      const plugin: CodemodPlugin = {
        type: 'codemod',
        name: 'add-class',
        transform({ sfcAST, utils: { astHelpers, builders } }) {
          if (sfcAST) {
            astHelpers.findAll(sfcAST, { type: 'VElement', name: 'button' }).forEach((el) => {
              el.startTag.attributes.push(
                builders.vAttribute(builders.vIdentifier('class'), builders.vLiteral('primary')),
              );
            });
          }
          return 1;
        },
      };
      const result = transform(input, 'file.vue', [plugin]).code;
      expect(result).toMatchInlineSnapshot(`
        "<template>
          <button @click="a(); b()" class="primary">click</button>
        </template>
        "
      `);
    });
  });
  describe('original formatting', () => {
    const addClassTo = (name: string): CodemodPlugin => ({
      type: 'codemod',
      name: `add-class-to-${name}`,
      transform({ sfcAST, utils: { astHelpers, builders } }) {
        if (!sfcAST) {
          return 0;
        }

        const elements = astHelpers.findAll(sfcAST, { type: 'VElement', name });

        elements.forEach((el) => {
          el.startTag.attributes.push(
            builders.vAttribute(builders.vIdentifier('class'), builders.vLiteral('primary')),
          );
        });

        return elements.length;
      },
    });

    const addClass = addClassTo('button');
    const run = (input: string, plugins: CodemodPlugin[] = [addClass]) =>
      transform(input, 'file.vue', plugins).code;

    describe('keeps the source formatting of what a codemod leaves alone', () => {
      it('keeps the line breaks between the attributes of a changed element', () => {
        expect(
          run(`<template>
  <button
    id="a"
    :disabled="isDisabled"
    @click="handle()"
  >click</button>
</template>
`),
        ).toBe(`<template>
  <button
    id="a"
    :disabled="isDisabled"
    @click="handle()" class="primary"
  >click</button>
</template>
`);
      });

      it('keeps the quote style and the spacing of untouched attributes', () => {
        expect(
          run(`<template>
  <button data-x='y'   :foo="a   +   b">click</button>
</template>
`),
        ).toBe(`<template>
  <button data-x='y'   :foo="a   +   b" class="primary">click</button>
</template>
`);
      });

      it('keeps the spacing inside an untouched v-for expression', () => {
        expect(
          run(`<template>
  <li   v-for="( item ,   index ) in   items"   :key='item.id'>x</li>
  <button>b</button>
</template>
`),
        ).toBe(`<template>
  <li   v-for="( item ,   index ) in   items"   :key='item.id'>x</li>
  <button class="primary">b</button>
</template>
`);
      });

      it('keeps the character references in an untouched attribute value', () => {
        expect(
          run(`<template>
  <button   a="x &amp; y &quot;q&quot;"   b='&lt;'>b</button>
</template>
`),
        ).toBe(`<template>
  <button   a="x &amp; y &quot;q&quot;"   b='&lt;' class="primary">b</button>
</template>
`);
      });

      it('keeps the formatting of untouched siblings and ancestors', () => {
        expect(
          run(`<template>
  <section   x='1'>
    <p    class='a'>one</p>
    <div    y='2'>
      <button    z='3'>b</button>
    </div>
  </section>
</template>
`),
        ).toBe(`<template>
  <section   x='1'>
    <p    class='a'>one</p>
    <div    y='2'>
      <button    z='3' class="primary">b</button>
    </div>
  </section>
</template>
`);
      });

      it('keeps the formatting of a self-closing tag', () => {
        expect(
          run(`<template>
  <button
    id="a"
  />
</template>
`),
        ).toBe(`<template>
  <button
    id="a" class="primary"
  />
</template>
`);
      });

      it('keeps boolean attributes and the spacing around them', () => {
        expect(
          run(`<template>
  <button    disabled     data-x
  >b</button>
</template>
`),
        ).toBe(`<template>
  <button    disabled     data-x class="primary"
  >b</button>
</template>
`);
      });

      it('keeps the untouched script and style blocks of the same file', () => {
        expect(
          run(`<template>
  <button   a='1'>b</button>
</template>

<script>
export default { name: 'x' };
</script>

<style scoped>
.a   {   color:   red;   }
</style>
`),
        ).toBe(`<template>
  <button   a='1' class="primary">b</button>
</template>

<script>
export default { name: 'x' };
</script>

<style scoped>
.a   {   color:   red;   }
</style>
`);
      });
    });

    describe('still prints what a codemod changes', () => {
      it('prints a changed attribute value', () => {
        const setValue: CodemodPlugin = {
          type: 'codemod',
          name: 'set-value',
          transform({ sfcAST, utils: { astHelpers } }) {
            let count = 0;

            for (const attr of astHelpers.findAll(sfcAST!, { type: 'VAttribute' })) {
              if (attr.directive || attr.key.rawName !== 'id' || !attr.value) {
                continue;
              }

              attr.value.value = 'CHANGED';
              count++;
            }

            return count;
          },
        };

        expect(
          run(
            `<template>
  <div    id="a"   title="t">hi</div>
</template>
`,
            [setValue],
          ),
        ).toBe(`<template>
  <div    id="CHANGED"   title="t">hi</div>
</template>
`);
      });

      it('prints a changed attribute name', () => {
        const rename: CodemodPlugin = {
          type: 'codemod',
          name: 'rename-attr',
          transform({ sfcAST, utils: { astHelpers } }) {
            let count = 0;

            for (const attr of astHelpers.findAll(sfcAST!, { type: 'VAttribute' })) {
              if (attr.directive || attr.key.rawName !== 'id') {
                continue;
              }

              attr.key.name = 'data-id';
              attr.key.rawName = 'data-id';
              count++;
            }

            return count;
          },
        };

        expect(
          run(
            `<template>
  <div    id="a"   title="t">hi</div>
</template>
`,
            [rename],
          ),
        ).toBe(`<template>
  <div    data-id="a"   title="t">hi</div>
</template>
`);
      });

      it('prints a changed directive expression', () => {
        const replace: CodemodPlugin = {
          type: 'codemod',
          name: 'replace-expression',
          transform({ sfcAST, utils: { astHelpers, builders } }) {
            const attr = astHelpers.findAll(sfcAST!, { type: 'VAttribute', directive: true })[0]!;
            (attr.value as never as { expression: unknown }).expression =
              builders.identifier('zzz');
            return 1;
          },
        };

        expect(
          run(
            `<template>
  <div   :foo="a   +   b"   id="x">hi</div>
</template>
`,
            [replace],
          ),
        ).toBe(`<template>
  <div   :foo="zzz"   id="x">hi</div>
</template>
`);
      });

      it('prints an added directive modifier', () => {
        const addModifier: CodemodPlugin = {
          type: 'codemod',
          name: 'add-modifier',
          transform({ sfcAST, utils: { astHelpers, builders } }) {
            const attr = astHelpers.findAll(sfcAST!, { type: 'VAttribute', directive: true })[0]!;
            (attr.key as never as { modifiers: unknown[] }).modifiers.push(
              builders.vIdentifier('prevent'),
            );
            return 1;
          },
        };

        expect(
          run(
            `<template>
  <div   @click="go()"   id="x">hi</div>
</template>
`,
            [addModifier],
          ),
        ).toBe(`<template>
  <div   @click.prevent="go()"   id="x">hi</div>
</template>
`);
      });

      it('prints a renamed element instead of the original tag name', () => {
        const rename: CodemodPlugin = {
          type: 'codemod',
          name: 'rename-element',
          transform({ sfcAST, utils: { astHelpers } }) {
            const el = astHelpers.findFirst(sfcAST!, { type: 'VElement', name: 'div' })!;
            el.name = 'section';
            el.rawName = 'section';
            return 1;
          },
        };

        expect(
          run(
            `<template>
  <div    id="a">hi</div>
</template>
`,
            [rename],
          ),
        ).toBe(`<template>
  <section id="a">hi</section>
</template>
`);
      });

      it('prints changed text', () => {
        const setText: CodemodPlugin = {
          type: 'codemod',
          name: 'set-text',
          transform({ sfcAST, utils: { astHelpers } }) {
            const el = astHelpers.findFirst(sfcAST!, { type: 'VElement', name: 'div' })!;
            (el.children[0] as { value: string }).value = 'REPLACED';
            return 1;
          },
        };

        expect(
          run(
            `<template>
  <div    id="a">hello   world</div>
</template>
`,
            [setText],
          ),
        ).toBe(`<template>
  <div    id="a">REPLACED</div>
</template>
`);
      });

      it('does not reprint an attribute that was removed', () => {
        const removeId: CodemodPlugin = {
          type: 'codemod',
          name: 'remove-id',
          transform({ sfcAST, utils: { astHelpers } }) {
            astHelpers.findAll(sfcAST!, { type: 'VElement', name: 'button' }).forEach((el) => {
              el.startTag.attributes = el.startTag.attributes.filter(
                (attr) => attr.directive || attr.key.rawName !== 'id',
              );
            });
            return 1;
          },
        };

        expect(
          run(
            `<template>
  <button id="gone" title="kept">click</button>
</template>
`,
            [removeId],
          ),
        ).toBe(`<template>
  <button title="kept">click</button>
</template>
`);
      });

      it('drops the spacing before the closing delimiter when self-closing is turned off', () => {
        const expand: CodemodPlugin = {
          type: 'codemod',
          name: 'expand',
          transform({ sfcAST, utils: { astHelpers } }) {
            const el = astHelpers.findFirst(sfcAST!, { type: 'VElement', name: 'custom' })!;
            el.startTag.selfClosing = false;
            return 1;
          },
        };

        expect(
          run(
            `<template>
  <custom />
</template>
`,
            [expand],
          ),
        ).toBe(`<template>
  <custom></custom>
</template>
`);
      });

      it('keeps attribute spacing when self-closing is turned on', () => {
        const collapse: CodemodPlugin = {
          type: 'codemod',
          name: 'collapse',
          transform({ sfcAST, utils: { astHelpers } }) {
            const el = astHelpers.findFirst(sfcAST!, { type: 'VElement', name: 'custom' })!;
            el.startTag.selfClosing = true;
            el.endTag = null;
            el.children = [];
            return 1;
          },
        };

        expect(
          run(
            `<template>
  <custom   a="1"></custom>
</template>
`,
            [collapse],
          ),
        ).toBe(`<template>
  <custom   a="1" />
</template>
`);
      });

      it('prints reordered attributes in their new order', () => {
        const reverse: CodemodPlugin = {
          type: 'codemod',
          name: 'reverse-attrs',
          transform({ sfcAST, utils: { astHelpers } }) {
            const el = astHelpers.findFirst(sfcAST!, { type: 'VElement', name: 'div' })!;
            el.startTag.attributes.reverse();
            return 1;
          },
        };

        const result = run(
          `<template>
  <div
    a="1"
    b="2"
    c="3"
  >hi</div>
</template>
`,
          [reverse],
        );

        expect(result).toContain('c="3"');
        expect(result.indexOf('c="3"')).toBeLessThan(result.indexOf('a="1"'));
      });

      it('prints an attribute that was added at the front', () => {
        const unshift: CodemodPlugin = {
          type: 'codemod',
          name: 'unshift-attr',
          transform({ sfcAST, utils: { astHelpers, builders } }) {
            const el = astHelpers.findFirst(sfcAST!, { type: 'VElement', name: 'div' })!;
            el.startTag.attributes.unshift(
              builders.vAttribute(builders.vIdentifier('z'), builders.vLiteral('0')),
            );
            return 1;
          },
        };

        expect(
          run(
            `<template>
  <div
    a="1"
    b="2"
  >hi</div>
</template>
`,
            [unshift],
          ),
        ).toBe(`<template>
  <div z="0"
    a="1"
    b="2"
  >hi</div>
</template>
`);
      });
    });

    describe('comments', () => {
      it('prints the leading comment of a changed element exactly once', () => {
        expect(
          run(`<template>
  <!-- keep me --><button   a='1'>b</button>
</template>
`),
        ).toBe(`<template>
  <!-- keep me --><button   a='1' class="primary">b</button>
</template>
`);
      });

      it('prints a chain of leading comments exactly once', () => {
        expect(
          run(`<template>
  <!-- one --><!-- two --><button   a='1'>b</button>
</template>
`),
        ).toBe(`<template>
  <!-- one --><!-- two --><button   a='1' class="primary">b</button>
</template>
`);
      });

      it('handles several changed siblings that each carry a leading comment', () => {
        expect(
          run(`<template>
  <!-- a --><button   x='1'>1</button>
  <!-- b --><button   y='2'>2</button>
  <!-- c --><button   z='3'>3</button>
</template>
`),
        ).toBe(`<template>
  <!-- a --><button   x='1' class="primary">1</button>
  <!-- b --><button   y='2' class="primary">2</button>
  <!-- c --><button   z='3' class="primary">3</button>
</template>
`);
      });

      it('keeps a comment that sits inside a changed element', () => {
        expect(
          run(`<template>
  <button   a='1'><!-- inner -->text</button>
</template>
`),
        ).toBe(`<template>
  <button   a='1' class="primary"><!-- inner -->text</button>
</template>
`);
      });

      it('keeps the comment on an untouched sibling of a changed element', () => {
        expect(
          run(`<template>
  <!-- keep me -->
  <span   a='1'>x</span>
  <button>b</button>
</template>
`),
        ).toBe(`<template>
  <!-- keep me -->
  <span   a='1'>x</span>
  <button class="primary">b</button>
</template>
`);
      });
    });

    describe('source offsets', () => {
      it('handles multi-byte characters and emoji', () => {
        expect(
          run(`<template>
  <button   a="héllo 🎉 日本">🎉 tail</button>
</template>
`),
        ).toBe(`<template>
  <button   a="héllo 🎉 日本" class="primary">🎉 tail</button>
</template>
`);
      });

      it('handles CRLF line endings', () => {
        expect(
          run('<template>\r\n  <button\r\n    a="1"\r\n  >b</button>\r\n</template>\r\n'),
        ).toBe(
          '<template>\r\n  <button\r\n    a="1" class="primary"\r\n  >b</button>\r\n</template>\r\n',
        );
      });

      it('handles an attribute value that contains the tag delimiters', () => {
        expect(
          run(`<template>
  <button   a="1 > 0"   b="path/to/x/">b</button>
</template>
`),
        ).toBe(`<template>
  <button   a="1 > 0"   b="path/to/x/" class="primary">b</button>
</template>
`);
      });

      it('leaves an SFC without a template block alone', () => {
        const touchScript: CodemodPlugin = {
          type: 'codemod',
          name: 'touch-script',
          transform({ scriptASTs, utils: { traverseScriptAST } }) {
            let count = 0;

            for (const ast of scriptASTs) {
              traverseScriptAST(ast, {
                visitLiteral(path) {
                  if (typeof path.node.value === 'number') {
                    path.node.value = 42;
                    count++;
                  }

                  return this.traverse(path);
                },
              });
            }

            return count;
          },
        };

        expect(
          run(
            `<script setup>
const x = 1;
</script>
`,
            [touchScript],
          ),
        ).toBe(`<script setup>
const x = 42;
</script>
`);
      });
    });

    describe('stability', () => {
      const messy = `<template>
  <div    a='1'   b="2">  weird   spacing  </div>
</template>
`;

      it('leaves the file untouched when a codemod reports a count but mutates nothing', () => {
        expect(run(messy, [{ type: 'codemod', name: 'noop', transform: () => 3 }])).toBe(messy);
      });

      it('leaves the file untouched when a codemod reverts its own change', () => {
        const revert: CodemodPlugin = {
          type: 'codemod',
          name: 'revert',
          transform({ sfcAST, utils: { astHelpers } }) {
            let count = 0;

            for (const attr of astHelpers.findAll(sfcAST!, { type: 'VAttribute' })) {
              if (attr.directive || !attr.value) {
                continue;
              }

              const original = attr.value.value;
              attr.value.value = 'temp';
              attr.value.value = original;
              count++;
            }

            return count;
          },
        };

        expect(run(messy, [revert])).toBe(messy);
      });

      it('is stable when the output is transformed again', () => {
        const once = run(`<template>
  <button   x='1'>1</button>
</template>
`);

        expect(run(once, [{ type: 'codemod', name: 'noop', transform: () => 0 }])).toBe(once);
      });

      it('applies every plugin in a run', () => {
        expect(
          run(
            `<template>
  <button   x='1'>1</button>
  <div    y='2'>2</div>
</template>
`,
            [addClass, addClassTo('div')],
          ),
        ).toBe(`<template>
  <button   x='1' class="primary">1</button>
  <div    y='2' class="primary">2</div>
</template>
`);
      });

      it('does not leak the print context of one file into the next', () => {
        const breakComment: CodemodPlugin = {
          type: 'codemod',
          name: 'break-comment',
          transform({ sfcAST, utils: { astHelpers, builders } }) {
            const el = astHelpers.findFirst(sfcAST!, { type: 'VElement', name: 'button' })!;
            el.startTag.leadingComment = builders.htmlComment(' --> ');
            return 1;
          },
        };

        expect(() =>
          transform(
            `<template>
  <button>b</button>
</template>
`,
            'broken.vue',
            [breakComment],
          ),
        ).toThrow();

        // The next file still prints against its own source, not the one that threw.
        expect(
          run(`<template>
  <button   a='1'>b</button>
</template>
`),
        ).toBe(`<template>
  <button   a='1' class="primary">b</button>
</template>
`);
      });
    });
  });
});
