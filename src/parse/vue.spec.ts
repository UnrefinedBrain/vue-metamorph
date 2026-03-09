import { describe, expect, it } from 'vitest';
import { parseVue } from '.';
import { findFirst } from '../ast-helpers';

describe('parseVue', () => {
  it('should set isScriptSetup to true for <script setup>', () => {
    const ast = parseVue('<script setup>\nconst a = 1 + 1;\n</script>');

    expect(ast.scriptASTs[0]?.isScriptSetup).toBe(true);
  });

  it('should set isScriptSetup to false for <script>', () => {
    const ast = parseVue('<script>\nexport default {}\n</script>');
    expect(ast.scriptASTs[0]?.isScriptSetup).toBe(false);
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

    expect(ast.scriptASTs[0]?.isScriptSetup).toBe(false);
    expect(ast.scriptASTs[1]?.isScriptSetup).toBe(true);
  });

  it('should parse jsx', () => {
    const ast = parseVue(
      '<script setup lang="jsx">\nconst btn = () => <button>Hello</button>\n</script>',
    );
    expect(findFirst(ast.scriptASTs[0]!, { type: 'JSXElement' })).not.toBeNull();
  });

  it('edge case', () => {
    const ast = parseVue('<script>/* <template> tags are overrated */ export default {} </script>');
    expect(ast.sfcAST).toBeDefined();
  });

  it('should parse Vue file with style but no script', () => {
    const ast = parseVue(`
<style lang="css">
.foo { color: red; }
</style>`);
    expect(ast.scriptASTs).toHaveLength(0);
    expect(ast.styleASTs).toHaveLength(1);
  });

  it('should parse Vue file with tsx lang on script', () => {
    const ast = parseVue(
      '<script setup lang="tsx">\nconst btn = () => <button>Hello</button>\n</script>',
    );
    expect(findFirst(ast.scriptASTs[0]!, { type: 'JSXElement' })).not.toBeNull();
    expect(ast.scriptASTs[0]?.isScriptSetup).toBe(true);
  });

  it('should handle CRLF line endings', () => {
    const code =
      '<template>\r\n  <div>Hello</div>\r\n</template>\r\n<script>\r\nexport default {}\r\n</script>';
    const ast = parseVue(code);
    expect(ast.scriptASTs).toHaveLength(1);
    expect(ast.sfcAST.templateBody).toBeDefined();
  });

  it('should set neededExtraTemplate when there is no template', () => {
    const ast = parseVue('<script>\nexport default {}\n</script>');
    expect(ast.neededExtraTemplate).toBe(true);
  });

  it('should not set neededExtraTemplate when template exists', () => {
    const ast = parseVue('<template><div /></template><script>\nexport default {}\n</script>');
    expect(ast.neededExtraTemplate).toBe(false);
  });

  it('should parse multiple style blocks with different langs', () => {
    const ast = parseVue(`
<template><div /></template>
<style lang="css">.a { color: red; }</style>
<style lang="scss">.b { color: blue; }</style>
<style lang="less">.c { color: green; }</style>`);
    expect(ast.styleASTs).toHaveLength(3);
  });

  it('should skip style blocks with unsupported lang', () => {
    const ast = parseVue(`
<template><div /></template>
<style lang="css">.a { color: red; }</style>
<style lang="unknown">.b { color: blue; }</style>`);
    expect(ast.styleASTs).toHaveLength(1);
  });

  it('should skip empty script blocks', () => {
    const ast = parseVue('<template><div /></template><script></script>');
    expect(ast.scriptASTs).toHaveLength(0);
  });

  it('should parse comments', () => {
    const ast = parseVue(`
<template><!-- before VText -->
  <!-- before VStartTag --><div>
    Foo <!-- before VExpressionContainer -->{{ bar }}
  <!-- before VEndTag --></div>
</template>
`);
    expect(
      findFirst(ast.sfcAST.templateBody as never, {
        type: 'VText',
      })?.leadingComment?.value,
    ).toBe(' before VText ');

    expect(
      findFirst(ast.sfcAST.templateBody as never, {
        type: 'VElement',
        name: 'div',
      })?.startTag.leadingComment?.value,
    ).toBe(' before VStartTag ');

    expect(
      findFirst(ast.sfcAST.templateBody as never, {
        type: 'VExpressionContainer',
      })?.leadingComment?.value,
    ).toBe(' before VExpressionContainer ');

    expect(
      findFirst(ast.sfcAST.templateBody as never, {
        type: 'VElement',
        name: 'div',
      })?.endTag?.leadingComment?.value,
    ).toBe(' before VEndTag ');
  });
});
