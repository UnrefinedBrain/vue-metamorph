import { builders, namedTypes, visit } from 'ast-types';
import postcss from 'postcss';
import * as AST from './ast';
import * as templateBuilders from './builders';
import * as astHelpers from './ast-helpers';

export const utils = {
  traverseTemplateAST: AST.traverseNodes,
  traverseScriptAST: visit,
  builders: {
    ...templateBuilders,
    ...builders,
  },
  astHelpers,
};

/**
 * ESTree Program type, with an additional property `isScriptSetup` that denotes whether the program
 * represents the contents of a \<script setup\> block in a Vue SFC
 *
 * @public
 */
export type VueProgram = namedTypes.Program & {
  /**
   * Whether this Program represents the contents of a \<script setup\>
   *
   * In a JS/TS file, this will always be false.
   */
  isScriptSetup: boolean;
};

export type ReportFunction = (node: AST.Node | postcss.AnyNode, message: string) => void;

/**
 * @public
 */
export type ManualMigrationPluginContext = {
  /**
   * If this is a .vue file, the AST of the \<script\> blocks.
   * If this is a JS/TS module, the 0th element is the AST of the module
   */
  scriptASTs: VueProgram[];

  /**
   * If this is a .vue file, the AST of the SFC. Otherwise, null
   */
  sfcAST: AST.VDocumentFragment | null;

  /**
   * If this is a .vue file, postcss contexts of each \<style\> block
   * If this is a css/scss/less/sass file, the 0th element is the context of the file
   */
  styleASTs: postcss.Root[];

  /**
   * The absolute path of the file being worked on
   */
  filename: string;

  /**
   * Function to report a node that needs to be migrated
   */
  report: ReportFunction;

  /**
   * Utility functions
   */
  utils: typeof utils;

  /**
   * CLI Options
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  opts: Record<string, any>;
};

/**
 * A plugin for finding nodes that cannot be migrated automatically
 *
 * @public
 */
export type ManualMigrationPlugin = {
  type: 'manual';
  name: string;
  /**
   * Find nodes that need manual migration
   */
  find(context: ManualMigrationPluginContext): void;
};

/**
 * @public
 */
export type CodemodPluginContext = {
  /**
   * If this is a .vue file, the AST of the `<script>` blocks.
   * If this is a JS/TS module, the 0th element is the AST of the module
   */
  scriptASTs: VueProgram[];

  /**
   * If this is a .vue file, the AST of the SFC. Otherwise, null
   */
  sfcAST: AST.VDocumentFragment | null;

  /**
   * If this is a .vue file, postcss contexts of each \<style\> block
   * If this is a css/scss/less/sass file, the 0th element is the context of the file
   */
  styleASTs: postcss.Root[];

  /**
   * The absolute path of the file being worked on
   */
  filename: string;

  /**
   * Utility functions
   */
  utils: typeof utils;

  /**
   * CLI Options
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  opts: Record<string, any>;
};

/**
 * A plugin that updates source code
 * @public
 */
export type CodemodPlugin = {
  name: string;
  type: 'codemod';

  /**
   * Mutate the AST to make changes
   * @returns Number of transforms applied. Used for stats
   */
  transform(context: CodemodPluginContext): number;
};

/**
 * Union of plugin types
 * @public
 */
export type Plugin = ManualMigrationPlugin | CodemodPlugin;
