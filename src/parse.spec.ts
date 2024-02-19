import { describe, expect, it } from 'vitest';
import { parseTs, parseVue } from './parse';

describe('parseTs', () => {
  it('should always set the isScriptSetup property to false', () => {
    const ast = parseTs('const a = 1 + 1');

    expect(ast.isScriptSetup).toBe(false);
  });
});

describe('parseVue', () => {
  it('should set isScriptSetup to true for <script setup>', () => {
    const ast = parseVue('<script setup>\nconst a = 1 + 1;\n</script>');

    expect(ast.scriptAsts[0]?.isScriptSetup).toBe(true);
  });

  it('should set isScriptSetup to false for <script>', () => {
    const ast = parseVue('<script>\nexport default {}\n</script>');
    expect(ast.scriptAsts[0]?.isScriptSetup).toBe(false);
  });

  it('should work with two <scripts>', () => {
    const ast = parseVue(`
      <script>
      export default {}
      </script>
      
      <script setup>
      const a = 1 + 1;
      </script>
    `);

    expect(ast.scriptAsts[0]?.isScriptSetup).toBe(false);
    expect(ast.scriptAsts[1]?.isScriptSetup).toBe(true);
  });
});
