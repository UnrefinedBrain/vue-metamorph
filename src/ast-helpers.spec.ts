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

describe('createNamedImport with localName', () => {
  const codemod: CodemodPlugin = {
    type: 'codemod',
    name: '',
    transform({ scriptASTs }) {
      if (scriptASTs[0]) {
        astHelpers.createNamedImport(scriptASTs[0], 'vue', 'ref', 'myRef');
      }

      return 1;
    },
  };

  it('should insert a named import with an alias when no existing import exists', () => {
    const input = 'const a = 1 + 1;';

    expect(transform(input, 'file.js', [codemod]).code).toMatchInlineSnapshot(`
      "import { ref as myRef } from 'vue';
      const a = 1 + 1;
      "
    `);
  });

  it('should insert a named import with alias on existing import', () => {
    const input = `
    import { defineComponent } from 'vue';
    const a = 1 + 1;`;

    expect(transform(input, 'file.js', [codemod]).code).toMatchInlineSnapshot(`
      "import { defineComponent, ref as myRef } from 'vue';
      const a = 1 + 1;
      "
    `);
  });

  it('should not duplicate an aliased import that already exists', () => {
    const input = `
    import { ref as myRef } from 'vue';
    const a = 1 + 1;`;

    expect(transform(input, 'file.js', [codemod]).code).toMatchInlineSnapshot(`
      "import { ref as myRef } from 'vue';
      const a = 1 + 1;
      "
    `);
  });
});

describe('createNamespaceImport', () => {
  const codemod: CodemodPlugin = {
    type: 'codemod',
    name: '',
    transform({ scriptASTs }) {
      if (scriptASTs[0]) {
        astHelpers.createNamespaceImport(scriptASTs[0], 'vue', 'Vue');
      }

      return 1;
    },
  };

  it('should insert a namespace import when no existing import exists', () => {
    const input = 'const a = 1 + 1;';

    expect(transform(input, 'file.js', [codemod]).code).toMatchInlineSnapshot(`
      "import * as Vue from 'vue';
      const a = 1 + 1;
      "
    `);
  });

  it('should insert a namespace import on an existing import with no specifiers', () => {
    const input = `
    import 'vue';
    const a = 1 + 1;`;

    expect(transform(input, 'file.js', [codemod]).code).toMatchInlineSnapshot(`
      "import * as Vue from 'vue';
      const a = 1 + 1;
      "
    `);
  });

  it('should add a namespace import on an existing import with specifiers', () => {
    const input = `
    import { defineComponent } from 'vue';
    const a = 1 + 1;`;

    // namespace specifier gets appended alongside existing named specifiers
    const result = transform(input, 'file.js', [codemod]);
    expect(result.code).toContain('* as Vue');
    expect(result.code).toContain('defineComponent');
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
