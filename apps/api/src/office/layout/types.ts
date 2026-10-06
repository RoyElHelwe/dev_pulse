// The office layout, stored as JSON on the workspace. Same shape as
// apps/web/game/layout/types.ts (keep both in sync). Units are tiles (32 px).

export type FloorKind = 'oak' | 'carpet' | 'terrazzo';

/** Meeting rooms and lounges become zones in the game (voice, chill room...). */
export type RoomKind = 'open' | 'meeting' | 'lounge' | 'chill';

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

export interface Wall {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  kind: 'solid' | 'glass';
  face?: boolean;
}

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

export type FurnitureKind = (typeof FURNITURE_KINDS)[number];

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
