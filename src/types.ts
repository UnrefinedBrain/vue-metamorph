import { builders, namedTypes, visit } from './vendor/ast-types/main';
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
 * An ESTree Program node with an extra `isScriptSetup` property, which says whether the program
 * holds the contents of a \<script setup\> block in a Vue SFC.
 *
 * @public
 */
export type VueProgram = namedTypes.Program & {
  /**
   * Whether this Program holds the contents of a \<script setup\> block.
   *
   * In a JavaScript or TypeScript file, this property is always `false`.
   */
  isScriptSetup: boolean;
};

/**
 * The parsed CLI options that vue-metamorph passes to each plugin.
 *
 * Options registered through `additionalCliOptions` aren't known ahead of time, so every key
 * reads as `unknown`. That's enough to check whether an option is set:
 *
 * ```ts
 * if (opts.myCustomOption) { ... }
 * ```
 *
 * To give an option a declared type, augment this interface once. Match the declaration to
 * the option's Commander registration. Augmentation doesn't validate or convert values.
 *
 * ```ts
 * import 'vue-metamorph';
 *
 * declare module 'vue-metamorph' {
 *   interface PluginOptions {
 *     myCustomOption?: boolean;
 *   }
 * }
 * ```
 *
 * @public
 */
export interface PluginOptions {
  [optionName: string]: unknown;
}

export type ReportFunction = (node: AST.Node | postcss.AnyNode, message: string) => void;

/**
 * @public
 */
export type ManualMigrationPluginContext = {
  /**
   * For a Vue file, the ASTs of the \<script\> blocks. For a JavaScript or TypeScript module,
   * the first element is the AST of the module.
   */
  scriptASTs: VueProgram[];

  /**
   * For a Vue file, the AST of the SFC. For any other file, `null`.
   */
  sfcAST: AST.VDocumentFragment | null;

  /**
   * For a Vue file, the PostCSS roots of the \<style\> blocks. For a CSS, SCSS, Sass, Less, or
   * Stylus file, the first element is the root of the file.
   */
  styleASTs: postcss.Root[];

  /**
   * The absolute path of the file that the plugin is running against.
   */
  filename: string;

  /**
   * Reports a node that needs to be migrated.
   */
  report: ReportFunction;

  /**
   * Helper functions and builder functions.
   */
  utils: typeof utils;

  /**
   * The parsed CLI options.
   */
  opts: PluginOptions;
};

/**
 * A plugin that finds nodes that can't be migrated automatically.
 *
 * @public
 */
export type ManualMigrationPlugin = {
  type: 'manual';
  name: string;
  /**
   * Finds the nodes that need manual migration.
   */
  find(context: ManualMigrationPluginContext): void;
};

/**
 * @public
 */
export type CodemodPluginContext = {
  /**
   * For a Vue file, the ASTs of the `<script>` blocks. For a JavaScript or TypeScript module,
   * the first element is the AST of the module.
   */
  scriptASTs: VueProgram[];

  /**
   * For a Vue file, the AST of the SFC. For any other file, `null`.
   */
  sfcAST: AST.VDocumentFragment | null;

  /**
   * For a Vue file, the PostCSS roots of the \<style\> blocks. For a CSS, SCSS, Sass, Less, or
   * Stylus file, the first element is the root of the file.
   */
  styleASTs: postcss.Root[];

  /**
   * The absolute path of the file that the plugin is running against.
   */
  filename: string;

  /**
   * Helper functions and builder functions.
   */
  utils: typeof utils;

  /**
   * The parsed CLI options.
   */
  opts: PluginOptions;
};

/**
 * A plugin that changes source code.
 * @public
 */
export type CodemodPlugin = {
  name: string;
  type: 'codemod';

  /**
   * Mutates the AST to change the source code.
   * @returns The number of transforms that the plugin applied. vue-metamorph uses this count for
   * its stats, and to decide whether to write the file back to disk.
   */
  transform(context: CodemodPluginContext): number;
};

/**
 * The union of the plugin types.
 * @public
 */
export type Plugin = ManualMigrationPlugin | CodemodPlugin;
