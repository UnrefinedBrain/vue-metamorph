import { describe, it, expect } from 'vitest';
import * as astHelpers from './ast-helpers';
import { transform } from './transform';
import { CodemodPlugin } from './types';

describe('createDefaultImport', () => {
  const codemod: CodemodPlugin = {
    type: 'codemod',
    name: '',
    transform({ scriptASTs }) {
      if (scriptASTs[0]) {
        astHelpers.createDefaultImport(scriptASTs[0], 'vue', 'Vue');
      }

      return 1;
    },
  };

  it('should insert a default import when no existing import exists', () => {
    const input = 'const a = 1 + 1;';

    expect(transform(input, 'file.js', [codemod]).code).toMatchInlineSnapshot(`
      "import Vue from 'vue';
      const a = 1 + 1;
      "
    `);
  });

  it('should insert a default import for an existing import with no specifiers', () => {
    const input = `
    import 'vue';
    const a = 1 + 1;`;

    expect(transform(input, 'file.js', [codemod]).code).toMatchInlineSnapshot(`
      "import Vue from 'vue';
      const a = 1 + 1;
      "
    `);
  });

  it('should insert a default import for an existing import with specifiers', () => {
    const input = `
    import { defineComponent } from 'vue';
    const a = 1 + 1;`;

    expect(transform(input, 'file.js', [codemod]).code).toMatchInlineSnapshot(`
      "import Vue, { defineComponent } from 'vue';
      const a = 1 + 1;
      "
    `);
  });

  it('should do nothing if an existing default import exists', () => {
    const input = `
    import Vue from 'vue';
    const a = 1 + 1;`;

    expect(transform(input, 'file.js', [codemod]).code).toMatchInlineSnapshot(`
      "import Vue from 'vue';
      const a = 1 + 1;
      "
    `);
  });
});

describe('createNamedImport', () => {
  const codemod: CodemodPlugin = {
    type: 'codemod',
    name: '',
    transform({ scriptASTs }) {
      if (scriptASTs[0]) {
        astHelpers.createNamedImport(scriptASTs[0], 'vue', 'defineComponent');
      }

      return 1;
    },
  };

  it('should insert a named import when no existing import exists', () => {
    const input = 'const a = 1 + 1;';

    expect(transform(input, 'file.js', [codemod]).code).toMatchInlineSnapshot(`
      "import { defineComponent } from 'vue';
      const a = 1 + 1;
      "
    `);
  });

  it('should insert a named import for an existing import with no specifiers', () => {
    const input = `
    import 'vue';
    const a = 1 + 1;`;

    expect(transform(input, 'file.js', [codemod]).code).toMatchInlineSnapshot(`
      "import { defineComponent } from 'vue';
      const a = 1 + 1;
      "
    `);
  });

  it('should insert a named import for an existing import with specifiers', () => {
    const input = `
    import Vue from 'vue';
    const a = 1 + 1;`;

    expect(transform(input, 'file.js', [codemod]).code).toMatchInlineSnapshot(`
      "import Vue, { defineComponent } from 'vue';
      const a = 1 + 1;
      "
    `);
  });

  it('should do nothing if an existing named import exists', () => {
    const input = `
    import { defineComponent } from 'vue';
    const a = 1 + 1;`;

    expect(transform(input, 'file.js', [codemod]).code).toMatchInlineSnapshot(`
      "import { defineComponent } from 'vue';
      const a = 1 + 1;
      "
    `);
  });
});
