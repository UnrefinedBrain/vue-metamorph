# SFC AST node reference

This page is a quick reference for the `<template>` AST node types that vue-eslint-parser
produces.

## Node types

### VDocumentFragment

The root of the template AST. The `sfcAST` parameter points to this node.

```vue-html
<template>
  <div>Hello</div>
</template>
```

| Property | Type | Description |
| --- | --- | --- |
| `type` | `'VDocumentFragment'` | |
| `children` | `(VElement \| VText \| VExpressionContainer \| VStyleElement)[]` | Top-level nodes |
| `parent` | `null` | Always `null` |

### VElement

An HTML element or a Vue component.

```vue-html
<div>...</div>
<MyComponent />
```

| Property | Type | Description |
| --- | --- | --- |
| `type` | `'VElement'` | |
| `name` | `string` | Lowercased for HTML elements, original case for components |
| `rawName` | `string` | The tag name as written in the source |
| `namespace` | `Namespace` | Usually `NS.HTML` |
| `startTag` | `VStartTag` | |
| `children` | `(VElement \| VText \| VExpressionContainer)[]` | |
| `endTag` | `VEndTag \| null` | `null` for self-closing elements and void elements |

### VStartTag

The opening tag, including all attributes and directives.

```vue-html
<div id="app" v-if="show">
```

| Property | Type | Description |
| --- | --- | --- |
| `type` | `'VStartTag'` | |
| `attributes` | `(VAttribute \| VDirective)[]` | Both static attributes and directives |
| `selfClosing` | `boolean` | `true` for `<br />` and `<MyComponent />` |

### VAttribute

A static attribute, with no `v-` prefix and no `:` or `@` shorthand.

```vue-html
<div class="container" id="app" disabled>
     ^^^^^^^^^^^^^^^^^ ^^^^^^^^ ^^^^^^^^
```

| Property | Type | Description |
| --- | --- | --- |
| `type` | `'VAttribute'` | |
| `directive` | `false` | How to tell this node apart from a `VDirective` node |
| `key` | `VIdentifier` | The attribute name |
| `value` | `VLiteral \| null` | `null` for boolean attributes such as `disabled` |

### VDirective

A Vue directive. `:prop`, `@click`, and `#slot` are directives too, because they're shorthands
for `v-bind`, `v-on`, and `v-slot`.

::: warning

The AST `type` of a directive is `'VAttribute'`, not `'VDirective'`. To tell a directive apart
from a static attribute, check for `directive: true`.

:::

```vue-html
<div v-if="show" :class="classes" @click="handler" v-model.trim="value">
     ^^^^^^^^^^^ ^^^^^^^^^^^^^^^^ ^^^^^^^^^^^^^^^^ ^^^^^^^^^^^^^^^^^^^^
```

| Property | Type | Description |
| --- | --- | --- |
| `type` | `'VAttribute'` | The same as `VAttribute` — check `directive` |
| `directive` | `true` | |
| `key` | `VDirectiveKey` | The directive name, argument, and modifiers |
| `value` | `VExpressionContainer \| null` | The expression in quotes |

### VDirectiveKey

The name, argument, and modifiers of a directive — everything to the left of the `=` sign.

```
v-on:click.prevent.stop
^^^^                      name     → VIdentifier (name: 'on')
     ^^^^^                argument → VIdentifier (name: 'click')
           ^^^^^^^ ^^^^   modifiers → VIdentifier[] (['prevent', 'stop'])
```

| Property | Type | Description |
| --- | --- | --- |
| `type` | `'VDirectiveKey'` | |
| `name` | `VIdentifier` | `if`, `bind`, `on`, `model`, `slot`, and so on |
| `argument` | `VExpressionContainer \| VIdentifier \| null` | A static argument is a `VIdentifier`, and a dynamic `[arg]` is a `VExpressionContainer` |
| `modifiers` | `VIdentifier[]` | `.prevent`, `.stop`, `.trim`, and so on |

The following table lists the shorthands and their `name` values:

| Syntax | `key.name.name` | `key.name.rawName` |
| --- | --- | --- |
| `v-if` | `'if'` | `'if'` |
| `v-for` | `'for'` | `'for'` |
| `v-model` | `'model'` | `'model'` |
| `:prop` | `'bind'` | `':'` |
| `@click` | `'on'` | `'@'` |
| `#default` | `'slot'` | `'#'` |

### VExpressionContainer

Wraps a JavaScript expression. These nodes appear in two places: directive values
(`v-if="expr"`) and text interpolation (`{{ expr }}`).

```vue-html
<div v-if="count > 0">{{ message }}</div>
           ^^^^^^^^^    ^^^^^^^^^^^
```

| Property | Type | Description |
| --- | --- | --- |
| `type` | `'VExpressionContainer'` | |
| `expression` | JS expression \| `VForExpression` \| `VOnExpression` \| `VSlotScopeExpression` \| `null` | |

The `expression` inside is a regular JavaScript AST node, such as `Identifier`,
`BinaryExpression`, or `MemberExpression`. The exceptions are the Vue expression types described
in [Special expression types](#special-expression-types).

### VIdentifier

Used for attribute names, directive names, directive arguments, and directive modifiers. A
`VIdentifier` node isn't the same as a JavaScript `Identifier` node.

```vue-html
<div class="foo" v-on:click.prevent="handler">
     ^^^^^         ^^ ^^^^^ ^^^^^^^
```

| Property | Type | Description |
| --- | --- | --- |
| `type` | `'VIdentifier'` | |
| `name` | `string` | The normalized name |
| `rawName` | `string` | The name as written in the source — for example, `':'` for the `v-bind` shorthand |

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

The closing tag of an element. Self-closing elements and void elements don't have one.

| Property | Type | Description |
| --- | --- | --- |
| `type` | `'VEndTag'` | |

### HtmlComment

An HTML comment. To attach a comment to another node, set the `leadingComment` property of that
node.

```vue-html
<!-- TODO: fix this -->
<div>content</div>
```

| Property | Type | Description |
| --- | --- | --- |
| `type` | `'HtmlComment'` | |
| `value` | `string` | The comment text |

## Special expression types

The following node types appear inside a `VExpressionContainer` for certain directives.

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
| `left` | `PatternKind[]` | The iteration variables, such as `item` and `index` |
| `right` | `ExpressionKind` | The collection that's iterated over |

### VOnExpression

Used when `v-on` has more than one statement.

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

### VFilterSequenceExpression and VFilter

Vue 2 filter syntax. Vue 3 doesn't support filters.

```vue-html
{{ message | capitalize | truncate(50) }}
```

## Find nodes

The following examples show common `findAll` patterns:

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
