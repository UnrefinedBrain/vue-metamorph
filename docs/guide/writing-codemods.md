# Write a codemod

A codemod plugin changes source code by modifying an abstract syntax tree (AST).
vue-metamorph parses the source, passes the ASTs to your plugin, and prints the result.
The CLI runner writes that result to disk when a plugin reports changes.

## Write a script codemod

This plugin changes string literals to `Hello, world!`. Return the number of values
that you changed, or `0` when the source already has the desired values:

```ts twoslash
import { transform, type CodemodPlugin } from 'vue-metamorph';

const changeStringLiterals: CodemodPlugin = {
  type: 'codemod',
  name: 'change-string-literals',
  transform({ scriptASTs, utils: { traverseScriptAST } }) {
    let count = 0;
    for (const script of scriptASTs) {
      traverseScriptAST(script, {
        visitLiteral(path) {
          if (typeof path.node.value === 'string'
            && path.node.value !== 'Hello, world!') {
            path.node.value = 'Hello, world!';
            count++;
          }
          this.traverse(path);
        },
      });
    }
    return count;
  },
};

const result = transform(
  "const message = 'Goodbye';",
  'example.js',
  [changeStringLiterals],
);
console.log(result.code);
```

The output is:

```js
const message = 'Hello, world!';
```

The `transform()` library function returns code without writing a file. To run a
plugin against files on disk, register it with the
[CLI runner](./cli.md#api).

The `scriptASTs` array contains the module AST for a JavaScript or TypeScript file.
For a Vue file, it contains the ASTs of nonempty `<script>` blocks.
`traverseScriptAST()` visits script nodes. In each visitor, call `this.traverse(path)`
to continue into child nodes.

## Write a template codemod

For a Vue file, `sfcAST` is the root of the entire single-file component (SFC).
It includes the `<template>`, `<script>`, and `<style>` elements. For other file types,
`sfcAST` is `null`.

Use `traverseTemplateAST()` to visit template nodes. This example removes `v-if`
directives. Save it in a file named `remove-v-if.ts` to use it in the test later in this guide:

```ts twoslash
import type { CodemodPlugin } from 'vue-metamorph';

export const removeVIf: CodemodPlugin = {
  type: 'codemod',
  name: 'remove-v-if',
  transform({ sfcAST, utils: { traverseTemplateAST } }) {
    if (!sfcAST) {
      return 0;
    }
    let count = 0;
    traverseTemplateAST(sfcAST, {
      enterNode(node) {
        if (node.type !== 'VElement') {
          return;
        }
        const attributes = node.startTag.attributes;
        node.startTag.attributes = attributes.filter((attribute) =>
          !attribute.directive || attribute.key.name.name !== 'if',
        );
        count += attributes.length - node.startTag.attributes.length;
      },
    });
    return count;
  },
};
```

For example, this plugin changes `<div v-if="visible">Hello</div>` to
`<div>Hello</div>`. For node shapes and matching examples, see the
[SFC AST node reference](./sfc-ast-reference.md).

## Choose files by name

Use `filename` when a plugin applies to only some of the files selected by the CLI.
This example replaces string literals only in files ending in `.spec.js` or `.spec.ts`:

```ts twoslash
import type { CodemodPlugin } from 'vue-metamorph';

const updateTestStrings: CodemodPlugin = {
  type: 'codemod',
  name: 'update-test-strings',
  transform({ filename, scriptASTs, utils: { astHelpers } }) {
    if (!/\.spec\.[jt]s$/.test(filename)) {
      return 0;
    }
    let count = 0;
    for (const script of scriptASTs) {
      for (const literal of astHelpers.findAll(script, { type: 'Literal' })) {
        if (literal.value === 'Goodbye') {
          literal.value = 'Hello, world!';
          count++;
        }
      }
    }
    return count;
  },
};
```

## Return value

Return the number of AST mutations that your plugin made. The CLI adds these counts
to its statistics and writes a file if at least one codemod reports a positive count.
If every codemod returns `0`, the CLI leaves the file on disk untouched.

A positive count causes the CLI to write the combined output of all codemods for
that file. Each plugin must therefore report its own mutations accurately.

This rule avoids rewriting files solely because the printer changed formatting,
such as a trailing newline. It applies to CLI writes; the `transform()` library
function returns the printed code regardless of the reported counts.

## HTML comments

The `VExpressionContainer`, `VText`, `VStartTag`, `VEndTag`, and `HtmlComment` node types have a `leadingComment` property that holds an `HtmlComment` node. vue-metamorph
prints that comment directly before the node it's attached to.

The `leadingComment` property of a `VExpressionContainer` node is printed only when the
`VExpressionContainer` is a direct child of a `VElement`.

## Code formatting

vue-metamorph reuses source text for unchanged nodes when their source ranges allow it.
For template attributes, it also preserves the whitespace between untouched attributes.

New or changed nodes can have different spacing or quotes from the surrounding code.
Run your project's formatter after applying a codemod to make the output consistent.

## CSS

vue-metamorph supports CSS codemods in version 3.1.0 and later. The supported syntaxes are CSS,
Sass, SCSS, Less, and Stylus.

vue-metamorph passes each codemod plugin an array of [PostCSS `Root`](https://postcss.org/api/#root)
objects. Use the PostCSS API to change the stylesheets.

## Playground

To work out what to traverse, look at the AST for a snippet. The [Playground](/playground) built
into these docs runs vue-metamorph's own parsers, so what it shows is what your codemod receives:
the `sfcAST` for the template, one `scriptASTs` entry per `<script>` block, and one `styleASTs`
entry per `<style>` block.

As you move the cursor through the source, the tree follows it. Hold the pointer over a node in
the tree to highlight the source range for that node. To write a plugin next to the source and
watch the transformed output update as you type, select the **Codemod** checkbox.

The Playground uses the following parsers:

| Source type | Parser |
| - | - |
| Vue SFC `<template>` | [vue-eslint-parser](https://github.com/vuejs/vue-eslint-parser/blob/master/src/ast/nodes.ts) |
| Vue SFC `<script>`, JavaScript, TypeScript | `@babel/parser`, through [recast](https://github.com/benjamn/recast) |
| Vue SFC `<style>`, CSS | `postcss` |
| SCSS | `postcss-scss` |
| Sass | `postcss-sass` |
| Less | `postcss-less` |
| Stylus | `postcss-styl` |

vue-eslint-parser is built for ESLint, but it produces a detailed AST for Vue files that suits
this use case well.

Stylus is the one dialect that the Playground can't show, because its parser runs only in
Node.js. To inspect a Stylus AST, use the
[postcss-styl AST visualizer](https://stylus.github.io/postcss-styl/). vue-metamorph itself
handles Stylus the same way it handles the other dialects.

The Playground is a port of Felix Kling's
[AST Explorer](https://github.com/fkling/astexplorer). To use
[astexplorer.net](https://astexplorer.net) instead, select `@babel/parser` for script code and
enable the
[Babel plugins that vue-metamorph enables](https://github.com/UnrefinedBrain/vue-metamorph/blob/master/src/parse/typescript.ts#L15-L53),
so that you get an accurate representation of the AST that you'll work with.

## Testing

Test each codemod with representative input and expected output. Add a regression test
whenever you find an edge case. You can test transformations without reading or writing files.

For example, for a codemod that removes every `v-if` directive, define the input and the expected
output, then assert that the transformation produces the expected output:

```ts
import { expect, it } from 'vitest';
import { transform } from 'vue-metamorph';
import { removeVIf } from './remove-v-if';

it('removes all v-if directives', () => {
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

  expect(transform(source, 'file.vue', [removeVIf]).code).toBe(expected);
});
```
