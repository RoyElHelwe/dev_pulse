import type { Furniture, OfficeLayout } from '../layout/types';

type NewItem = Omit<Furniture, 'id'>;

/** Small helpers to write office templates with readable numbers (tiles). */
export class LayoutBuilder {
  readonly furniture: Furniture[] = [];
  private next = 1;

  add(item: NewItem) {
    this.furniture.push({ id: `${item.kind}-${this.next++}`, ...item });
  }

  /** Four desks facing each other in pairs, a divider, and a plant at the end (6 × 5 tiles). */
  deskCluster(ox: number, oy: number) {
    for (const dx of [1.5, 4.5]) {
      this.add({ kind: 'desk', x: ox + dx, y: oy + 1.75, w: 3, h: 1.5, rotation: 180 });
      this.add({ kind: 'chair', x: ox + dx, y: oy + 0.6, w: 0.85, h: 0.85, rotation: 180 });
      this.add({ kind: 'desk', x: ox + dx, y: oy + 3.25, w: 3, h: 1.5, rotation: 0 });
      this.add({ kind: 'chair', x: ox + dx, y: oy + 4.4, w: 0.85, h: 0.85, rotation: 0 });
    }
    this.add({ kind: 'divider', x: ox + 3, y: oy + 2.5, w: 6, h: 0.14 });
    this.add({ kind: 'plant', x: ox + 6.65, y: oy + 2.5, w: 0.9, h: 0.9 });
  }

  /** Screen, table and chairs for a meeting room spanning x .. x + w (rooms start at y 0, 12 deep). */
  meetingRoom(x: number, w: number, tableW: number) {
    const cx = x + w / 2;
    this.add({ kind: 'tv', x: cx, y: 0.7, w: Math.min(3.6, w - 4), h: 0.28 });
    this.add({ kind: 'meetingTable', x: cx, y: 6.3, w: tableW, h: 2.4 });
    const seats = Math.max(1, Math.floor(tableW / 2));
    for (let i = 0; i < seats; i++) {
      const sx = cx + (i - (seats - 1) / 2) * 2;
      this.add({ kind: 'chair', x: sx, y: 4.65, w: 0.85, h: 0.85, rotation: 180 });
      this.add({ kind: 'chair', x: sx, y: 7.95, w: 0.85, h: 0.85, rotation: 0 });
    }
    if (w - tableW >= 5) {
      this.add({ kind: 'chair', x: cx - tableW / 2 - 0.9, y: 6.3, w: 0.85, h: 0.85, rotation: 90 });
      this.add({ kind: 'chair', x: cx + tableW / 2 + 0.9, y: 6.3, w: 0.85, h: 0.85, rotation: 270 });
    }
    this.add({ kind: 'plant', x: x + 1.2, y: 2.0, w: 1.1, h: 1.1 });
  }

  /** Kitchen counter + fridge along the north wall, starting at x. */
  kitchen(x: number, counterW: number) {
    this.add({ kind: 'counter', x: x + counterW / 2, y: 1.9, w: counterW, h: 1.3 });
    this.add({ kind: 'fridge', x: x + counterW + 0.9, y: 1.9, w: 1.5, h: 1.3 });
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
  chillCorner(cx: number, sofaColor = 0x5f7a6b) {
    this.add({ kind: 'rug', x: cx, y: 6.8, w: 9.5, h: 6.4, color: 0xd9cdbb });
    this.add({ kind: 'sofa', x: cx, y: 3.1, w: 5, h: 1.5, rotation: 180, color: sofaColor });
    this.add({ kind: 'coffeeTable', x: cx, y: 6.6, w: 2.8, h: 1.4 });
    this.add({ kind: 'armchair', x: cx - 3.9, y: 6.6, w: 1.5, h: 1.4, rotation: 90, color: 0xc9845f });
    this.add({ kind: 'armchair', x: cx + 3.9, y: 6.6, w: 1.5, h: 1.4, rotation: 270, color: 0xc9845f });
    this.add({ kind: 'beanbag', x: cx - 2, y: 9.6, w: 1.3, h: 1.2, color: 0x4f6d8f });
    this.add({ kind: 'beanbag', x: cx + 2, y: 9.6, w: 1.3, h: 1.2, color: 0xd8b25c });
  }

  /** Sofa against the south wall with armchairs and a coffee table, centred on cx, above wall y. */
  waitingArea(cx: number, wallY: number) {
    this.add({ kind: 'rug', x: cx, y: wallY - 2.4, w: 8.4, h: 3.8, color: 0xc8c2d6 });
    this.add({ kind: 'sofa', x: cx, y: wallY - 1, w: 4.4, h: 1.4, rotation: 0, color: 0x3f4a5a });
    this.add({ kind: 'coffeeTable', x: cx, y: wallY - 2.8, w: 2.4, h: 1.1 });
    this.add({ kind: 'armchair', x: cx - 3.4, y: wallY - 2.6, w: 1.4, h: 1.3, rotation: 90, color: 0xb8a48a });
    this.add({ kind: 'armchair', x: cx + 3.4, y: wallY - 2.6, w: 1.4, h: 1.3, rotation: 270, color: 0xb8a48a });
  }

  doormat(cx: number, wallY: number) {
    this.add({ kind: 'rug', x: cx, y: wallY - 0.65, w: 3.6, h: 0.9, color: 0x6b6f73 });
  }

  build(layout: Omit<OfficeLayout, 'furniture'>): OfficeLayout {
    return { ...layout, furniture: this.furniture };
  }
}
