/**
 * Guards for the position properties that parsers attach to AST nodes but the node types omit.
 *
 * `ast.ts` drops `HasLocation` from the vue-eslint-parser node types so that the template
 * builders stay ergonomic, and ast-types models Babel nodes without `range`. A parsed node
 * still carries the property at runtime while a built node genuinely does not, so the only
 * honest way to read it is to check for it. These guards do that check, which keeps the
 * assertion out of the call sites.
 *
 * This mirrors the `'loc' in node` / `Array.isArray(node.range)` narrowing that `manual.ts`
 * already uses when it turns a reported node into a line and column.
 */

/**
 * A `[start, end]` offset pair into the original source.
 */
export type SourceRange = [start: number, end: number];

/**
 * A node carrying the `range` a parser attaches.
 */
export type HasRange = {
  range: SourceRange;
};

/**
 * A Babel node carrying the offsets that `range` is backfilled from.
 */
export type HasBabelPosition = {
  start: number;
  end: number;
};

/**
 * Reports whether `node` carries the `[start, end]` range that a parser attaches.
 *
 * Nodes built by the template builders have no range, so this returns `false` for them.
 */
export function hasRange<T>(node: T): node is T & HasRange {
  if (!node || typeof node !== 'object' || !('range' in node)) {
    return false;
  }

  const { range } = node;

  return Array.isArray(range) && typeof range[0] === 'number' && typeof range[1] === 'number';
}

/**
 * Reports whether `node` carries the numeric `start` and `end` offsets that Babel attaches.
 */
export function hasBabelPosition<T>(node: T): node is T & HasBabelPosition {
  if (!node || typeof node !== 'object') {
    return false;
  }

  if (!('start' in node) || !('end' in node)) {
    return false;
  }

  return typeof node.start === 'number' && typeof node.end === 'number';
}

/**
 * Returns the source range of a node that must have come from a parser.
 *
 * @param node - The node to read the range from.
 * @param description - What the node is, used in the error message when the range is missing.
 * @throws If `node` has no range, which means it was built rather than parsed.
 */
export function getRange(node: unknown, description: string): SourceRange {
  if (!hasRange(node)) {
    throw new Error(`Expected ${description} to carry a source range, but it has none.`);
  }

  return node.range;
}
