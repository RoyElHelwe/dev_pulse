/** Unit tests for whiteboard rules: element validation, Excalidraw's merge order, and the board size cap. */
import { describe, expect, it } from 'vitest';
import { type BoardElement, isNewer, MAX_ELEMENT_BYTES, mergeElements, parseElements, purgeDeleted } from './whiteboard.rules';

const el = (id: string, version: number, versionNonce = 1, isDeleted = false): BoardElement => ({ id, version, versionNonce, isDeleted, type: 'rectangle' });

describe('parseElements', () => {
  it('accepts Excalidraw elements and keeps their other fields', () => {
    const parsed = parseElements([{ id: 'a1_B-2', version: 3, versionNonce: 42, type: 'ellipse', x: 10 }]);
    expect(parsed).toEqual([{ id: 'a1_B-2', version: 3, versionNonce: 42, isDeleted: false, type: 'ellipse', x: 10 }]);
  });

  it('refuses anything malformed', () => {
    expect(parseElements('nope')).toBeNull();
    expect(parseElements([null])).toBeNull();
    expect(parseElements([[1]])).toBeNull();
    expect(parseElements([{ id: 'has space', version: 1, versionNonce: 1 }])).toBeNull();
    expect(parseElements([{ id: 'a', version: 0, versionNonce: 1 }])).toBeNull();
    expect(parseElements([{ id: 'a', version: 1.5, versionNonce: 1 }])).toBeNull();
    expect(parseElements([{ id: 'a', version: 1, versionNonce: '1' }])).toBeNull();
    expect(parseElements([{ id: 'a', version: 1, versionNonce: 1, isDeleted: 'yes' }])).toBeNull();
  });

  it('refuses too many elements and oversized ones', () => {
    expect(parseElements([el('a', 1), el('b', 1)], 1)).toBeNull();
    expect(parseElements([{ ...el('a', 1), points: 'x'.repeat(MAX_ELEMENT_BYTES) }])).toBeNull();
  });
});

describe('isNewer', () => {
  it('takes a higher version, and the lower nonce on a tie', () => {
    expect(isNewer(el('a', 2), undefined)).toBe(true);
    expect(isNewer(el('a', 3), el('a', 2))).toBe(true);
    expect(isNewer(el('a', 2), el('a', 3))).toBe(false);
    expect(isNewer(el('a', 2, 5), el('a', 2, 9))).toBe(true);
    expect(isNewer(el('a', 2, 9), el('a', 2, 5))).toBe(false);
    expect(isNewer(el('a', 2, 5), el('a', 2, 5))).toBe(false);
  });
});

describe('mergeElements', () => {
  it('applies newer elements and returns only those', () => {
    const board = new Map([['a', el('a', 2)]]);
    const accepted = mergeElements(board, [el('a', 1), el('a', 3), el('b', 1)]);
    expect(accepted.map((e) => `${e.id}@${e.version}`)).toEqual(['a@3', 'b@1']);
    expect(board.get('a')?.version).toBe(3);
  });

  it('ends in the same state whatever order two edits arrive in', () => {
    const one = new Map<string, BoardElement>();
    const two = new Map<string, BoardElement>();
    mergeElements(one, [el('a', 4, 7), el('a', 4, 3)]);
    mergeElements(two, [el('a', 4, 3), el('a', 4, 7)]);
    expect(one.get('a')).toEqual(two.get('a'));
    expect(one.get('a')?.versionNonce).toBe(3);
  });

  it('keeps deletions so they reach the others', () => {
    const board = new Map([['a', el('a', 1)]]);
    expect(mergeElements(board, [el('a', 2, 1, true)])).toHaveLength(1);
    expect(board.get('a')?.isDeleted).toBe(true);
  });

  it('makes room on a full board by purging deleted elements, then refuses new ones', () => {
    const board = new Map([
      ['a', el('a', 1)],
      ['b', el('b', 1, 1, true)],
    ]);
    expect(mergeElements(board, [el('c', 1)], 2)).toHaveLength(1);
    expect([...board.keys()]).toEqual(['a', 'c']);
    expect(mergeElements(board, [el('d', 1)], 2)).toHaveLength(0);
    // Updating an element already there is always fine.
    expect(mergeElements(board, [el('a', 2)], 2)).toHaveLength(1);
  });
});

describe('purgeDeleted', () => {
  it('drops deleted elements only', () => {
    const board = new Map([
      ['a', el('a', 1)],
      ['b', el('b', 2, 1, true)],
    ]);
    purgeDeleted(board);
    expect([...board.keys()]).toEqual(['a']);
  });
});
