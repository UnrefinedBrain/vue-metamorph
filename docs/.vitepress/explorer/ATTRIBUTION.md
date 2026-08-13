# Attribution

The AST explorer in these docs is a Vue port of [AST Explorer](https://github.com/fkling/astexplorer)
by Felix Kling, trimmed to the parsers vue-metamorph uses and wired to
vue-metamorph's own `parseVue`/`parseTs`/`parseCss` and `transform`.

Files carrying ported code name their origin in a header comment. The tree
visualization (`core/tree-adapter.ts`, `core/use-open-state.ts`,
`core/stringify.ts`, `components/TreeElement.vue`, `components/AstTree.vue`,
`components/CompactArrayView.vue`, `components/CompactObjectView.vue`) and the
tree styling in `explorer.css` follow the original closely.

## AST Explorer license

```
The MIT License (MIT)

Copyright (c) 2014 Felix Kling

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
