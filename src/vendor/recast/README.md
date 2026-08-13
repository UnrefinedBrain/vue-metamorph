# Vendored `recast`

Vendored from [`recast-x`](https://github.com/pionxzh/recast-x) v1.0.5, itself a
fork of [`recast`](https://github.com/benjamn/recast).

Copyright (c) 2012 Ben Newman. Released under the MIT License — see `./LICENSE`.

## Why this is vendored

Two reasons, both consequences of moving to `@babel/parser` 8.

**The printer speaks Babel 7.** recast reads AST fields by name, and Babel 8
renamed a lot of them. A field the printer cannot find is not an error — it is
simply not printed, so the failure is silent truncation rather than a crash:
`Map<string, number>` reprinted as `Map`, `#field` as `#`, and a mapped type's
key as `[]`. Node types added in Babel 8 fared worse and threw outright.

**It shipped its own copy of ast-types.** `recast-x` depends on
`ast-types-x`, so extending our vendored ast-types with the Babel 8 definitions
did not help the printer at all — it was consulting a second, unextended
registry. The observable symptom was `TSAbstractMethodDefinition ... does not
match type Printable`, thrown from `recast-x/lib/printer.js` by way of
`ast-types-x/lib/types.js`. Vendoring collapses the two into one instance:
`recast.types.namedTypes === namedTypes` now holds.

## What was changed

`lib/` and `main.ts` were copied verbatim; `parsers/` and `test/` were not
(vue-metamorph passes its own parser, so the bundled parser adapters are dead
weight and would drag in extra dependencies).

Deliberate deviations, each marked with a `LOCAL DEVIATION` comment at the site:

- All `ast-types` imports point at `../ast-types/main`, which is what makes the
  single shared registry work.
- `main.ts` — `export type { Options }`, required by `isolatedModules`.
- `lib/util.ts` — `os` is imported at the top rather than via a lazy
  `require("os")`, which throws under a real ESM loader.
- `lib/parser.ts` — dropped the `NODE_ENV === "test"` fallback to Esprima's
  tokenizer. It is reachable under vitest, esprima is not a dependency here, and
  the bare `require` obscured the real "Missing required ast.tokens array"
  error.

Babel 8 support in `lib/printer.ts` is marked `LOCAL ADDITION`. Renamed fields
are read through the `printFirstOf` / `printFirstOfNested` helpers, which accept
either the Babel 7 or the Babel 8 name — nodes coming from the parser use the
new names, while nodes built by ast-types' builders still use the old ones, so
both have to work. New node types get their own `case` branches.

`tsconfig.json` here makes this directory a separate TypeScript project, for the
same reason as the vendored ast-types; builds must go through `tsc -b`.

Regression coverage lives in `src/tests/babel8-printer.spec.ts`.
