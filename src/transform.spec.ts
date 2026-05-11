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
});
