# Helpers and Builders

vue-metamorph provides a set of helper functions and builder functions through the `utils` object passed to your plugin's `transform()` or `find()` function.

```ts
const myCodemod: CodemodPlugin = {
  type: 'codemod',
  name: 'my-codemod',
  transform({ scriptASTs, sfcAST, utils }) {
    // utils.astHelpers   - functions for finding nodes and managing imports
    // utils.builders     - functions for creating new AST nodes
  }
}
```

## AST Helpers

### findFirst

Finds the first node in an AST that matches a partial object. Works with both script and template ASTs.

```ts
const { astHelpers } = utils;

// find the first <div> in the template
const div = astHelpers.findFirst(sfcAST, {
  type: 'VElement',
  name: 'div',
});

// find the first call to `console.log` in a script
const consoleLog = astHelpers.findFirst(scriptAST, {
  type: 'CallExpression',
  callee: {
    type: 'MemberExpression',
    object: { type: 'Identifier', name: 'console' },
    property: { type: 'Identifier', name: 'log' },
  },
});
```

Returns the first matching node, or `null` if no match was found.

### findAll

Finds all nodes in an AST that match a partial object.

```ts
const { astHelpers } = utils;

// find all <custom> elements in the template
const elements = astHelpers.findAll(sfcAST, {
  type: 'VElement',
  name: 'custom',
});

// find all call expressions in a script
const calls = astHelpers.findAll(scriptAST, {
  type: 'CallExpression',
});
```

Returns an array of all matching nodes.

### findImportDeclaration

Finds an existing import declaration for a module.

```ts
const { astHelpers } = utils;

const vueImport = astHelpers.findImportDeclaration(scriptAST, 'vue');

if (vueImport) {
  // an import from 'vue' exists
}
```

Returns the `ImportDeclaration` node, or `null`.

### createNamedImport

Adds a named import to a script AST. If an import declaration for the module already exists, the new specifier is added to it. Duplicate imports are not created.

```ts
const { astHelpers } = utils;

// import { defineComponent } from 'vue';
astHelpers.createNamedImport(scriptAST, 'vue', 'defineComponent');

// import { map as lodashMap } from 'lodash-es';
astHelpers.createNamedImport(scriptAST, 'lodash-es', 'map', 'lodashMap');
```

### createDefaultImport

Adds a default import to a script AST. Follows the same merging and deduplication logic as `createNamedImport`.

```ts
const { astHelpers } = utils;

// import Vue from 'vue';
astHelpers.createDefaultImport(scriptAST, 'vue', 'Vue');
```

### createNamespaceImport

Adds a namespace import to a script AST. Follows the same merging and deduplication logic as `createNamedImport`.

```ts
const { astHelpers } = utils;

// import * as _ from 'lodash-es';
astHelpers.createNamespaceImport(scriptAST, 'lodash-es', '_');
```

### findVueComponentOptions

Finds all Options API object expressions in a script. Detects `defineComponent()`, `Vue.extend()`, `Vue.component()`, `Vue.mixin()`, `new Vue()`, and (when `isSfc` is `true`) the default export.

```ts
const { astHelpers } = utils;

for (const scriptAST of scriptASTs) {
  const optionsObjects = astHelpers.findVueComponentOptions(scriptAST, sfcAST !== null);

  for (const obj of optionsObjects) {
    // obj is an ObjectExpression node — the { ... } passed to defineComponent(), etc.
  }
}
```

## Template Builders

The `utils.builders` object includes functions for creating new template AST nodes. These are useful when your codemod needs to insert new elements, attributes, or directives into the `<template>`.

::: tip

After building new nodes and inserting them into the AST, call `builders.setParents()` on the root of the new subtree. Builder functions leave `parent` references unset — `setParents` fills them in.

```ts
const newElement = builders.vElement('div', builders.vStartTag([], false), []);
builders.setParents(sfcAST); // fix parent references
```

:::

### vElement

Creates a new element node. An end tag is created automatically unless the tag is self-closing or a void element.

```ts
const { builders } = utils;

const div = builders.vElement(
  'div',
  builders.vStartTag([
    builders.vAttribute(builders.vIdentifier('class'), builders.vLiteral('container')),
  ], false),
  [builders.vText('Hello')],
);
// <div class="container">Hello</div>
```

### vStartTag

Creates a start tag with attributes and/or directives.

```ts
const { builders } = utils;

const startTag = builders.vStartTag(
  [
    builders.vAttribute(builders.vIdentifier('id'), builders.vLiteral('app')),
  ],
  false, // selfClosing
);
```

### vAttribute

Creates a static attribute.

```ts
const { builders } = utils;

// class="active"
const attr = builders.vAttribute(
  builders.vIdentifier('class'),
  builders.vLiteral('active'),
);

// disabled (boolean attribute, no value)
const disabled = builders.vAttribute(
  builders.vIdentifier('disabled'),
  null,
);
```

### vDirective

Creates a Vue directive. Note that `VDirective` has the AST type `'VAttribute'` with `directive: true`.

```ts
const { builders } = utils;

// v-if="visible"
const vIf = builders.vDirective(
  builders.vDirectiveKey(builders.vIdentifier('if')),
  builders.vExpressionContainer(builders.identifier('visible')),
);

// :key="item.id"
const vBindKey = builders.vDirective(
  builders.vDirectiveKey(
    builders.vIdentifier('bind', ':'),
    builders.vIdentifier('key'),
  ),
  builders.vExpressionContainer(
    builders.memberExpression(
      builders.identifier('item'),
      builders.identifier('id'),
    ),
  ),
);
```

### vDirectiveKey

Creates the key part of a directive: `v-name:argument.modifier1.modifier2`.

```ts
const { builders } = utils;

// v-on:click.prevent
const key = builders.vDirectiveKey(
  builders.vIdentifier('on'),
  builders.vIdentifier('click'),
  [builders.vIdentifier('prevent')],
);
```

### vExpressionContainer

Creates an expression container (`{{ }}` in text, or a directive value).

```ts
const { builders } = utils;

// {{ message }}
const interpolation = builders.vExpressionContainer(
  builders.identifier('message'),
);
```

### vText

Creates a text node.

```ts
const { builders } = utils;

const text = builders.vText('Hello, world!');
```

### vIdentifier

Creates an identifier node for attribute names, directive names, etc. The optional `rawName` parameter controls what gets printed — useful for directive shorthands.

```ts
const { builders } = utils;

builders.vIdentifier('class');          // prints: class
builders.vIdentifier('bind', ':');      // name is 'bind', prints as ':'
builders.vIdentifier('on', '@');        // name is 'on', prints as '@'
```

### vLiteral

Creates a string literal node for static attribute values.

```ts
const { builders } = utils;

builders.vLiteral('my-class'); // used with vAttribute for: class="my-class"
```

### htmlComment

Creates an HTML comment node. Can be attached to other nodes via their `leadingComment` parameter.

```ts
const { builders } = utils;

const comment = builders.htmlComment('TODO: refactor this');
const text = builders.vText('Hello', comment);
// <!-- TODO: refactor this -->Hello
```

### setParents

Traverses a node tree and sets the `parent` property on each descendant. Call this after building and inserting new nodes.

```ts
const { builders } = utils;

// after inserting new nodes into sfcAST:
builders.setParents(sfcAST);
```

## Script Builders

`utils.builders` also includes all script AST builders from [ast-types](https://github.com/benjamn/ast-types). These are used to create JavaScript/TypeScript AST nodes.

```ts
const { builders } = utils;

// 'hello'
builders.literal('hello');

// myVariable
builders.identifier('myVariable');

// a + b
builders.binaryExpression('+', builders.identifier('a'), builders.identifier('b'));

// myFunction()
builders.callExpression(builders.identifier('myFunction'), []);
```

See the [ast-types documentation](https://github.com/benjamn/ast-types) and [AST Explorer](https://astexplorer.net) (with `@babel/parser`) for the full list of available builders.
