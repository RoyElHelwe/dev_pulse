import type { Furniture, OfficeLayout, Zone } from './types';

// Zones and floor labels are not stored: they follow the rooms and desks, so
// moving a desk in the editor moves its zone too.

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Axis-aligned bounds of a (possibly rotated) item, in tiles. */
export function itemBounds(item: Pick<Furniture, 'x' | 'y' | 'w' | 'h' | 'rotation'>): Rect {
  const turned = item.rotation === 90 || item.rotation === 270;
  const w = turned ? item.h : item.w;
  const h = turned ? item.w : item.h;
  return { x: item.x - w / 2, y: item.y - h / 2, w, h };
}

/** Where the person sits at a desk: just in front of its user side. */
export function seatPoint(desk: Furniture) {
  const distance = desk.h / 2 + 0.45;
  const angle = ((desk.rotation ?? 0) * Math.PI) / 180;
  return { x: desk.x - Math.sin(angle) * distance, y: desk.y + Math.cos(angle) * distance };
}

/** Desks in reading order: "Desk 1", "Desk 2"... (same numbering as the API). */
export function numberedDesks(layout: OfficeLayout) {
  return layout.furniture
    .filter((f) => f.kind === 'desk')
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .map((desk, i) => ({ desk, name: `Desk ${i + 1}` }));
}

/** Desk zones first: the most specific zone wins when they overlap. */
export function deriveZones(layout: OfficeLayout): Zone[] {
  const desks: Zone[] = numberedDesks(layout).map(({ desk, name }) => {
    const seat = seatPoint(desk);
    const turned = desk.rotation === 90 || desk.rotation === 270;
    const w = turned ? 1.4 : desk.w;
    const h = turned ? desk.w : 1.4;
    return { type: 'desk', id: desk.id, name, x: seat.x - w / 2, y: seat.y - h / 2, w, h };
  });
  const rooms: Zone[] = layout.rooms
    .filter((r) => r.kind !== 'open')
    .map((r) => ({ type: r.kind === 'meeting' ? 'meeting' : 'chill', id: r.id, name: r.name, x: r.x, y: r.y, w: r.w, h: r.h }));
  return [...desks, ...rooms];
}

/** Room names painted on the floor, near the bottom of each meeting room and lounge. */
export function deriveLabels(layout: OfficeLayout) {
  return layout.rooms
    .filter((r) => r.kind !== 'open')
    .map((r) => ({
      text: r.name.toUpperCase(),
      x: r.x + r.w / 2,
      y: r.y + r.h - 1.1,
      tone: r.floor === 'terrazzo' ? ('dark' as const) : ('light' as const),
    }));
}
