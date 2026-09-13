/**
 * @fileoverview Guards for the source position that parsers attach to AST nodes.
 *
 * The `ast.ts` module leaves `HasLocation` out of the vue-eslint-parser node types to keep
 * the template builders ergonomic, and ast-types models Babel nodes without `range`. A
 * parsed node still carries the property at runtime. A node from the builders doesn't.
 */

export type SourceRange = [start: number, end: number];

export interface HasRange {
  range: SourceRange;
}

export interface HasBabelPosition {
  start: number;
  end: number;
}

export function hasRange<T>(node: T): node is T & HasRange {
  if (!node || typeof node !== 'object' || !('range' in node)) {
    return false;
  }

  const { range } = node;

  return Array.isArray(range) && typeof range[0] === 'number' && typeof range[1] === 'number';
}

/** Lines are 1-based, columns 0-based. */
export interface SourcePosition {
  line: number;
  column: number;
}

export interface SourceLocation {
  start: SourcePosition;
  end: SourcePosition;
}

export interface HasLoc {
  loc: SourceLocation;
}

function isPosition(value: unknown): value is SourcePosition {
  if (!value || typeof value !== 'object') {
    return false;
  }

  return (
    'line' in value &&
    typeof value.line === 'number' &&
    'column' in value &&
    typeof value.column === 'number'
  );
}

export function hasLoc<T>(node: T): node is T & HasLoc {
  if (!node || typeof node !== 'object' || !('loc' in node)) {
    return false;
  }

  const { loc } = node;

  if (!loc || typeof loc !== 'object') {
    return false;
  }

  return 'start' in loc && isPosition(loc.start) && 'end' in loc && isPosition(loc.end);
}

export function hasBabelPosition<T>(node: T): node is T & HasBabelPosition {
  if (!node || typeof node !== 'object') {
    return false;
  }

  if (!('start' in node) || !('end' in node)) {
    return false;
  }

  return typeof node.start === 'number' && typeof node.end === 'number';
}

export function getRange(node: unknown, description: string): SourceRange {
  if (!hasRange(node)) {
    throw new Error(`Expected ${description} to carry a source range, but it has none.`);
  }

  return node.range;
}

export function getLoc(node: unknown, description: string): SourceLocation {
  if (!hasLoc(node)) {
    throw new Error(`Expected ${description} to carry a source location, but it has none.`);
  }

  return node.loc;
}
