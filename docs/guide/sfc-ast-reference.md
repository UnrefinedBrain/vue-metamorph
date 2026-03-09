# SFC AST Node Reference

This is a quick reference for the `<template>` AST node types that vue-eslint-parser produces.

## Node Types

### VDocumentFragment

The root of the template AST. This is what `sfcAST` points to.

```vue-html
<template>
  <div>Hello</div>
</template>
```

| Property | Type | Description |
| --- | --- | --- |
| `type` | `'VDocumentFragment'` | |
| `children` | `(VElement \| VText \| VExpressionContainer \| VStyleElement)[]` | Top-level nodes |
| `parent` | `null` | Always null |

### VElement

An HTML element or Vue component.

```vue-html
<div>...</div>
<MyComponent />
```

| Property | Type | Description |
| --- | --- | --- |
| `type` | `'VElement'` | |
| `name` | `string` | Lowercased for HTML elements, original case for components |
| `rawName` | `string` | Tag name as written in source |
| `namespace` | `Namespace` | Usually `NS.HTML` |
| `startTag` | `VStartTag` | |
| `children` | `(VElement \| VText \| VExpressionContainer)[]` | |
| `endTag` | `VEndTag \| null` | Null for self-closing and void elements |

### VStartTag

The opening tag, including all attributes and directives.

```vue-html
<div id="app" v-if="show">
```

| Property | Type | Description |
| --- | --- | --- |
| `type` | `'VStartTag'` | |
| `attributes` | `(VAttribute \| VDirective)[]` | Both static attributes and directives |
| `selfClosing` | `boolean` | `true` for `<br />`, `<MyComponent />` |

### VAttribute

A static attribute — no `v-` prefix, no `:` or `@` shorthand.

```vue-html
<div class="container" id="app" disabled>
     ^^^^^^^^^^^^^^^^^ ^^^^^^^^ ^^^^^^^^
```

| Property | Type | Description |
| --- | --- | --- |
| `type` | `'VAttribute'` | |
| `directive` | `false` | This is how you tell it apart from `VDirective` |
| `key` | `VIdentifier` | Attribute name |
| `value` | `VLiteral \| null` | Null for boolean attributes like `disabled` |

### VDirective

A Vue directive. `:prop`, `@click`, and `#slot` are all directives too — they're shorthands for `v-bind`, `v-on`, and `v-slot`.

Watch out: the AST `type` is `'VAttribute'`, not `'VDirective'`. You need to check `directive: true` to tell them apart from static attributes.

```vue-html
<div v-if="show" :class="classes" @click="handler" v-model.trim="value">
     ^^^^^^^^^^^ ^^^^^^^^^^^^^^^^ ^^^^^^^^^^^^^^^^ ^^^^^^^^^^^^^^^^^^^^
```

| Property | Type | Description |
| --- | --- | --- |
| `type` | `'VAttribute'` | Same as `VAttribute` — check `directive` |
| `directive` | `true` | |
| `key` | `VDirectiveKey` | The directive name, argument, and modifiers |
| `value` | `VExpressionContainer \| null` | The expression in quotes |

### VDirectiveKey

The name, argument, and modifiers of a directive — everything to the left of `=`.

```
v-on:click.prevent.stop
^^^^                      name     → VIdentifier (name: 'on')
     ^^^^^                argument → VIdentifier (name: 'click')
           ^^^^^^^ ^^^^   modifiers → VIdentifier[] (['prevent', 'stop'])
```

| Property | Type | Description |
| --- | --- | --- |
| `type` | `'VDirectiveKey'` | |
| `name` | `VIdentifier` | `if`, `bind`, `on`, `model`, `slot`, etc. |
| `argument` | `VExpressionContainer \| VIdentifier \| null` | Static arg = `VIdentifier`, dynamic `[arg]` = `VExpressionContainer` |
| `modifiers` | `VIdentifier[]` | `.prevent`, `.stop`, `.trim`, etc. |

Shorthands and their `name` values:

| Syntax | `key.name.name` | `key.name.rawName` |
| --- | --- | --- |
| `v-if` | `'if'` | `'if'` |
| `v-for` | `'for'` | `'for'` |
| `v-model` | `'model'` | `'model'` |
| `:prop` | `'bind'` | `':'` |
| `@click` | `'on'` | `'@'` |
| `#default` | `'slot'` | `'#'` |

### VExpressionContainer

Wraps a JavaScript expression. You'll see these in two places: directive values (`v-if="expr"`) and text interpolation (`{{ expr }}`).

```vue-html
<div v-if="count > 0">{{ message }}</div>
           ^^^^^^^^^    ^^^^^^^^^^^
```

| Property | Type | Description |
| --- | --- | --- |
| `type` | `'VExpressionContainer'` | |
| `expression` | JS expression \| `VForExpression` \| `VOnExpression` \| `VSlotScopeExpression` \| `null` | |

The `expression` inside is a regular JavaScript AST node (`Identifier`, `BinaryExpression`, `MemberExpression`, etc.), except for the special Vue expression types described below.

### VIdentifier

Used for attribute names, directive names, directive arguments, and directive modifiers. This is not the same as a JavaScript `Identifier`.

```vue-html
<div class="foo" v-on:click.prevent="handler">
     ^^^^^         ^^ ^^^^^ ^^^^^^^
```

| Property | Type | Description |
| --- | --- | --- |
| `type` | `'VIdentifier'` | |
| `name` | `string` | Normalized name |
| `rawName` | `string` | As written in source (e.g. `':'` for `v-bind` shorthand) |

### VLiteral

The quoted value of a static attribute.

```vue-html
<div class="container">
           ^^^^^^^^^^^
```

| Property | Type | Description |
| --- | --- | --- |
| `type` | `'VLiteral'` | |
| `value` | `string` | |

### VText

Plain text inside an element.

```vue-html
<p>Hello, world!</p>
   ^^^^^^^^^^^^^
```

| Property | Type | Description |
| --- | --- | --- |
| `type` | `'VText'` | |
| `value` | `string` | |

### VEndTag

The closing tag of an element. Not present on self-closing or void elements.

| Property | Type | Description |
| --- | --- | --- |
| `type` | `'VEndTag'` | |

### HtmlComment

An HTML comment. Can be attached to other nodes via their `leadingComment` property.

```vue-html
<!-- TODO: fix this -->
<div>content</div>
```

| Property | Type | Description |
| --- | --- | --- |
| `type` | `'HtmlComment'` | |
| `value` | `string` | The comment text |

## Special Expression Types

These show up inside `VExpressionContainer` for certain directives.

### VForExpression

The parsed `v-for` expression.

```vue-html
<div v-for="(item, index) in items">
             ^^^^  ^^^^^     ^^^^^
             left            right
```

| Property | Type | Description |
| --- | --- | --- |
| `type` | `'VForExpression'` | |
| `left` | `PatternKind[]` | Iteration variables (`item`, `index`, etc.) |
| `right` | `ExpressionKind` | The collection being iterated |

### VOnExpression

Used when `v-on` has multiple statements.

```vue-html
<button @click="doA(); doB()">
```

| Property | Type | Description |
| --- | --- | --- |
| `type` | `'VOnExpression'` | |
| `body` | `StatementKind[]` | |

### VSlotScopeExpression

The slot scope parameters.

```vue-html
<template #default="{ item, index }">
```

| Property | Type | Description |
| --- | --- | --- |
| `type` | `'VSlotScopeExpression'` | |
| `params` | `PatternKind[]` | |

### VFilterSequenceExpression / VFilter

Vue 2 filter syntax. Probably not relevant if you're working with Vue 3.

```vue-html
{{ message | capitalize | truncate(50) }}
```

## Finding Nodes

Some common `findAll` patterns:

```ts
// All <MyComponent> elements
astHelpers.findAll(sfcAST, { type: 'VElement', name: 'MyComponent' });

// All v-if directives
astHelpers.findAll(sfcAST, {
  type: 'VAttribute',
  directive: true,
  key: { type: 'VDirectiveKey', name: { name: 'if' } },
});

// All :prop bindings (v-bind shorthand)
astHelpers.findAll(sfcAST, {
  type: 'VAttribute',
  directive: true,
  key: { type: 'VDirectiveKey', name: { name: 'bind' } },
});

// All @click handlers
astHelpers.findAll(sfcAST, {
  type: 'VAttribute',
  directive: true,
  key: {
    type: 'VDirectiveKey',
    name: { name: 'on' },
    argument: { type: 'VIdentifier', name: 'click' },
  },
});

// All static class="..." attributes
astHelpers.findAll(sfcAST, {
  type: 'VAttribute',
  directive: false,
  key: { name: 'class' },
});
```
