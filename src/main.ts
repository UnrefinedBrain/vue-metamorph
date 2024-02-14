import * as Kinds from 'ast-types/gen/kinds';
import * as templateBuilders from './builders';

export {
  /**
   * Utility functions for building new Vue \<template\> AST Nodes
   */
  templateBuilders,
};

export {
  /**
   * Union types of various AST kinds
   */
  type Kinds,
};

export {
  namedTypes,
  builders as scriptBuilders,
} from 'ast-types';

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
} from './types.js';