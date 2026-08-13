import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { collectTypeFiles } from '../type-files';
import { createCodemodLanguageService } from './create-language-service';
import { SAMPLE_CODEMOD } from './samples';

// The declaration files come out of `dist`, which `pnpm docs:build` and
// `pnpm docs:dev` produce first. A bare `pnpm test` on a clean checkout has
// nothing to check against, and the playground degrades the same way.
const files = collectTypeFiles();

const service = files ? createCodemodLanguageService(ts, files) : null;

const check = (code: string) => {
  service!.update(code);
  return service!.getDiagnostics().map((diagnostic) => diagnostic.message);
};

describe.skipIf(!files)('codemod language service', () => {
  it('resolves the vue-metamorph declarations', () => {
    expect(files!['/node_modules/vue-metamorph/dist/vue-metamorph.d.ts']).toBeTypeOf('string');
    expect(files!['/lib.es2022.d.ts']).toBeTypeOf('string');
  });

  it('accepts the codemod the playground ships with', () => {
    expect(check(SAMPLE_CODEMOD)).toEqual([]);
  });

  it('catches a wrong return type', () => {
    const messages = check(`
      import { type CodemodPlugin } from 'vue-metamorph';

      const plugin: CodemodPlugin = {
        type: 'codemod',
        name: 'wrong',
        transform() {
          return 'not a count';
        },
      };

      export default plugin;
    `);

    expect(messages.join('\n')).toMatch(/'string' is not assignable to type 'number'/);
  });

  it('knows the shape of the plugin context', () => {
    const source = `
      import { type CodemodPlugin } from 'vue-metamorph';

      const plugin: CodemodPlugin = {
        type: 'codemod',
        name: 'context',
        transform(context) {
          return 0;
        },
      };

      export default plugin;
    `;

    service!.update(source);
    const info = service!.getQuickInfo(
      source.indexOf('transform(context') + 'transform(cont'.length,
    );

    expect(info?.signature).toBe('(parameter) context: CodemodPluginContext');
  });

  it('completes the postcss API on style ASTs', () => {
    const source = `
      import { type CodemodPlugin } from 'vue-metamorph';

      const plugin: CodemodPlugin = {
        type: 'codemod',
        name: 'styles',
        transform({ styleASTs }) {
          styleASTs[0]!.
          return 0;
        },
      };

      export default plugin;
    `;

    service!.update(source);
    const labels = service!
      .getCompletions(source.indexOf('styleASTs[0]!.') + 'styleASTs[0]!.'.length)
      .map((entry) => entry.label);

    expect(labels).toContain('walkRules');
    expect(labels).toContain('append');
  });

  it('completes the ast-types builders', () => {
    const source = `
      import { builders } from 'vue-metamorph';
      builders.
    `;

    service!.update(source);
    const labels = service!
      .getCompletions(source.indexOf('builders.\n') + 'builders.'.length)
      .map((entry) => entry.label);

    expect(labels).toContain('identifier');
    expect(labels).toContain('callExpression');
    expect(labels).toContain('vElement');
  });
});
