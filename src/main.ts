import * as Kinds from 'ast-types-x/gen/kinds';
import { builders as scriptBuilders } from 'ast-types-x';
import postcss from 'postcss';
import * as templateBuilders from './builders';
import * as AST from './ast';

export * as astHelpers from './ast-helpers';

/**
 * AST Node builders
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

export {
  builders,
  postcss,
};

export {
  /**
   * Union types of various AST kinds
   */
  type Kinds,
};

export {
  namedTypes,
  visit as traverseScriptAST,
} from 'ast-types-x';

export {
  createVueMetamorphCli,
  type CreateVueMetamorphCliOptions,
  type ErrorReport,
  type ProgressCallback,
} from './cli.js';

export {
  transform,
  type TransformResult,
} from './transform.js';

export {
  findManualMigrations,
  type ManualMigrationReport,
} from './manual.js';

export type {
  Plugin,
  CodemodPlugin,
  ManualMigrationPlugin,
  VueProgram,
  CodemodPluginContext,
  ManualMigrationPluginContext,
} from './types.js';

export type {
  AST,
};
