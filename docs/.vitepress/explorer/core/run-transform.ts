/**
 * Compiles the codemod in the editor and runs vue-metamorph's `transform()`
 * with it, which is the same entry point the CLI uses.
 */

import { transform } from '../../../../src/transform';
import type { CodemodPlugin } from '../../../../src/types';
import { compileCodemod } from './compile-codemod';
import { describeError } from './parse';
import type { SourceType } from './source-types';

export type TransformOutcome = {
  code: string;
  stats: [name: string, count: number][];
  error: string | null;
};

function asPlugins(exported: unknown): CodemodPlugin[] {
  const candidates = Array.isArray(exported) ? exported : [exported];

  return candidates.map((candidate) => {
    const plugin = candidate as Partial<CodemodPlugin> | null;

    if (!plugin || plugin.type !== 'codemod' || typeof plugin.transform !== 'function') {
      throw new Error(
        'The codemod must export a CodemodPlugin: an object with ' +
          "`type: 'codemod'`, a `name`, and a `transform` function",
      );
    }

    return plugin as CodemodPlugin;
  });
}

export function runTransform(
  code: string,
  sourceType: SourceType,
  codemodSource: string,
): TransformOutcome {
  try {
    const plugins = asPlugins(compileCodemod(codemodSource));
    const result = transform(code, sourceType.filename, plugins);

    return { code: result.code, stats: result.stats, error: null };
  } catch (error) {
    return { code: '', stats: [], error: describeError(error) };
  }
}
