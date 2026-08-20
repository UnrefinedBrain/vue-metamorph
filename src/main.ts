import * as Kinds from './vendor/ast-types/gen/kinds';
import { builders as scriptBuilders, visit } from './vendor/ast-types/main';
import postcss from 'postcss';
import * as templateBuilders from './builders';
import * as AST from './ast';

export * as astHelpers from './ast-helpers';

/**
 * The AST node builders for both script nodes and Vue SFC template nodes.
 *
 * Script builders create JavaScript and TypeScript AST nodes, such as `builders.identifier()`
 * and `builders.callExpression()`. Template builders create Vue template AST nodes, such as
 * `builders.vElement()` and `builders.vDirective()`.
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
   * The union types of the various AST kinds.
   */
  type Kinds,
};

export { namedTypes } from './vendor/ast-types/main';

/**
 * Traverses a script AST. This is an alias for the `visit` function from ast-types.
 *
 * It's declared here rather than re-exported directly so that it carries a release tag.
 * api-extractor can't attach a release tag to a destructured binding inside the vendored module.
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
