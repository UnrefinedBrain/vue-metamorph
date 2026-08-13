/**
 * Minimal browser stand-in for Node's `assert`.
 *
 * vue-eslint-parser's tokenizer asserts on internal invariants; throwing a
 * plain Error keeps the failure message intact.
 */

function assert(value: unknown, message?: string): asserts value {
  if (!value) {
    throw new Error(message ?? 'Assertion failed');
  }
}

assert.ok = assert;
assert.equal = (actual: unknown, expected: unknown, message?: string) => {
  // eslint-disable-next-line eqeqeq
  assert(actual == expected, message);
};
assert.strictEqual = (actual: unknown, expected: unknown, message?: string) => {
  assert(actual === expected, message);
};
assert.notEqual = (actual: unknown, expected: unknown, message?: string) => {
  // eslint-disable-next-line eqeqeq
  assert(actual != expected, message);
};
assert.notStrictEqual = (actual: unknown, expected: unknown, message?: string) => {
  assert(actual !== expected, message);
};
assert.fail = (message?: string) => {
  throw new Error(message ?? 'Assertion failed');
};

export default assert;
export { assert };
