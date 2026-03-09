import { describe, it, expect } from 'vitest';
import { findFirst, findAll, findImportDeclaration, findVueComponentOptions } from './ast-helpers';
import { parseTs } from './parse';
import { vElement, vStartTag, vText, vDocumentFragment } from './builders';

describe('findFirst', () => {
  describe('with Vue template AST (V-prefixed types)', () => {
    it('should find the first matching node', () => {
      const inner = vElement('span', vStartTag([], false), [vText('hello')]);
      const outer = vElement('div', vStartTag([], false), [inner]);
      const doc = vDocumentFragment([outer]);

      const result = findFirst(doc, { type: 'VElement', name: 'span' });
      expect(result).toBe(inner);
    });

    it('should return null when no match is found', () => {
      const el = vElement('div', vStartTag([], false), []);
      const doc = vDocumentFragment([el]);

      const result = findFirst(doc, { type: 'VElement', name: 'span' });
      expect(result).toBeNull();
    });

    it('should return the first match when multiple exist', () => {
      const span1 = vElement('span', vStartTag([], false), [vText('first')]);
      const span2 = vElement('span', vStartTag([], false), [vText('second')]);
      const doc = vDocumentFragment([span1, span2]);

      const result = findFirst(doc, { type: 'VElement', name: 'span' });
      expect(result).toBe(span1);
    });

    it('should match VText nodes', () => {
      const text = vText('hello');
      const el = vElement('div', vStartTag([], false), [text]);
      const doc = vDocumentFragment([el]);

      const result = findFirst(doc, { type: 'VText', value: 'hello' });
      expect(result).toBe(text);
    });
  });

  describe('with JS/TS AST (non-V types)', () => {
    it('should find a node in a script AST', () => {
      const ast = parseTs('const x = 42;', false);
      const result = findFirst(ast, { type: 'VariableDeclaration' });
      expect(result).not.toBeNull();
      expect(result!.type).toBe('VariableDeclaration');
    });

    it('should return null when no match in script AST', () => {
      const ast = parseTs('const x = 42;', false);
      const result = findFirst(ast, { type: 'FunctionDeclaration' });
      expect(result).toBeNull();
    });

    it('should find nested nodes', () => {
      const ast = parseTs('function foo() { return 42; }', false);
      const result = findFirst(ast, { type: 'ReturnStatement' });
      expect(result).not.toBeNull();
      expect(result!.type).toBe('ReturnStatement');
    });

    it('should match by multiple properties', () => {
      const ast = parseTs('const x = 1; let y = 2;', false);
      const result = findFirst(ast, { type: 'VariableDeclaration', kind: 'let' });
      expect(result).not.toBeNull();
    });
  });
});

describe('findAll', () => {
  describe('with Vue template AST', () => {
    it('should find all matching nodes', () => {
      const span1 = vElement('span', vStartTag([], false), [vText('first')]);
      const span2 = vElement('span', vStartTag([], false), [vText('second')]);
      const div = vElement('div', vStartTag([], false), [span1, span2]);
      const doc = vDocumentFragment([div]);

      const results = findAll(doc, { type: 'VElement', name: 'span' });
      expect(results).toHaveLength(2);
      expect(results).toContain(span1);
      expect(results).toContain(span2);
    });

    it('should return empty array when no matches', () => {
      const doc = vDocumentFragment([vText('hello')]);
      const results = findAll(doc, { type: 'VElement', name: 'span' });
      expect(results).toEqual([]);
    });

    it('should find deeply nested matches', () => {
      const deepSpan = vElement('span', vStartTag([], false), []);
      const inner = vElement('div', vStartTag([], false), [deepSpan]);
      const outer = vElement('div', vStartTag([], false), [inner]);
      const doc = vDocumentFragment([outer]);

      const results = findAll(doc, { type: 'VElement', name: 'span' });
      expect(results).toHaveLength(1);
      expect(results[0]).toBe(deepSpan);
    });
  });

  describe('with JS/TS AST', () => {
    it('should find all matching nodes', () => {
      const ast = parseTs('const x = 1; const y = 2; let z = 3;', false);
      const results = findAll(ast, { type: 'VariableDeclaration', kind: 'const' });
      expect(results).toHaveLength(2);
    });

    it('should return empty array when no matches', () => {
      const ast = parseTs('const x = 1;', false);
      const results = findAll(ast, { type: 'FunctionDeclaration' });
      expect(results).toEqual([]);
    });

    it('should find nested nodes in functions', () => {
      const code = `
        function foo() { return 1; }
        function bar() { return 2; }
      `;
      const ast = parseTs(code, false);
      const results = findAll(ast, { type: 'ReturnStatement' });
      expect(results).toHaveLength(2);
    });
  });
});

describe('findImportDeclaration', () => {
  it('should find an import declaration by module specifier', () => {
    const ast = parseTs("import { ref } from 'vue';", false);
    const result = findImportDeclaration(ast, 'vue');
    expect(result).not.toBeNull();
    expect(result!.type).toBe('ImportDeclaration');
  });

  it('should return null when the import does not exist', () => {
    const ast = parseTs("import { ref } from 'vue';", false);
    const result = findImportDeclaration(ast, 'react');
    expect(result).toBeNull();
  });

  it('should find side-effect imports', () => {
    const ast = parseTs("import 'vue';", false);
    const result = findImportDeclaration(ast, 'vue');
    expect(result).not.toBeNull();
  });

  it('should distinguish between different module specifiers', () => {
    const ast = parseTs("import { ref } from 'vue';\nimport { useState } from 'react';", false);
    const result = findImportDeclaration(ast, 'react');
    expect(result).not.toBeNull();
    expect(result!.source.value).toBe('react');
  });
});

describe('findVueComponentOptions', () => {
  it('should find export default object in SFC mode', () => {
    const ast = parseTs('export default { name: "Foo" };', false);
    const results = findVueComponentOptions(ast, true);
    expect(results).toHaveLength(1);
  });

  it('should not find export default object when not in SFC mode', () => {
    const ast = parseTs('export default { name: "Foo" };', false);
    const results = findVueComponentOptions(ast, false);
    expect(results).toHaveLength(0);
  });

  it('should find defineComponent calls', () => {
    const code = `
      import { defineComponent } from 'vue';
      export default defineComponent({ name: 'Foo' });
    `;
    const ast = parseTs(code, false);
    const results = findVueComponentOptions(ast, false);
    expect(results).toHaveLength(1);
  });

  it('should find Vue.extend calls', () => {
    const ast = parseTs("const Comp = Vue.extend({ name: 'Bar' });", false);
    const results = findVueComponentOptions(ast, false);
    expect(results).toHaveLength(1);
  });

  it('should find Vue.component calls', () => {
    const ast = parseTs("Vue.component({ name: 'Baz' });", false);
    const results = findVueComponentOptions(ast, false);
    expect(results).toHaveLength(1);
  });

  it('should find Vue.mixin calls', () => {
    const ast = parseTs('Vue.mixin({ created() {} });', false);
    const results = findVueComponentOptions(ast, false);
    expect(results).toHaveLength(1);
  });

  it('should find new Vue() calls', () => {
    const ast = parseTs("new Vue({ el: '#app' });", false);
    const results = findVueComponentOptions(ast, false);
    expect(results).toHaveLength(1);
  });

  it('should find multiple component definitions', () => {
    const code = `
      import { defineComponent } from 'vue';
      const A = defineComponent({ name: 'A' });
      const B = Vue.extend({ name: 'B' });
      new Vue({ el: '#app' });
    `;
    const ast = parseTs(code, false);
    const results = findVueComponentOptions(ast, false);
    expect(results).toHaveLength(3);
  });

  it('should return empty array when no components found', () => {
    const ast = parseTs('const x = 42;', false);
    const results = findVueComponentOptions(ast, false);
    expect(results).toHaveLength(0);
  });

  it('should not match non-object arguments to defineComponent', () => {
    const ast = parseTs('defineComponent(someVariable);', false);
    const results = findVueComponentOptions(ast, false);
    expect(results).toHaveLength(0);
  });

  it('should not match non-Vue member expressions', () => {
    const ast = parseTs("React.extend({ name: 'Foo' });", false);
    const results = findVueComponentOptions(ast, false);
    expect(results).toHaveLength(0);
  });

  it('should not match unsupported Vue methods', () => {
    const ast = parseTs('Vue.use({ install() {} });', false);
    const results = findVueComponentOptions(ast, false);
    expect(results).toHaveLength(0);
  });
});
