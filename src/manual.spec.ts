import { describe, expect, it } from 'vitest';
import { sample, findManualMigrations } from './manual';

describe('codeSample', () => {
  it('should point to values on a single line', () => {
    const output = sample({
      code: `<template>
  <div>
    Hello
  </div>
</template>

<script>
export default {

}
</script>
`,
      lineStart: 1,
      lineEnd: 1,
      columnStart: 1,
      columnEnd: 10,
      extraLines: 3,
    });

    expect(output).toBe(`
1 | <template>
  | ^^^^^^^^^^
2 |   <div>
3 |     Hello
4 |   </div>
`.trim());
  });

  it('should point to values on two lines', () => {
    const output = sample({
      code: `<template>
  <div>
    Hello
  </div>
</template>

<script>
export default {

}
</script>
`,
      lineStart: 1,
      lineEnd: 2,
      columnStart: 1,
      columnEnd: 7,
      extraLines: 3,
    });

    expect(output).toBe(`
1 | <template>
  | ^^^^^^^^^^
2 |   <div>
  | ^^^^^^^
3 |     Hello
4 |   </div>
5 | </template>
`.trim());
  });

  it('should point to values on more than two lines', () => {
    const output = sample({
      code: `<template>
  <div>
    Hello
  </div>
</template>
<script>
export default {
}
</script>
`,
      lineStart: 1,
      lineEnd: 5,
      columnStart: 1,
      columnEnd: 11,
      extraLines: 3,
    });

    expect(output).toBe(`
1 | <template>
  | ^^^^^^^^^^
2 |   <div>
  | ^^^^^^^
3 |     Hello
  | ^^^^^^^^^
4 |   </div>
  | ^^^^^^^^
5 | </template>
  | ^^^^^^^^^^^
6 | <script>
7 | export default {
8 | }
`.trim());
  });
});

describe('find', () => {
  it('should find manual migrations in vue files', () => {
    const res = findManualMigrations(`<template>
  <div>
    Hello
  </div>
</template>

<script>
export default {
  methods: {
    thing() {
      this.$on('test', something);
    }
  }
};
</script>

<style>
.foo {
  color: red;
}
</style>`, 'file.vue', [{
      name: 'test',
      type: 'manual',
      find({
        scriptASTs,
        sfcAST,
        styleASTs,
        report,
        utils: { astHelpers },
      }) {
        if (scriptASTs[0]) {
          const onCall = astHelpers.findFirst(scriptASTs[0], {
            type: 'CallExpression',
            callee: {
              type: 'MemberExpression',
              object: { type: 'ThisExpression' },
              property: {
                type: 'Identifier',
                name: '$on',
              },
            },
          });
          if (onCall) {
            report(onCall, 'Do the thing');
          }
        }

        if (sfcAST) {
          const div = astHelpers.findFirst(sfcAST, {
            type: 'VElement',
            rawName: 'div',
          });

          if (div) {
            report(div, 'boop');
          }
        }

        for (const style of styleASTs) {
          style.walkDecls('color', (decl) => {
            report(decl, 'Do not use color');
          });
        }
      },
    }]);

    expect(res).toMatchInlineSnapshot(`
      [
        {
          "columnEnd": 33,
          "columnStart": 7,
          "file": "file.vue",
          "lineEnd": 11,
          "lineStart": 11,
          "message": "Do the thing",
          "pluginName": "test",
          "snippet": " 8 | export default {
       9 |   methods: {
      10 |     thing() {
      11 |       this.$on('test', something);
         |       ^^^^^^^^^^^^^^^^^^^^^^^^^^^
      12 |     }
      13 |   }
      14 | };",
        },
        {
          "columnEnd": 8,
          "columnStart": 3,
          "file": "file.vue",
          "lineEnd": 4,
          "lineStart": 2,
          "message": "boop",
          "pluginName": "test",
          "snippet": "1 | <template>
      2 |   <div>
        |   ^^^^^
      3 |     Hello
        | ^^^^^^^^^
      4 |   </div>
        | ^^^^^^^^
      5 | </template>
      6 | 
      7 | <script>",
        },
        {
          "columnEnd": 12,
          "columnStart": 3,
          "file": "file.vue",
          "lineEnd": 19,
          "lineStart": 19,
          "message": "Do not use color",
          "pluginName": "test",
          "snippet": "16 | 
      17 | <style>
      18 | .foo {
      19 |   color: red;
         |   ^^^^^^^^^^
      20 | }
      21 | </style>",
        },
      ]
    `);
  });

  it('should find manual migrations in ts files', () => {
    const res = findManualMigrations(
      `import something from 'somewhere';
console.log('')`,
      'file.js',
      [{
        name: 'console-logs',
        type: 'manual',
        find({
          scriptASTs, sfcAST, filename, report, utils,
        }) {
          expect(sfcAST).toBeNull();
          expect(filename).toBe('file.js');
          expect(scriptASTs.length).toBe(1);

          utils.astHelpers.findAll(scriptASTs[0]!, {
            type: 'CallExpression',
            callee: {
              type: 'MemberExpression',
              object: {
                type: 'Identifier',
                name: 'console',
              },
            },
          }).forEach((node) => {
            report(node.callee, 'no console statements');
          });
        },
      }],
    );

    expect(res).toMatchInlineSnapshot(`
      [
        {
          "columnEnd": 11,
          "columnStart": 1,
          "file": "file.js",
          "lineEnd": 2,
          "lineStart": 2,
          "message": "no console statements",
          "pluginName": "console-logs",
          "snippet": "1 | import something from 'somewhere';
      2 | console.log('')
        | ^^^^^^^^^^^",
        },
      ]
    `);
  });

  it('should throw an error if report() is called with an invalid node type', () => {
    try {
      findManualMigrations(
        `import something from 'somewhere';
console.log('')`,
        'file.js',
        [{
          name: 'console-logs',
          type: 'manual',
          find({
            scriptASTs, sfcAST, filename, report, utils,
          }) {
            expect(sfcAST).toBeNull();
            expect(filename).toBe('file.js');
            expect(scriptASTs.length).toBe(1);

            utils.astHelpers.findAll(scriptASTs[0]!, {
              type: 'CallExpression',
              callee: {
                type: 'MemberExpression',
                object: {
                  type: 'Identifier',
                  name: 'console',
                },
              },
            }).forEach(() => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              report({} as any, 'no console statements');
            });
          },
        }],
      );
      expect.fail('should have thrown');
    } catch {
      // empty
    }
  });

  it('edge case 1', () => {
    const code = 'export default someCall();\nexport default someCall(\n1,\n2,\n3);';

    const ree = findManualMigrations(code, 'file.ts', [{
      type: 'manual',
      name: '',
      find({ scriptASTs, report, utils: { astHelpers } }) {
        for (const scriptAST of scriptASTs) {
          astHelpers.findAll(scriptAST, { type: 'CallExpression' }).forEach((node) => report(node, 'aa'));
        }
      },
    }]);
    expect(ree).toMatchInlineSnapshot(`
      [
        {
          "columnEnd": 25,
          "columnStart": 16,
          "file": "file.ts",
          "lineEnd": 1,
          "lineStart": 1,
          "message": "aa",
          "pluginName": "",
          "snippet": "1 | export default someCall();
        |                ^^^^^^^^^^
      2 | export default someCall(
      3 | 1,
      4 | 2,",
        },
        {
          "columnEnd": 2,
          "columnStart": 16,
          "file": "file.ts",
          "lineEnd": 5,
          "lineStart": 2,
          "message": "aa",
          "pluginName": "",
          "snippet": "1 | export default someCall();
      2 | export default someCall(
        |                ^^^^^^^^^
      3 | 1,
        | ^^
      4 | 2,
        | ^^
      5 | 3);
        | ^^",
        },
      ]
    `);
  });
});
