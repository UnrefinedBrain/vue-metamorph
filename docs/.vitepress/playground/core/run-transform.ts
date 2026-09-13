/**
 * Compiles the codemod in the editor and runs vue-metamorph's `transform()`
 * with it, which is the same entry point the CLI uses.
 */

import { transform } from '../../../../src/transform';
import type { CodemodPlugin } from '../../../../src/types';
import { compileCodemod } from './compile-codemod';
import { describeError } from './parse';
import type { SourceType } from './source-types';
import { getProperty } from './object-access';

export type TransformOutcome = {
  code: string;
  stats: [name: string, count: number][];
  error: string | null;
};

function isCodemodPlugin(candidate: unknown): candidate is CodemodPlugin {
  return (
    getProperty(candidate, 'type') === 'codemod' &&
    typeof getProperty(candidate, 'name') === 'string' &&
    typeof getProperty(candidate, 'transform') === 'function'
  );
}

function asPlugins(exported: unknown): CodemodPlugin[] {
  const candidates = Array.isArray(exported) ? exported : [exported];

  return candidates.map((candidate) => {
    if (!isCodemodPlugin(candidate)) {
      throw new Error(
        'The codemod must export a CodemodPlugin: an object with ' +
          "`type: 'codemod'`, a `name`, and a `transform` function",
      );
    }

    return candidate;
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
