/**
 * Minimal browser stand-in for Node's `os`.
 *
 * The vendored recast reads `os.EOL` in getLineTerminator(). Its own
 * isBrowser() guard means the value is never actually consumed here, but the
 * import is at the top of the module now that the vendored sources are real
 * ESM, so something has to answer for it.
 */

export const EOL = '\n';

export default { EOL };
