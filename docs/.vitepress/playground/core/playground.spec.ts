import { describe, expect, it, vi } from 'vitest';
import { parseSource } from './parse';
import { compileCodemod } from './compile-codemod';
import { runTransform } from './run-transform';
import { SOURCE_TYPES, findSourceType } from './source-types';
import { SAMPLE_CODEMOD, sampleFor } from './samples';

const VUE = `<template>
  <div class="greeting">{{ label }}</div>
</template>

<script setup lang="ts">
const label: string = 'hello';
</script>

<style lang="scss">
.greeting {
  .label {
    color: red;
  }
}
</style>
`;

const vueType = findSourceType('vue');

/** Resolves a node's range through the panel's mapper and slices the source. */
function sliceAt(panelId: string, range: [number, number]) {
  const { panels } = parseSource(VUE, vueType);
  const panel = panels.find((candidate) => candidate.id === panelId)!;
  const mapped = panel.adapter.mapRange!(range)!;
  return VUE.slice(mapped[0], mapped[1]);
}

describe('parseSource', () => {
  it('gives one panel per AST a codemod receives', () => {
    const { panels, error } = parseSource(VUE, vueType);

    expect(error).toBeNull();
    expect(panels.map((panel) => panel.id)).toEqual(['template', 'script-0', 'style-0']);
    expect(panels.map((panel) => panel.note)).toEqual([
      undefined,
      '<script setup lang="ts">',
      '<style lang="scss">',
    ]);
  });

  it('maps script ranges back onto the block in the SFC', () => {
    const { panels } = parseSource(VUE, vueType);
    const script = panels.find((panel) => panel.id === 'script-0')!;
    const statement = (script.ast as { body: { start: number; end: number }[] }).body[0]!;

    expect(sliceAt('script-0', [statement.start, statement.end])).toBe(
      "const label: string = 'hello';",
    );
  });

  it('maps style ranges back onto the block in the SFC', () => {
    const { panels } = parseSource(VUE, vueType);
    const root = panels.find((panel) => panel.id === 'style-0')!.ast as {
      nodes: {
        source: { start: { offset: number }; end: { offset: number } };
        nodes?: unknown[];
      }[];
    };

    // nodes[0] is the marker comment vue-metamorph prepends to keep offsets
    // lined up; the rule itself is next.
    const rule = root.nodes[1]!;
    const nested = (rule.nodes as typeof root.nodes)[0]!;

    expect(sliceAt('style-0', [rule.source.start.offset, rule.source.end.offset])).toBe(
      '.greeting {\n  .label {\n    color: red;\n  }\n}',
    );
    expect(sliceAt('style-0', [nested.source.start.offset, nested.source.end.offset])).toBe(
      '.label {\n    color: red;\n  }',
    );
  });

  it('reports recovered template syntax errors', () => {
    const { panels } = parseSource('<template><div v-if="></div></template>', vueType);

    expect(panels[0]!.warnings!.length).toBeGreaterThan(0);
  });

  it('parses the sample for every source type on offer', () => {
    for (const type of SOURCE_TYPES) {
      const { panels, error } = parseSource(sampleFor(type.id), type);

      expect(error, type.id).toBeNull();
      expect(panels.length, type.id).toBeGreaterThan(0);
    }
  });

  it('parses standalone scripts and stylesheets', () => {
    expect(
      parseSource('const a = 1 as number;', findSourceType('ts')).panels[0]!.ast,
    ).toMatchObject({ type: 'Program' });
    expect(parseSource('.a { color: red }', findSourceType('scss')).panels[0]!.ast).toMatchObject({
      type: 'root',
    });
  });
});

describe('compileCodemod', () => {
  it('runs a TypeScript codemod that imports from vue-metamorph', () => {
    const plugin = compileCodemod(`
      import { type CodemodPlugin, builders } from 'vue-metamorph';

      const plugin: CodemodPlugin = {
        type: 'codemod',
        name: 'noop',
        transform({ scriptASTs }): number {
          return (scriptASTs as unknown[]).length satisfies number;
        },
      };

      export default plugin;
    `) as { type: string; name: string; transform: (context: unknown) => number };

    expect(plugin.name).toBe('noop');
    expect(plugin.transform({ scriptASTs: [1, 2] })).toBe(2);
  });

  it('refuses imports it cannot resolve', () => {
    expect(() => compileCodemod("import x from 'lodash'; export default x;")).toThrow(
      /Only 'vue-metamorph' can be imported/,
    );
  });

  it('insists on a default export', () => {
    expect(() => compileCodemod('const plugin = {};')).toThrow(/export default/);
  });

  it('stops a runaway loop', () => {
    // The deadline is stamped when the codemod is compiled and checked on
    // every iteration, so the clock has to move between the two. It has to
    // move on the very first check as well: the spy records every call, and a
    // loop that gets to run is a loop that fills memory with call history.
    let checks = 0;
    vi.spyOn(Date, 'now').mockImplementation(() => (checks++ === 0 ? 0 : 60_000));

    try {
      const plugin = compileCodemod(
        "export default { type: 'codemod', name: 'loop', transform() { while (true) {} } };",
      ) as { transform: () => number };

      expect(() => plugin.transform()).toThrow(/Infinite loop detected/);
    } finally {
      vi.restoreAllMocks();
    }
  });
});

describe('runTransform', () => {
  it('runs the sample codemod against the sample source', () => {
    const outcome = runTransform(sampleFor('vue'), vueType, SAMPLE_CODEMOD);

    expect(outcome.error).toBeNull();
    expect(outcome.stats).toEqual([['rename-my-button', 1]]);
    expect(outcome.code).toContain('<AppButton');
    expect(outcome.code).not.toContain('<MyButton');
  });

  it('reports what the codemod threw', () => {
    const outcome = runTransform(
      '<template><div/></template>',
      vueType,
      "export default { type: 'codemod', name: 'boom', transform() { throw new Error('kaboom'); } };",
    );

    expect(outcome.error).toBe('kaboom');
  });

  it('rejects an export that is not a CodemodPlugin', () => {
    const outcome = runTransform('const a = 1;', findSourceType('ts'), 'export default 42;');

    expect(outcome.error).toMatch(/must export a CodemodPlugin/);
  });
});
