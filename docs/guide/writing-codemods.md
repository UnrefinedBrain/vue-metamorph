# Writing Codemods - Manipulating Source Code

## Basics

In a nutshell, a vue-metamorph codemod is a function that you define, which is passed several ASTs - `scriptASTs`, `sfcAST`, and `styleASTs`. Your function can traverse and mutate these ASTs by changing properties, or adding/removing nodes, and vue-metamorph will detect your changes and apply them to your source code file.

In a `.js` or `.ts` file, `sfcAST` will always be null.

## Hello, World!

A simple codemod that changes all string literals to `'Hello, world!'` would look like:

```ts twoslash
import type { CodemodPlugin } from 'vue-metamorph';

const changeStringLiterals: CodemodPlugin = {
  type: 'codemod',
  name: 'change string literals to hello, world',

  transform({ scriptASTs, sfcAST, styleASTs, filename, utils: { traverseScriptAST, traverseTemplateAST } }) {
    // codemod plugins self-report the number of transforms they made
    // this is used to print stats in CLI output, and to decide whether
    // the file needs to be re-written (see "Return Value" below)
    let transformCount = 0;

    // scriptASTs is an array of Program ASTs
    // in a js/ts file, this array will only have one item
    // in a vue file, this array will have one item for each <script> block
    for (const scriptAST of scriptASTs) {
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

    if (sfcAST) {
      // traverseTemplateAST is an alias for the vue-eslint-parser 'AST.traverseNodes' function
      // see: https://github.com/vuejs/vue-eslint-parser/blob/master/src/ast/traverse.ts#L118
      traverseTemplateAST(sfcAST, {
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
  transform({ filename }) {
    if (!/\.spec\.[jt]s/g.test(filename)) {
      return;
    }

    // ...
  }
}
```

:::

## Return Value

A codemod's `transform()` function should return the number of mutations it made to the AST. The CLI runner uses this value for two things:

1. Aggregating the per-plugin stats printed at the end of a run.
2. Deciding whether to write the file back to disk. If every codemod returns `0` for a given file, the CLI leaves the file on disk untouched.

This matters because the underlying printer ([recast](https://github.com/benjamn/recast)) preserves the original formatting for AST nodes it knows haven't been touched, but it can still make small, harmless formatting changes to the rest of the file when it re-prints (for example, normalizing quote styles or inserting trailing newlines). Gating the write on the reported count avoids touching files that didn't actually need to change.

The practical implication: if your codemod mutates the AST, it must return a non-zero count, otherwise the CLI will discard those mutations. Conversely, if your codemod only inspects the AST without mutating it, returning `0` is correct and will leave the file alone.

## HTML Code Comments

Certain `<template>` node types (`VExpressionContainer`, `VText`, `VStartTag`, `VEndTag`, `HtmlComment`) have a `leadingComment` property that contains a `HtmlComment` node that is attached to the node and will be printed directly prior to it.

Note: a `VExpressionContainer`'s `leadingComment` will only be printed if the `VExpressionContainer` is a direct child of a `VElement`.

## Code Formatting

The code printed by vue-metamorph will not be formatted perfectly. vue-metamorph's aim is only to print syntactically correct code. It's recommended to use a code formatter such as eslint, prettier, or similar to fix this formatting in accordance with your project's code style conventions.

## CSS

CSS codemods are supported as of vue-metamorph v3.1.0. Supported syntaxes include css, sass, scss, less and stylus.

Each codemod plugin will be passed an array of [PostCSS Root](https://postcss.org/api/#root) objects. Use the PostCSS API to make changes to the stylesheets.

## AST Explorer

Seeing the AST for a snippet is the fastest way to work out what to traverse. The
[AST Explorer](/explorer) built into these docs runs vue-metamorph's own parsers, so what it shows is
exactly what your codemod is handed: the `sfcAST` for the template, one `scriptASTs` entry per
`<script>` block, and one `styleASTs` entry per `<style>` block.

Move the cursor through the source and the tree follows it; hover a node in the tree and its source
range lights up. Tick **Codemod** to write a plugin next to it and watch the transformed output
update as you type.

These are the parsers behind each source type:

| Source Type | Parser |
| - | - |
| Vue SFC `<template>` | [vue-eslint-parser](https://github.com/vuejs/vue-eslint-parser/blob/master/src/ast/nodes.ts) |
| Vue SFC `<script>`, JavaScript, TypeScript | `@babel/parser`, via [recast](https://github.com/benjamn/recast) |
| Vue SFC `<style>`, CSS | `postcss` |
| SCSS | `postcss-scss` |
| Sass | `postcss-sass` |
| Less | `postcss-less` |
| Stylus | `postcss-styl` |

vue-eslint-parser was really meant for eslint, but it is the most detailed parser available for Vue
files and it suits this use case well.

Stylus is the one dialect the in-docs explorer cannot show: its parser only runs in Node. Use the
[postcss-styl playground](https://stylus.github.io/postcss-styl/) for those, and note that
vue-metamorph itself handles stylus normally.

If you would rather use [astexplorer.net](https://astexplorer.net), pick `@babel/parser` for script
code and enable [this list](https://github.com/UnrefinedBrain/vue-metamorph/blob/master/src/parse/typescript.ts#L15-L53)
of plugins to get an accurate representation of the AST you'll be working with.

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
```
