// Builder helper for constructing programmatic office templates and wings.
// Provides grid-based methods for placing furniture clusters, rooms, and decorative items.

import type { Furniture, FurnitureKind, OfficeLayout } from '../layout/types';

type NewItem = Omit<Furniture, 'id'>;

/** Standard chair dimension in tiles (0.85 × 0.85). */
const CHAIR = 0.85;

/**
 * Vertical offset in tiles to place wall-mounted items flush against the tall south face of a wall.
 * Solid horizontal walls have a tall south-facing face whose base sits at wallY + 5/32 (see mount.ts).
 */
const WALL_FLUSH_OFFSET = 5 / 32;

/** Fluent builder for populating furniture layouts with consistent coordinates and dimensions. */
export class LayoutBuilder {
  readonly furniture: Furniture[] = [];
  private next = 1;

  constructor(private prefix = '') {}

  /** Adds a new furniture item to the layout, assigning it a sequential unique identifier. */
  add(item: NewItem) {
    this.furniture.push({ id: `${this.prefix}${item.kind}-${this.next++}`, ...item });
  }

  /** Adds a square potted plant with optional dimension (defaults to 1 × 1 tiles). */
  plant(x: number, y: number, size = 1) {
    this.add({ kind: 'plant', x, y, w: size, h: size });
  }

  /** Wall-mounted item (tv, board, legoBoard) at canonical y flush against a solid horizontal wall at wallY. */
  wallBoard(kind: FurnitureKind, x: number, wallY: number, w: number, h: number, id?: string) {
    const y = wallY + WALL_FLUSH_OFFSET + h / 2;
    if (id) {
      this.furniture.push({ id, kind, x, y, w, h });
    } else {
      this.add({ kind, x, y, w, h });
    }
  }

  /** Four desks facing each other in pairs, a divider, and a plant at the end (6 × 5 tiles). */
  deskCluster(ox: number, oy: number) {
    for (const dx of [1.5, 4.5]) {
      this.add({ kind: 'desk', x: ox + dx, y: oy + 1.75, w: 3, h: 1.5, rotation: 180 });
      this.add({ kind: 'chair', x: ox + dx, y: oy + 0.6, w: CHAIR, h: CHAIR, rotation: 180 });
      this.add({ kind: 'desk', x: ox + dx, y: oy + 3.25, w: 3, h: 1.5, rotation: 0 });
      this.add({ kind: 'chair', x: ox + dx, y: oy + 4.4, w: CHAIR, h: CHAIR, rotation: 0 });
    }
    this.add({ kind: 'divider', x: ox + 3, y: oy + 2.5, w: 6, h: 0.14 });
    this.plant(ox + 6.65, oy + 2.5, 0.9);
  }

  /** Screen, table and chairs for a meeting room spanning x .. x + w (rooms start at y 0, 12 deep). */
  meetingRoom(x: number, w: number, tableW: number, oy = 0) {
    const cx = x + w / 2;
    this.wallBoard('tv', cx, oy, Math.min(3.6, w - 4), 0.28);
    this.add({ kind: 'meetingTable', x: cx, y: oy + 6.3, w: tableW, h: 2.4 });
    const seats = Math.max(1, Math.floor(tableW / 2));
    for (let i = 0; i < seats; i++) {
      const sx = cx + (i - (seats - 1) / 2) * 2;
      this.add({ kind: 'chair', x: sx, y: oy + 4.65, w: CHAIR, h: CHAIR, rotation: 180 });
      this.add({ kind: 'chair', x: sx, y: oy + 7.95, w: CHAIR, h: CHAIR, rotation: 0 });
    }
    if (w - tableW >= 5) {
      this.add({ kind: 'chair', x: cx - tableW / 2 - 0.9, y: oy + 6.3, w: CHAIR, h: CHAIR, rotation: 90 });
      this.add({ kind: 'chair', x: cx + tableW / 2 + 0.9, y: oy + 6.3, w: CHAIR, h: CHAIR, rotation: 270 });
    }
    this.plant(x + 1.2, oy + 2.0, 1.1);
  }

  /** Kitchen counter + fridge along the north wall, starting at x. */
  kitchen(x: number, counterW: number, oy = 0) {
    this.add({ kind: 'counter', x: x + counterW / 2, y: oy + 1.9, w: counterW, h: 1.3 });
    this.add({ kind: 'fridge', x: x + counterW + 0.9, y: oy + 1.9, w: 1.5, h: 1.3 });
  }

  /** High table with stools (5 × 3.5 tiles), centred on (cx, cy). */
  barTable(cx: number, cy: number) {
    this.add({ kind: 'barTable', x: cx, y: cy, w: 5, h: 1.3 });
    for (const dx of [-1.8, 0, 1.8]) {
      this.add({ kind: 'stool', x: cx + dx, y: cy - 1.15, w: 0.7, h: 0.7 });
      this.add({ kind: 'stool', x: cx + dx, y: cy + 1.15, w: 0.7, h: 0.7 });
    }
  }

  /** Sofa facing south, armchairs, coffee table and beanbags on a rug, centred on cx (rug 9.5 × 6.4). */
  chillCorner(cx: number, sofaColor = 0x5f7a6b, oy = 0) {
    this.add({ kind: 'rug', x: cx, y: oy + 6.8, w: 9.5, h: 6.4, color: 0xd9cdbb });
    this.add({ kind: 'sofa', x: cx, y: oy + 3.1, w: 5, h: 1.5, rotation: 180, color: sofaColor });
    this.add({ kind: 'coffeeTable', x: cx, y: oy + 6.6, w: 2.8, h: 1.4 });
    this.add({ kind: 'armchair', x: cx - 3.9, y: oy + 6.6, w: 1.5, h: 1.4, rotation: 90, color: 0xc9845f });
    this.add({ kind: 'armchair', x: cx + 3.9, y: oy + 6.6, w: 1.5, h: 1.4, rotation: 270, color: 0xc9845f });
    this.add({ kind: 'beanbag', x: cx - 2, y: oy + 9.6, w: 1.3, h: 1.2, color: 0x4f6d8f });
    this.add({ kind: 'beanbag', x: cx + 2, y: oy + 9.6, w: 1.3, h: 1.2, color: 0xd8b25c });
  }

  /** Sofa against the south wall with armchairs and a coffee table, centred on cx, above wall y. */
  waitingArea(cx: number, wallY: number) {
    this.add({ kind: 'rug', x: cx, y: wallY - 2.4, w: 8.4, h: 3.8, color: 0xc8c2d6 });
    this.add({ kind: 'sofa', x: cx, y: wallY - 1, w: 4.4, h: 1.4, rotation: 0, color: 0x3f4a5a });
    this.add({ kind: 'coffeeTable', x: cx, y: wallY - 2.8, w: 2.4, h: 1.1 });
    this.add({ kind: 'armchair', x: cx - 3.4, y: wallY - 2.6, w: 1.4, h: 1.3, rotation: 90, color: 0xb8a48a });
    this.add({ kind: 'armchair', x: cx + 3.4, y: wallY - 2.6, w: 1.4, h: 1.3, rotation: 270, color: 0xb8a48a });
  }

  /** South entrance doormat centered on cx along the south wall at wallY. */
  doormat(cx: number, wallY: number) {
    this.add({ kind: 'rug', x: cx, y: wallY - 0.65, w: 3.6, h: 0.9, color: 0x6b6f73 });
  }

  /** Card table (2.2 × 2.2) with 6 chairs facing the table. */
  cardTableWithSeats(cx: number, cy: number) {
    this.add({ kind: 'cardTable', x: cx, y: cy, w: 2.2, h: 2.2 });
    // 2 chairs north, facing south (down = 180)
    this.add({ kind: 'chair', x: cx - 0.55, y: cy - 1.55, w: CHAIR, h: CHAIR, rotation: 180 });
    this.add({ kind: 'chair', x: cx + 0.55, y: cy - 1.55, w: CHAIR, h: CHAIR, rotation: 180 });
    // 2 chairs south, facing north (up = 0)
    this.add({ kind: 'chair', x: cx - 0.55, y: cy + 1.55, w: CHAIR, h: CHAIR, rotation: 0 });
    this.add({ kind: 'chair', x: cx + 0.55, y: cy + 1.55, w: CHAIR, h: CHAIR, rotation: 0 });
    // 1 chair west, facing east (right = 90)
    this.add({ kind: 'chair', x: cx - 1.55, y: cy, w: CHAIR, h: CHAIR, rotation: 90 });
    // 1 chair east, facing west (left = 270)
    this.add({ kind: 'chair', x: cx + 1.55, y: cy, w: CHAIR, h: CHAIR, rotation: 270 });
  }

  /** Game room: 1 foosball, 1 cardTable with 6 seats, 1 legoBoard, rug & plant for charm. */
  chillRoom(rx: number, ry: number, rw = 11, rh = 12) {
    if (rh >= 18 && rw <= 14) {
      // Tall room (e.g. vertical wing)
      const cx = rx + rw / 2;
      this.wallBoard('legoBoard', cx, ry, 3, 0.5);
      this.add({ kind: 'foosball', x: cx, y: ry + 4.5, w: 3, h: 1.6 });
      this.add({ kind: 'rug', x: cx, y: ry + 10.5, w: 4.5, h: 4.5, color: 0xd9cdbb });
      this.cardTableWithSeats(cx, ry + 10.5);
      this.plant(rx + 1.5, ry + 15.5);
    } else if (rw >= 20) {
      // Wide room (e.g. bottom wing)
      const cx = rx + rw / 2;
      const cy = ry + rh / 2;
      this.wallBoard('legoBoard', rx + 6, ry, 3, 0.5);
      this.add({ kind: 'foosball', x: cx - 5.5, y: cy, w: 3, h: 1.6 });
      this.add({ kind: 'rug', x: cx + 3.5, y: cy, w: 4.5, h: 4.5, color: 0xd9cdbb });
      this.cardTableWithSeats(cx + 3.5, cy);
      this.plant(cx - 9.5, cy);
    } else {
      // Compact room (e.g. loft 11 × 12)
      // Off to the right: the room's name hangs on the wall to its left.
      const legoX = rx + rw - 2.4;
      this.wallBoard('legoBoard', legoX, ry, 3, 0.5);
      this.add({ kind: 'foosball', x: rx + 3.2, y: ry + 4.5, w: 3, h: 1.6 });
      const tableX = rx + rw - 3.2;
      const tableY = ry + 6.5;
      this.add({ kind: 'rug', x: tableX, y: tableY, w: 4.5, h: 4.5, color: 0xd9cdbb });
      this.cardTableWithSeats(tableX, tableY);
      this.plant(rx + rw - 1.2, ry + 1.8);
    }
  }

  /** Finalizes the layout by attaching the collected furniture list. */
  build(layout: Omit<OfficeLayout, 'furniture'>): OfficeLayout {
    return { ...layout, furniture: this.furniture };
  }
}
