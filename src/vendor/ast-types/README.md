# Vendored `ast-types-x`

Vendored from [`ast-types-x`](https://github.com/pionxzh/ast-types-x) v1.18.0,
itself a fork of [`ast-types`](https://github.com/benjamn/ast-types).

Copyright (c) 2013 Ben Newman. Released under the MIT License — see `./LICENSE`.

## Why this is vendored

`@babel/parser` 8 changed the TypeScript AST shape substantially (see
`def/babel8.ts`). `ast-types-x` still describes the Babel 7 shape, so with
Babel 8 it rejects nodes outright — `did not recognize object of type
"TSEnumBody"` — which any traversal of an affected file would hit.

Owning a copy lets us teach the type definitions about the Babel 8 shape
without waiting on the upstream fork. `../recast` is vendored alongside it and
imports this copy directly, so there is exactly one type registry; see that
directory's README for why that matters.

## What was changed

The runtime sources under `src/` were copied verbatim, excluding `src/test/`
and the dev-only ambient declarations (`modules.d.ts`, `esprima.d.ts`) — the
runtime code has no external imports at all.

Deliberate deviations from upstream, each marked with a `LOCAL DEVIATION`
comment at the site:

- `main.ts` / `types.ts` — reworked a few type re-exports to satisfy
  `isolatedModules`, which upstream does not enable and which the bundler
  requires. No runtime behaviour change.
- `def/babel8.ts` — **new**; describes the Babel 8 AST. Not upstream.

`tsconfig.json` here makes this directory a separate TypeScript project so the
repo's stricter `noUncheckedIndexedAccess` doesn't force edits throughout the
vendored sources. The root project consumes the declarations emitted from here
via a project reference, so builds must go through `tsc -b`.

## Regenerating `gen/`

`gen/builders.ts`, `gen/kinds.ts`, `gen/namedTypes.ts` and `gen/visitor.ts` are
generated from the definitions in `def/`. After changing anything under `def/`:

```sh
pnpm gen:ast-types
```

That runs `scripts/gen-ast-types.ts` (vendored from upstream's
`script/gen-types.ts`). Never edit the `gen/` files by hand.
