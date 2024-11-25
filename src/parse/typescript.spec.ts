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
});
