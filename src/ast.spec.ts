import { describe, expect, expectTypeOf, it } from 'vitest';
import * as AST from './ast';
import { builders, namedTypes } from './vendor/ast-types/main';
import { vText } from './builders';

describe('isTemplateNode', () => {
  it('keeps script nodes accessible in the false branch', () => {
    function scriptNodeType(node: AST.Node): string | null {
      if (AST.isTemplateNode(node)) {
        return null;
      }

      expectTypeOf(node).not.toBeNever();
      expectTypeOf(node).toMatchTypeOf<namedTypes.Node>();
      return node.type;
    }

    expect(scriptNodeType(builders.identifier('count'))).toBe('Identifier');
    expect(scriptNodeType(vText('hello'))).toBeNull();
  });
});
