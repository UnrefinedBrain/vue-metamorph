/**
 * Minimal browser stand-in for Node's `path`.
 *
 * vue-eslint-parser calls `path.extname()` to decide whether it is looking at
 * an SFC, and a few transitive dependencies do light-weight path juggling.
 * None of them need the real thing.
 */

const normalize = (p: unknown) => String(p ?? '').replace(/\\/g, '/');

export const sep = '/';
export const delimiter = ':';

export function basename(p: string, ext?: string): string {
  const base = normalize(p).split('/').filter(Boolean).pop() ?? '';
  return ext && base !== ext && base.endsWith(ext) ? base.slice(0, -ext.length) : base;
}

export function extname(p: string): string {
  const base = basename(p);
  const index = base.lastIndexOf('.');
  return index <= 0 ? '' : base.slice(index);
}

export function dirname(p: string): string {
  const parts = normalize(p).split('/');
  parts.pop();
  return parts.join('/') || '.';
}

export function isAbsolute(p: string): boolean {
  return normalize(p).startsWith('/');
}

export function join(...parts: string[]): string {
  const joined = parts.filter(Boolean).map(normalize).join('/');
  return joined.replace(/\/{2,}/g, '/') || '.';
}

export function resolve(...parts: string[]): string {
  const joined = join(...parts);
  return isAbsolute(joined) ? joined : `/${joined}`;
}

export function relative(_from: string, to: string): string {
  return normalize(to);
}

export function normalizePath(p: string): string {
  return normalize(p);
}

export default {
  sep,
  delimiter,
  basename,
  extname,
  dirname,
  isAbsolute,
  join,
  resolve,
  relative,
  normalize: normalizePath,
};
