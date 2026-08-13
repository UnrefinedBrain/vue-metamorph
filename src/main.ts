import * as Kinds from './vendor/ast-types/gen/kinds';
import { builders as scriptBuilders, visit } from './vendor/ast-types/main';
import postcss from 'postcss';
import * as templateBuilders from './builders';
import * as AST from './ast';

export * as astHelpers from './ast-helpers';

/**
 * Combined AST node builders for both script (ESTree/Babel) and template (Vue SFC) nodes.
 *
 * Script builders create JavaScript/TypeScript AST nodes (e.g. `builders.identifier()`,
 * `builders.callExpression()`). Template builders create Vue template AST nodes
 * (e.g. `builders.vElement()`, `builders.vDirective()`).
 *
 * @public
 */
const builders = {
  ...scriptBuilders,
  ...templateBuilders,
};

/**
 * @public
 */
export type Builders = typeof builders;

export { builders, postcss };

export {
  /**
   * Union types of various AST kinds
   */
  type Kinds,
};

export { namedTypes } from './vendor/ast-types/main';

/**
 * Traverse a script AST, an alias for ast-types' `visit`.
 *
 * Declared here rather than re-exported directly so it carries a release tag;
 * api-extractor cannot attach one to a destructured binding inside the
 * vendored module.
 *
 * @public
 */
const traverseScriptAST = visit;

export { traverseScriptAST };

export {
  createVueMetamorphCli,
  type CreateVueMetamorphCliOptions,
  type ErrorReport,
  type ProgressCallback,
} from './cli.js';

export { transform, type TransformResult } from './transform.js';

export { findManualMigrations, type ManualMigrationReport } from './manual.js';

export type {
  Plugin,
  CodemodPlugin,
  ManualMigrationPlugin,
  VueProgram,
  CodemodPluginContext,
  ManualMigrationPluginContext,
} from './types.js';

export type { AST };
