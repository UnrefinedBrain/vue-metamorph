import * as types from "../ast-types/main";
import { parse } from "./lib/parser";
import { Printer } from "./lib/printer";
import { Options } from "./lib/options";

export {
  /**
   * Parse a string of code into an augmented syntax tree suitable for
   * arbitrary modification and reprinting.
   */
  parse,
  /**
   * Convenient shorthand for the ast-types package.
   */
  types,
};

/**
 * Traverse and potentially modify an abstract syntax tree using a
 * convenient visitor syntax:
 *
 *   recast.visit(ast, {
 *     names: [],
 *     visitIdentifier: function(path) {
 *       var node = path.value;
 *       this.visitor.names.push(node.name);
 *       this.traverse(path);
 *     }
 *   });
 */
export { visit } from "../ast-types/main";

/**
 * Options shared between parsing and printing.
 */
// LOCAL DEVIATION: `export type` (not `export`) — required by isolatedModules,
// which this repo enables and the bundler needs. Options is a type only.
export type { Options } from "./lib/options";

/**
 * Reprint a modified syntax tree using as much of the original source
 * code as possible.
 */
export function print(node: types.ASTNode, options?: Options) {
  return new Printer(options).print(node);
}

/**
 * Print without attempting to reuse any original source code.
 */
export function prettyPrint(node: types.ASTNode, options?: Options) {
  return new Printer(options).printGenerically(node);
}
