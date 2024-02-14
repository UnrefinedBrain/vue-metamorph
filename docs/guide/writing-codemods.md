# Writing Codemods - Manipulating Source Code

## Basics

In a nutshell, a vue-metamorph codemod is a function that you define, which is passed two ASTs - the script AST, and the template AST. Your function can traverse and mutate these ASTs, and vue-metamorph will detect your changes and apply them to your source code file.

In a `.js` or `.ts` file, the template AST will always be null.

## Hello, World!

A simple codemod that changes all string literals to `'Hello, world!'` would look like:

```ts
import type { CodemodPlugin } from 'vue-metamorph';

const changeStringLiterals: CodemodPlugin = {
  type: 'codemod',
  name: 'change string literals to hello, world',

  transform(scriptAST, templateAST, filename, { traverseScriptAST, traverseTemplateAST }) {
    // codemod plugins self-report the number of transforms it made
    // this is only used to print the stats in CLI output
    let transformCount = 0;

    if (scriptAST) {
      // traverseScriptAST is an alias for the ast-types 'visit' function
      // see: https://github.com/benjamn/ast-types#ast-traversal
      traverseScriptAST(scriptAST, {
        visitLiteral(path) {
          if (typeof path.node.value === 'string') {
            // mutate the node
            path.node.value = 'Hello, world!';
            transformCount++;
          }

          return this.traverse(path);
        }
      });
    }

    if (templateAST) {
      traverseTemplateAST(templateAST, {
        enterNode(node) {
          if (node.type === 'Literal' && typeof node.value === 'string') {
            // mutate the node
            node.value = 'Hello, world!';
            transformCount++;
          }
        },
        leaveNode() {

        },
      });
    }

    return transformCount;
  }
}

```

::: tip

Codemods can choose which files to operate on using the `filename` parameter. For example, if a codemod should only touch files ending in `.spec.js` or `.spec.ts`:

```ts
const codemod = {
  transform(scriptAST, templateAST, filename) {
    if (!/\.spec\.[jt]s/g.test(filename)) {
      return;
    }

    // ...
  }
}
```

:::

## Code Comment Preservation

Recast does a fairly decent job of preserving code comments in JavaScript and TypeScript, but at this time, HTML comments inside of modified `<template>` nodes will not be re-printed.

## Code Formatting

The code printed by vue-metamorph will not be formatted perfectly. vue-metamorph's focus is on printing syntactically correct code. It's recommended to use a code formatter such as eslint, prettier, or similar to fix this formatting in accordance with your project's code style conventions.

## What about CSS?

CSS is not supported at this time.

## AST Explorer

[AST Explorer](https://astexplorer.net) is an invaluable tool for visualizing what the AST for a code snippet will look like. vue-metamorph uses [vue-eslint-parser](https://github.com/vuejs/vue-eslint-parser/blob/master/src/ast/nodes.ts) for the `<template>` AST. As the most detailed parser available for Vue files, it suits this use case fairly well, even if it was really meant for eslint.

Make sure to choose the correct parser:

| Source Type | Parser |
| - | - |
| Vue SFC `<template>` block | `vue-eslint-parser` / `@babel/parser` |
| Vue SFC `<script>` block | `@babel/parser` |
| JavaScript | `@babel/parser` |
| TypeScript |` @babel/parser` |

When using `@babel/parser` with AST Explorer, enable the `typescript` and `estree` parser plugins along with [this list](https://github.com/benjamn/recast/blob/master/parsers/_babel_options.ts#L23) to get an accurate representation of the AST you'll be working with.

## Testing

As you're developing your codemod, using automated testing is highly recommended! Generally, we know what we want our output to look like for any given input, and since codemods are pure functions, they are easy to test for using test-driven development. Anytime you run into an edge case in your codebase, add a test case for it!

For example, if we had a codemod that removed all `v-if` directives, define your input, expected output, and then assert that the transformation produces the expected output:

```ts
import { transform } from 'vue-metamorph';

it('should remove all v-ifs', () => {
  const source = `
<template>
  <div v-if="someCondition">
    <span v-if="anotherCondition">Hello, world!</span>
  </div>
</template>
`;

  const expected = `
<template>
  <div>
    <span>Hello, world!</span>
  </div>
</template>
`;

  expect(transform(source, 'file.vue', [myCodemod]).code).toBe(expected);
});
;
```