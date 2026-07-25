// Guards the Babel 8 support added to the vendored recast printer
// (src/vendor/recast/lib/printer.ts).
//
// Babel 8 renamed several TypeScript AST fields and introduced new node types.
// The printer reads those fields by name, so before it was taught about them it
// either threw (`does not match type Printable`) or, worse, printed the node
// with the unknown field silently omitted: `Map<string, number>` came back as
// `Map`, and `#field` as `#`.
//
// prettyPrint is used deliberately: it regenerates every node from the AST
// instead of reusing the original source, which is what stringify() does for
// Vue template expressions and what exposes a field the printer cannot see.
import { describe, expect, it } from 'vitest';
import * as recast from '../vendor/recast/main';
import { tsParser } from '../parse/typescript';

/**
 * prettyPrint reformats freely — it re-indents, normalises quotes and adds
 * member separators. None of that is what we're testing, so compare on
 * significant content only.
 */
function normalise(code: string): string {
  return code
    .replace(/["']/g, '"')
    .replace(/;(\s*[}\]])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Syntax whose printed form depends on a field Babel 8 renamed or added. */
const roundTrips = {
  // New node types.
  'abstract members':
    'abstract class A { abstract m(x: number): void; abstract readonly p?: string; }',
  enum: 'enum E { A, B = 2 }',
  'const enum': 'const enum F { X = "x" }',
  'interface heritage': 'interface I extends J<K> { a: string; m(z: boolean): void; }',
  'class implements': 'class A implements D, E<F> {}',
  'template literal type': 'type T = `a${"b" | "c"}d`;',

  // Renamed fields — each of these lost content before the printer knew the
  // Babel 8 name.
  'type arguments': 'let a: Map<string, number>;',
  'instantiation expression': 'const f = g<number>;',
  'import type': 'type E = import("f").G;',
  'import type with attributes': 'type H = import("f", { with: { type: "json" } }).I;',
  'mapped type': 'type M<T> = { [K in keyof T as `get${string & K}`]-?: T[K] };',
  'mapped type modifiers': 'type M2<T> = { -readonly [K in keyof T]+?: T[K] };',
  'function type': 'type F = (a: string, ...b: number[]) => void;',
  'constructor type': 'type C = new (a: 1) => B;',
  'abstract constructor type': 'type AC = abstract new () => void;',
  'call and construct signatures': 'interface I { (x: number): void; new (y: string): I; }',
  'index signature': 'interface I { readonly [k: string]: unknown }',
  'accessor signatures': 'interface I { get g(): number; set s(v: number); }',
  'type parameter modifiers': 'type A<const T extends string = "x", in out U = 1> = [T, U];',
  'type parameters': 'function f<T, U extends T = T>(a: T): U { return a as unknown as U; }',

  // estree-plugin shapes.
  'private fields': 'class A { #x = 1; static #y = 2; static has(o: unknown) { return #x in o; } }',
  'class member modifiers':
    'class C { declare x: number; override m() {} private b = 2; static readonly c = 3; }',
  'parameter properties':
    'class C { constructor(private x: number, public readonly y: string) { super(); } }',
} as const;

describe('vendored recast printer, @babel/parser 8 output', () => {
  for (const [name, code] of Object.entries(roundTrips)) {
    it(`reprints ${name} without losing anything`, () => {
      const ast = recast.parse(code, { parser: tsParser(false) });
      const printed = recast.prettyPrint(ast, { tabWidth: 2 }).code;

      expect(normalise(printed)).toBe(normalise(code));
    });
  }

  // The regressions that motivated this work, asserted on directly so a
  // reintroduction names itself rather than showing up as a diff in a blob.
  it('keeps type arguments on a reprinted type reference', () => {
    const ast = recast.parse('let a: Map<string, number>;', { parser: tsParser(false) });
    expect(recast.prettyPrint(ast).code).toContain('<string, number>');
  });

  it('keeps the name of a reprinted private identifier', () => {
    const ast = recast.parse('class A { #field = 1; }', { parser: tsParser(false) });
    expect(recast.prettyPrint(ast).code).toContain('#field');
  });

  it('keeps enum members, which Babel 8 moved behind a TSEnumBody', () => {
    const ast = recast.parse('enum E { A, B = 2 }', { parser: tsParser(false) });
    const printed = recast.prettyPrint(ast).code;
    expect(printed).toContain('A');
    expect(printed).toContain('B = 2');
  });

  it('prints an abstract member rather than throwing on its node type', () => {
    const ast = recast.parse('abstract class A { abstract m(): void; }', {
      parser: tsParser(false),
    });
    expect(recast.prettyPrint(ast).code).toContain('abstract m(): void;');
  });
});
