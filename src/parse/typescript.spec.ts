import { describe, expect, it } from 'vitest';
import { parseTs } from '.';
import { findFirst } from '../ast-helpers';

describe('parseTs', () => {
  it('should always set the isScriptSetup property to false', () => {
    const ast = parseTs('const a = 1 + 1', false);

    expect(ast.isScriptSetup).toBe(false);
  });

  it('should parse jsx', () => {
    const ast = parseTs('const btn = () => <button>Hello</button>', true);
    expect(findFirst(ast, { type: 'JSXElement' })).not.toBeNull();
  });

  it('should allow errors', () => {
    const ast = parseTs('const a = 1; const a = 2;', false);
    expect(ast).toBeDefined();
  });

  it('should parse TypeScript decorators', () => {
    const code = `@sealed\nclass Foo {}`;
    const ast = parseTs(code, false);
    expect(findFirst(ast, { type: 'ClassDeclaration' })).not.toBeNull();
  });

  it('should parse TypeScript generics', () => {
    const code = `function identity<T>(arg: T): T { return arg; }`;
    const ast = parseTs(code, false);
    expect(findFirst(ast, { type: 'FunctionDeclaration' })).not.toBeNull();
  });

  it('should parse TypeScript type annotations', () => {
    const code = `const x: number = 42;\ninterface Foo { bar: string; }`;
    const ast = parseTs(code, false);
    expect(findFirst(ast, { type: 'TSInterfaceDeclaration' })).not.toBeNull();
  });

  it('should parse TypeScript enums', () => {
    const code = `enum Color { Red, Green, Blue }`;
    const ast = parseTs(code, false);
    expect(findFirst(ast, { type: 'TSEnumDeclaration' })).not.toBeNull();
  });

  it('should parse TSX with type annotations', () => {
    const code = `const Comp: React.FC<{ name: string }> = ({ name }) => <div>{name}</div>;`;
    const ast = parseTs(code, true);
    expect(findFirst(ast, { type: 'JSXElement' })).not.toBeNull();
  });

  it('should parse top-level await', () => {
    const code = `const data = await fetch('url');`;
    const ast = parseTs(code, false);
    expect(findFirst(ast, { type: 'AwaitExpression' })).not.toBeNull();
  });

  it('should parse optional chaining', () => {
    const code = `const val = obj?.foo?.bar;`;
    const ast = parseTs(code, false);
    // estree plugin converts OptionalMemberExpression to ChainExpression
    expect(findFirst(ast, { type: 'ChainExpression' })).not.toBeNull();
  });

  it('should parse nullish coalescing', () => {
    const code = `const val = foo ?? 'default';`;
    const ast = parseTs(code, false);
    expect(ast).toBeDefined();
  });
});
