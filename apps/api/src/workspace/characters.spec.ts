import { describe, expect, it } from 'vitest';
import { DNA_SIZES, isCharacter } from './characters';

describe('isCharacter', () => {
  it('accepts the named characters', () => {
    expect(isCharacter('maya')).toBe(true);
    expect(isCharacter('ivan')).toBe(true);
  });

  it('accepts a recipe code within every choice', () => {
    const smallest = '1' + DNA_SIZES.map(() => '0').join('');
    const largest = '1' + DNA_SIZES.map((size) => (size - 1).toString(36)).join('');
    expect(isCharacter(smallest)).toBe(true);
    expect(isCharacter(largest)).toBe(true);
  });

  it('refuses codes that are out of range, too short, upper case or another version', () => {
    const tooBig = '1' + DNA_SIZES.map((size, i) => (i === 0 ? size : 0).toString(36)).join('');
    expect(isCharacter(tooBig)).toBe(false);
    expect(isCharacter('1000')).toBe(false);
    expect(isCharacter('1' + 'A'.repeat(DNA_SIZES.length))).toBe(false);
    expect(isCharacter('2' + '0'.repeat(DNA_SIZES.length))).toBe(false);
    expect(isCharacter('bob')).toBe(false);
    expect(isCharacter(42)).toBe(false);
  });
});
