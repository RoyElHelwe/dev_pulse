// Mirror of apps/api/src/office/layout/types.ts (plus web-only Zone types): change both together.

type FloorKind = 'oak' | 'carpet' | 'terrazzo';

/** Meeting rooms and lounges become zones (voice calls, chill room...). */
export type RoomKind = 'open' | 'meeting' | 'lounge' | 'chill';

/** A distinct room boundary with floor type, color tint, and room role. */
export interface Room {
  id: string;
  name: string;
  kind: RoomKind;
  x: number;
  y: number;
  w: number;
  h: number;
  floor: FloorKind;
  /** Floor tint, used by carpets. */
  color?: number;
}

/** A straight wall from (x1, y1) to (x2, y2). Gaps are doors. */
export interface Wall {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  kind: 'solid' | 'glass';
  /** Horizontal walls show their front face (3/4 view) unless set to false. */
  face?: boolean;
}

/** Supported furniture item classifications available for office layouts. */
export type FurnitureKind =
  | 'desk'
  | 'chair'
  | 'divider'
  | 'meetingTable'
  | 'tv'
  | 'board'
  | 'sofa'
  | 'armchair'
  | 'coffeeTable'
  | 'rug'
  | 'plant'
  | 'bookshelf'
  | 'counter'
  | 'fridge'
  | 'barTable'
  | 'stool'
  | 'beanbag'
  | 'floorLamp'
  | 'foosball'
  | 'cardTable'
  | 'legoBoard';

/**
 * A piece of furniture, centred on (x, y), with its unrotated size w × h.
 * rotation 0 = the person using it faces north (up the screen).
 */
export interface Furniture {
  id: string;
  kind: FurnitureKind;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation?: 0 | 90 | 180 | 270;
  color?: number;
}

/** Complete office layout definition including dimensions, rooms, walls, furniture, and spawn. */
export interface OfficeLayout {
  width: number;
  height: number;
  rooms: Room[];
  walls: Wall[];
  furniture: Furniture[];
  spawn: { x: number; y: number };
  /** Generated offices: what to build the same office again from (reset in the editor). */
  generated?: { teamSize: number; seed: string };
}

/** Areas the game reports to the features (meeting call, chill room, desk). */
export type ZoneType = 'meeting' | 'chill' | 'desk';

/** Rectangular trigger area reported to engine features (e.g., proximity voice, desk ownership). */
export interface Zone {
  type: ZoneType;
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
}
