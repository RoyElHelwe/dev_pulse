// Mirror of apps/web/game/layout/types.ts, which also holds web-only Zone types.
// The office layout data structures stored as JSON on the workspace. Units are tiles (32 px).

type FloorKind = 'oak' | 'carpet' | 'terrazzo';

/** Meeting rooms and lounges become zones in the game (voice, chill room...). */
type RoomKind = 'open' | 'meeting' | 'lounge' | 'chill';

/** Defined room or zone within the office building. */
export interface Room {
  id: string;
  name: string;
  kind: RoomKind;
  x: number;
  y: number;
  w: number;
  h: number;
  floor: FloorKind;
  color?: number;
}

/** Structural wall boundary with rendering and collision properties. */
export interface Wall {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  kind: 'solid' | 'glass';
  face?: boolean;
}

/** Catalog of supported furniture item kinds. */
export const FURNITURE_KINDS = [
  'desk',
  'chair',
  'divider',
  'meetingTable',
  'tv',
  'board',
  'sofa',
  'armchair',
  'coffeeTable',
  'rug',
  'plant',
  'bookshelf',
  'counter',
  'fridge',
  'barTable',
  'stool',
  'beanbag',
  'floorLamp',
  'foosball',
  'cardTable',
  'legoBoard',
] as const;

/** Specific kind of furniture item. */
export type FurnitureKind = (typeof FURNITURE_KINDS)[number];

/** Placed furniture item within the office layout. */
export interface Furniture {
  id: string;
  kind: FurnitureKind;
  /** Centre, in tiles. */
  x: number;
  y: number;
  w: number;
  h: number;
  rotation?: 0 | 90 | 180 | 270;
  color?: number;
}

/** Full office layout specification including dimensions, rooms, walls, and furniture. */
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
