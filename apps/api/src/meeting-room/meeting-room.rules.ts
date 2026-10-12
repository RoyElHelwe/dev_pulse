/**
 * Shared message parsing for the meeting room tools (screen share, whiteboard).
 */

/** Meeting room ids from the office layout. */
const ROOM_ID = /^[\w:-]{1,64}$/;

/** The `roomId` field of a socket message, when it looks like a room id. */
export function roomOf(body: unknown): string | null {
  const roomId = body && typeof body === 'object' ? (body as { roomId?: unknown }).roomId : undefined;
  return typeof roomId === 'string' && ROOM_ID.test(roomId) ? roomId : null;
}
