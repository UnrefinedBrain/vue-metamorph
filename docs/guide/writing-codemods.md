# Write a codemod

## Basics

A vue-metamorph codemod is a function that you define. vue-metamorph passes several ASTs to your
function — `scriptASTs`, `sfcAST`, and `styleASTs` — and your function traverses and mutates
those ASTs by changing properties or by adding and removing nodes. vue-metamorph then detects
your changes and applies them to your source code file.

In a JavaScript or TypeScript file, `sfcAST` is always `null`.

## A first codemod

The following codemod changes every string literal to `Hello, world!`:

```ts twoslash
import type { CodemodPlugin } from 'vue-metamorph';

const changeStringLiterals: CodemodPlugin = {
  type: 'codemod',
  name: 'change string literals to hello, world',

  transform({ scriptASTs, sfcAST, styleASTs, filename, utils: { traverseScriptAST, traverseTemplateAST } }) {
    // codemod plugins self-report the number of transforms they made
    // this count is used to print stats in CLI output, and to decide whether
    // the file needs to be rewritten (see the "Return value" section)
    let transformCount = 0;

    // scriptASTs is an array of Program ASTs
    // in a js/ts file, this array has one item
    // in a vue file, this array has one item for each <script> block
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

A codemod can use the `filename` parameter to choose which files to operate on. For example, to
transform only the files that end in `.spec.js` or `.spec.ts`:

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

## Return value

The `transform()` function of a codemod must return the number of mutations that it made to the
AST. The CLI runner uses this value for two purposes:

1. Aggregating the per-plugin stats that it prints at the end of a run.
2. Deciding whether to write the file back to disk. If every codemod returns `0` for a given
   file, the CLI leaves the file on disk untouched.

The return value matters because of how the underlying printer,
[recast](https://github.com/benjamn/recast), works. Recast preserves the original formatting for
AST nodes that it knows are untouched, but it can still make small, harmless formatting changes
to the rest of the file when it reprints, such as normalizing quote styles or inserting trailing
newlines. Gating the write on the reported count keeps the CLI from touching files that don't
need to change.

So if your codemod mutates the AST, it must return a non-zero count. Otherwise, the CLI discards
those mutations. If your codemod only inspects the AST without mutating it, returning `0` is
correct and leaves the file alone.

## HTML comments

Some `<template>` node types — `VExpressionContainer`, `VText`, `VStartTag`, `VEndTag`, and
`HtmlComment` — have a `leadingComment` property that holds an `HtmlComment` node. vue-metamorph
prints that comment directly before the node it's attached to.

The `leadingComment` property of a `VExpressionContainer` node is printed only when the
`VExpressionContainer` is a direct child of a `VElement`.

## Code formatting

vue-metamorph reuses the original source text for the parts of a file that your codemod didn't
change. In a `<template>`, an element that your codemod leaves alone keeps its source text
exactly, and an element that your codemod does change keeps the original text of its untouched
attributes, along with the whitespace that separated them. So a change to one attribute leaves
the line breaks and the quote style of the rest of the tag alone.

The parts that vue-metamorph does print, such as a node that your codemod built, come out
syntactically correct rather than well-formatted. We recommend that you run a code formatter such
as ESLint, Prettier, Biome, oxfmt, etc. afterwards to bring those parts in line with your project's code style
conventions.

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

We recommend that you write automated tests as you develop a codemod. You usually know what you
want the output to look like for a given input, and codemods are pure functions, so they're
straightforward to test. Each time you run into an edge case in your codebase, add a test case
for it.

For example, for a codemod that removes every `v-if` directive, define the input and the expected
output, then assert that the transformation produces the expected output:

```ts
import { transform } from 'vue-metamorph';

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

  expect(transform(source, 'file.vue', [myCodemod]).code).toBe(expected);
});
```
