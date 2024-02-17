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
  it('', () => {
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
</script>`, 'file.vue', [{
      name: 'test',
      type: 'manual',
      find(scriptAST, templateAST, _filename, report, { astHelpers }) {
        if (scriptAST[0]) {
          const onCall = astHelpers.findFirst(scriptAST[0], {
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

        if (templateAST) {
          const div = astHelpers.findFirst(templateAST, {
            type: 'VElement',
            rawName: 'div',
          });

          if (div) {
            report(div, 'boop');
          }
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
      ]
    `);
  });
});
