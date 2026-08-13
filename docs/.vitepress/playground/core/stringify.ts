/**
 * Ported from AST Explorer (https://github.com/fkling/astexplorer),
 * website/src/utils/stringify.js - MIT, Copyright (c) 2014 Felix Kling.
 *
 * Converts a JS value to a sensible string representation.
 */
export function stringify(value: unknown): string {
  switch (typeof value) {
    case 'function':
      return value.toString().match(/function[^(]*\([^)]*\)/)?.[0] ?? 'function ()';
    case 'object':
      return value ? JSON.stringify(value, (_key, nested: unknown) => stringify(nested)) : 'null';
    case 'undefined':
      return 'undefined';
    case 'number':
    case 'bigint':
      return Number.isNaN(value) ? 'NaN' : String(value);
    default:
      return JSON.stringify(value) ?? String(value);
  }
}
