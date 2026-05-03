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

  it('should throw if a different default import already exists', () => {
    const input = `
    import Foo from 'vue';
    const a = 1 + 1;`;

    expect(() => transform(input, 'file.js', [codemod])).toThrowError(
      /Cannot add default import 'Vue' from 'vue'.*'Foo'/,
    );
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

    // ESM allows a namespace specifier alongside named specifiers as long as
    // they're in separate import declarations, but not in the same one. Adding
    // it to the existing decl is invalid; the helper splits it into a second
    // declaration.
    expect(transform(input, 'file.js', [codemod]).code).toMatchInlineSnapshot(`
      "import * as Vue from 'vue';
      import { defineComponent } from 'vue';
      const a = 1 + 1;
      "
    `);
  });

  it('should do nothing if the same namespace import already exists', () => {
    const input = `
    import * as Vue from 'vue';
    const a = 1 + 1;`;

    expect(transform(input, 'file.js', [codemod]).code).toMatchInlineSnapshot(`
      "import * as Vue from 'vue';
      const a = 1 + 1;
      "
    `);
  });

  it('should throw if a different namespace import already exists', () => {
    const input = `
    import * as Foo from 'vue';
    const a = 1 + 1;`;

    expect(() => transform(input, 'file.js', [codemod])).toThrowError(
      /Cannot add namespace import 'Vue' from 'vue'.*'Foo'/,
    );
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

describe('createNamedImport without localName', () => {
  const codemod: CodemodPlugin = {
    type: 'codemod',
    name: '',
    transform({ scriptASTs }) {
      if (scriptASTs[0]) {
        astHelpers.createNamedImport(scriptASTs[0], 'vue', 'ref');
      }

      return 1;
    },
  };

  it('should add an unaliased import even when an aliased version already exists', () => {
    const input = `
    import { ref as myRef } from 'vue';
    const a = 1 + 1;`;

    // The existing aliased import does not create a `ref` binding, so the
    // helper must still add the unaliased specifier; otherwise downstream
    // `ref(...)` calls would be undefined at runtime.
    expect(transform(input, 'file.js', [codemod]).code).toMatchInlineSnapshot(`
      "import { ref as myRef, ref } from 'vue';
      const a = 1 + 1;
      "
    `);
  });

  it('should not duplicate an unaliased import that already exists', () => {
    const input = `
    import { ref } from 'vue';
    const a = 1 + 1;`;

    expect(transform(input, 'file.js', [codemod]).code).toMatchInlineSnapshot(`
      "import { ref } from 'vue';
      const a = 1 + 1;
      "
    `);
  });
});
