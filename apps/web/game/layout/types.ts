// An office layout is plain data (no Phaser), so it can be stored in the
// database later (R5: templates / generator) and sent to every client.
// All positions and sizes are in tiles (see TILE).

export type FloorKind = 'oak' | 'carpet' | 'terrazzo';

export interface Room {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  floor: FloorKind;
  /** Floor tint, used by carpets. */
  color?: number;
}

/** A straight wall from (x1, y1) to (x2, y2). Leave gaps for doors. */
export interface Wall {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  kind: 'solid' | 'glass';
  /** Horizontal walls show their front face (3/4 view) unless set to false. */
  face?: boolean;
}

export type FurnitureKind =
  | 'desk'
  | 'chair'
  | 'divider'
  | 'meetingTable'
  | 'tv'
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
  | 'floorLamp';

/**
 * A piece of furniture, centred on (x, y), with its unrotated size w × h.
 * rotation 0 = the person using it faces north (up the screen),
 * e.g. a desk with the monitor at the top and the chair below it.
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

/** Areas the game reports to the features (meeting call, chill room, desk). */
export type ZoneType = 'meeting' | 'chill' | 'desk';

export interface Zone {
  type: ZoneType;
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FloorLabel {
  text: string;
  x: number;
  y: number;
  /** Use 'dark' on light floors. */
  tone?: 'light' | 'dark';
}

export interface OfficeLayout {
  id: string;
  name: string;
  width: number;
  height: number;
  rooms: Room[];
  walls: Wall[];
  furniture: Furniture[];
  zones: Zone[];
  labels: FloorLabel[];
  spawn: { x: number; y: number };
}
