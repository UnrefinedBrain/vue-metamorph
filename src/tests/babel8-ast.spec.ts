// Guards the Babel 8 type definitions in ../vendor/ast-types/def/babel8.ts.
//
// Two invariants, both of which failed before those definitions existed:
//
//  1. `visit` can traverse every node @babel/parser 8 produces. An unknown node
//     type makes ast-types throw `did not recognize object of type "..."`.
//  2. `getFieldNames` reports every field present on a node. This one is the
//     quiet failure mode: recast asks ast-types which fields a node has when it
//     reprints a modified subtree, so an undeclared field is dropped without any
//     error — `Map<string, number>` came back out as `Map`.
import { describe, expect, it } from 'vitest';
import { getFieldNames, namedTypes, visit } from '../vendor/ast-types/main';
import { parseTs } from '../parse/typescript';

/** Fields that live on nodes but are positional or bookkeeping, not AST content. */
const NON_FIELD_KEYS = new Set([
  'start',
  'end',
  'loc',
  'range',
  'extra',
  'errors',
  'tokens',
  'comments',
  'original',
  'lines',
  'indent',
  // Added to Program by parseTs, not by @babel/parser (see types.ts VueProgram).
  'isScriptSetup',
]);

/** Babel 8 syntax coverage, grouped by what changed relative to Babel 7. */
const sources = {
  // Node types that are new in Babel 8.
  'enum -> TSEnumBody': 'enum E { A, B = 2 }\nconst enum F { X }',
  'interface extends -> TSInterfaceHeritage': 'interface I extends J<K> { a: string }',
  'template literal type -> TSTemplateLiteralType': "type T = `a${'b' | 'c'}d`;",
  'abstract members -> TSAbstract*Definition + TSEmptyBodyFunctionExpression':
    'abstract class A { abstract m(x: number): void; abstract readonly p?: string; }',

  // Renamed fields.
  'typeParameters -> typeArguments': 'let a: Map<string, number>;\nconst f = g<number>;',
  'parameters -> params, typeAnnotation -> returnType':
    'type F = (a: string, ...b: number[]) => void;\ntype C = new (a: 1) => B;\n' +
    'interface I { (x: number): void; new (y: string): I; m(z: boolean): void }',
  'TSImportType argument -> source':
    "type E = import('f').G;\ntype H = import('f', { with: { type: 'json' } }).I;",
  'TSMappedType typeParameter -> key + constraint':
    'type M<T> = { readonly [K in keyof T as `g${string & K}`]-?: T[K] };',
  'TSTypeParameter variance + const modifiers':
    "type A<const T extends string = 'x', in out U = 1> = [T, U];",
  'TSModuleDeclaration kind':
    "declare global {}\nnamespace N { export const a = 1; }\ndeclare module 'm' {}",
  'TSImportEqualsDeclaration importKind': "import a = require('b');\nexport = a;",

  // estree-plugin shapes.
  'ClassProperty -> PropertyDefinition, PrivateName -> PrivateIdentifier':
    'class C { declare x: number; override m() {} #p = 2; static #q = 3; private b = 2;\n' +
    '  static has(o: unknown) { return #p in o; } }',
  'class modifiers':
    'abstract class A extends B<C> implements D { protected constructor(private x: number) { super(); } }',
  'import attributes':
    "import a from 'b' with { type: 'json' };\nexport { x } from 'y' with { type: 'json' };",
  'type-only import/export specifiers':
    "import type { A } from 'm';\nimport { type B, C } from 'n';\nexport type { D };",
  literals: "const s = 'x'; const n = 1_000; const b = 2n; const r = /ab+c/gi; const t = `a${s}b`;",
  'dynamic import -> ImportExpression': "import('mod').then(m => m);",
  'decorators + parameter properties': '@dec class A { @dec p = 1; @dec m(@dec x: number) {} }',
  'satisfies / as / non-null':
    'const a = { b: 1 } satisfies Record<string, number>;\nconst c = d as unknown as E;\na!.b;',
} as const;

/** Walks every node in the tree, including ones ast-types would not traverse. */
function eachNode(node: unknown, fn: (node: Record<string, unknown>) => void): void {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    node.forEach((child) => eachNode(child, fn));
    return;
  }
  const record = node as Record<string, unknown>;
  if (typeof record.type !== 'string') return;
  fn(record);
  for (const key of Object.keys(record)) {
    if (key === 'loc' || key === 'tokens' || key === 'comments') continue;
    eachNode(record[key], fn);
  }
}

describe('@babel/parser 8 AST definitions', () => {
  describe('every node type is known to ast-types', () => {
    for (const [name, code] of Object.entries(sources)) {
      it(name, () => {
        const ast = parseTs(code, false);
        const unknown = new Set<string>();

        eachNode(ast, (node) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if (!(namedTypes as any)[node.type as string]) {
            unknown.add(node.type as string);
          }
        });

        expect([...unknown]).toEqual([]);
      });
    }
  });

  describe('every field is declared, so recast cannot silently drop it', () => {
    for (const [name, code] of Object.entries(sources)) {
      it(name, () => {
        const ast = parseTs(code, false);
        const undeclared = new Set<string>();

        eachNode(ast, (node) => {
          const declared = new Set(getFieldNames(node));
          for (const key of Object.keys(node)) {
            if (NON_FIELD_KEYS.has(key) || declared.has(key)) continue;
            undeclared.add(`${node.type as string}.${key}`);
          }
        });

        expect([...undeclared].sort()).toEqual([]);
      });
    }
  });

  it('traverses the whole corpus without ast-types errors', () => {
    for (const code of Object.values(sources)) {
      const ast = parseTs(code, false);
      let visited = 0;

      expect(() => {
        visit(ast, {
          visitNode(path) {
            visited += 1;
            this.traverse(path);
          },
        });
      }).not.toThrow();

      expect(visited).toBeGreaterThan(0);
    }
  });

  it('exposes builders for the node types Babel 8 introduced', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const b = namedTypes as any;
    for (const type of [
      'TSEnumBody',
      'TSInterfaceHeritage',
      'TSTemplateLiteralType',
      'TSEmptyBodyFunctionExpression',
      'TSAbstractMethodDefinition',
      'TSAbstractPropertyDefinition',
    ]) {
      expect(b[type], type).toBeTruthy();
    }
  });
});
