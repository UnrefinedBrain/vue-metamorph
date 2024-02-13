import { builders, namedTypes, visit } from 'ast-types';
import * as AST from './ast';
import * as templateBuilders from './builders';
import * as astHelpers from './ast-helpers';

export const util = {
  traverseTemplateAST: AST.traverseNodes,
  traverseScriptAST: visit,
  templateBuilders,
  scriptBuilders: builders,
  astHelpers,
};

export type ReportFunction = (node: AST.Node, message: string) => void;

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
   * @param scriptAST - If this is a .vue file, the AST of the \<script\> block.
   * If this is a JS/TS module, the AST of the module
   * @param sfcAST - If this is a .vue file, the AST of the SFC. Otherwise, null
   * @param filename - The absolute path of the file being worked on
   * @param report - Function to report a node that needs to be migrated
   * @param utils - Utility functions
   */
  find(
    scriptAST: namedTypes.Program | null,
    sfcAST: AST.VDocumentFragment | null,
    filename: string,
    report: ReportFunction,
    utils: typeof util,
  ): void;
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
   * @param scriptAST - If this is a .vue file, the AST of the `<script>` block.
   * If this is a JS/TS module, the AST of the module
   * @param sfcAST - If this is a .vue file, the AST of the SFC. Otherwise, null
   * @param filename - The absolute path of the file being worked on
   * @param utils - Utility functions
   * @returns Number of transforms applied. Used for stats
   */
  transform(
    scriptAST: namedTypes.Program | null,
    sfcAST: AST.VDocumentFragment | null,
    filename: string,
    utils: typeof util,
  ): number;
};

/**
 * Union of plugin types
 * @public
 */
export type Plugin = ManualMigrationPlugin | CodemodPlugin;
