import { describe, expect, it } from 'vitest';
import { getRange, hasBabelPosition, hasRange } from './node-range';
import { vText } from './builders';

describe('hasRange', () => {
  it('should accept a node carrying a numeric range', () => {
    expect(hasRange({ type: 'VText', range: [0, 5] })).toBe(true);
  });

  it('should reject a node built by the builders, which carries no range', () => {
    expect(hasRange(vText('hello'))).toBe(false);
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['a string', 'VText'],
    ['a number', 5],
    ['a node with no range', { type: 'VText' }],
    ['a non-array range', { range: '0,5' }],
    ['a range holding non-numbers', { range: [null, 5] }],
    ['a range that is too short', { range: [0] }],
  ])('should reject %s', (_label, value) => {
    expect(hasRange(value)).toBe(false);
  });
});

describe('hasBabelPosition', () => {
  it('should accept a node carrying numeric start and end offsets', () => {
    expect(hasBabelPosition({ start: 0, end: 5 })).toBe(true);
  });

  it.each([
    ['null', null],
    ['a node with no offsets', { type: 'Identifier' }],
    ['a node missing end', { start: 0 }],
    ['a node whose offsets are null', { start: null, end: null }],
  ])('should reject %s', (_label, value) => {
    expect(hasBabelPosition(value)).toBe(false);
  });
});

describe('getRange', () => {
  it('should return the range of a parsed node', () => {
    expect(getRange({ type: 'VText', range: [3, 9] }, 'the node')).toEqual([3, 9]);
  });

  it('should throw a message naming the node when the range is missing', () => {
    expect(() => getRange({ type: 'VText' }, 'the template root')).toThrow(
      'Expected the template root to carry a source range, but it has none.',
    );
  });
});
