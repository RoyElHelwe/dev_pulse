/**
 * Pure rules for the meeting room whiteboard: element validation and conflict-free merging.
 * Elements are Excalidraw drawing elements; the server only reads their identity and version.
 */

/** Excalidraw element ids (nanoid) and the like. */
const ELEMENT_ID = /^[\w-]{1,64}$/;

/** Most elements one board holds (deleted ones are purged first when it fills up). */
export const MAX_ELEMENTS = 5_000;
/** One element: a long freehand stroke is the largest (about 10 bytes per point). */
export const MAX_ELEMENT_BYTES = 200_000;
/** One update message (Socket.IO itself refuses more than 1 MB). */
export const MAX_UPDATE_BYTES = 900_000;

/** A drawing element: the fields the server reads, the rest is stored as is. */
export interface BoardElement {
  id: string;
  version: number;
  versionNonce: number;
  isDeleted: boolean;
  [field: string]: unknown;
}

/** Validates a list of elements; null when anything in it is malformed or too large. */
export function parseElements(value: unknown, maxCount = MAX_ELEMENTS): BoardElement[] | null {
  if (!Array.isArray(value) || value.length > maxCount) return null;
  const out: BoardElement[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
    const el = item as Record<string, unknown>;
    if (typeof el.id !== 'string' || !ELEMENT_ID.test(el.id)) return null;
    if (
      !Number.isSafeInteger(el.version) ||
      (el.version as number) < 1 ||
      !Number.isSafeInteger(el.versionNonce)
    )
      return null;
    if (el.isDeleted !== undefined && typeof el.isDeleted !== 'boolean') return null;
    if (JSON.stringify(el).length > MAX_ELEMENT_BYTES) return null;
    out.push({ ...el, isDeleted: el.isDeleted === true } as BoardElement);
  }
  return out;
}

/**
 * Excalidraw's own rule, so every client and the server settle on the same copy:
 * the higher version wins; on a tie the lower random nonce wins.
 */
export function isNewer(incoming: BoardElement, current: BoardElement | undefined): boolean {
  if (!current) return true;
  if (incoming.version !== current.version) return incoming.version > current.version;
  return incoming.versionNonce < current.versionNonce;
}

/**
 * Applies incoming elements to the board (mutates `board`) and returns the ones accepted,
 * to pass on to the others. A full board drops its deleted elements to make room for new ones.
 */
export function mergeElements(
  board: Map<string, BoardElement>,
  incoming: BoardElement[],
  maxElements = MAX_ELEMENTS,
): BoardElement[] {
  const accepted: BoardElement[] = [];
  for (const el of incoming) {
    const current = board.get(el.id);
    if (!isNewer(el, current)) continue;
    if (!current && board.size >= maxElements) {
      purgeDeleted(board);
      if (board.size >= maxElements) continue;
    }
    board.set(el.id, el);
    accepted.push(el);
  }
  return accepted;
}

/** Drops deleted elements (people who join later load the board without them). */
export function purgeDeleted(board: Map<string, BoardElement>) {
  for (const [id, el] of board) if (el.isDeleted) board.delete(id);
}
