import type { Furniture, OfficeLayout, Zone } from './types';

// "Studio": two glass meeting rooms, a kitchen + lounge, 24 desks in an open
// space and a waiting area by the entrance. Built with small helpers so the
// numbers stay readable.

const furniture: Furniture[] = [];
const zones: Zone[] = [];
let nextId = 0;

function add(item: Omit<Furniture, 'id'>) {
  furniture.push({ id: `${item.kind}-${nextId++}`, ...item });
}

/** Four desks facing each other in pairs, with a divider in the middle. */
function deskCluster(ox: number, oy: number, firstDesk: number) {
  let desk = firstDesk;
  for (const dx of [1.5, 4.5]) {
    // North row: people sit on the north side, facing south.
    add({ kind: 'desk', x: ox + dx, y: oy + 1.75, w: 3, h: 1.5, rotation: 180 });
    add({ kind: 'chair', x: ox + dx, y: oy + 0.6, w: 0.85, h: 0.85, rotation: 180 });
    zones.push({ type: 'desk', id: `desk-${desk}`, name: `Desk ${desk}`, x: ox + dx - 1.5, y: oy - 0.4, w: 3, h: 1.4 });
    desk++;
    // South row: people sit on the south side, facing north.
    add({ kind: 'desk', x: ox + dx, y: oy + 3.25, w: 3, h: 1.5, rotation: 0 });
    add({ kind: 'chair', x: ox + dx, y: oy + 4.4, w: 0.85, h: 0.85, rotation: 0 });
    zones.push({ type: 'desk', id: `desk-${desk}`, name: `Desk ${desk}`, x: ox + dx - 1.5, y: oy + 4, w: 3, h: 1.4 });
    desk++;
  }
  add({ kind: 'divider', x: ox + 3, y: oy + 2.5, w: 6, h: 0.14 });
  add({ kind: 'plant', x: ox + 6.65, y: oy + 2.5, w: 0.9, h: 0.9 });
}

// ---- Meeting room "Atlas" (x 0–13) ----------------------------------------
add({ kind: 'tv', x: 6.5, y: 0.7, w: 3.6, h: 0.28 });
add({ kind: 'meetingTable', x: 6.5, y: 6.3, w: 7, h: 2.6 });
for (const x of [4.5, 6.5, 8.5]) {
  add({ kind: 'chair', x, y: 4.45, w: 0.85, h: 0.85, rotation: 180 });
  add({ kind: 'chair', x, y: 8.15, w: 0.85, h: 0.85, rotation: 0 });
}
add({ kind: 'chair', x: 2.4, y: 6.3, w: 0.85, h: 0.85, rotation: 90 });
add({ kind: 'chair', x: 10.6, y: 6.3, w: 0.85, h: 0.85, rotation: 270 });
add({ kind: 'plant', x: 1.2, y: 2.0, w: 1.1, h: 1.1 });
add({ kind: 'plant', x: 12.2, y: 10.9, w: 1, h: 1 });
zones.push({ type: 'meeting', id: 'atlas', name: 'Atlas', x: 0, y: 1.2, w: 13, h: 10.8 });

// ---- Meeting room "Nova" (x 13–22) ----------------------------------------
add({ kind: 'tv', x: 17.5, y: 0.7, w: 2.8, h: 0.28 });
add({ kind: 'meetingTable', x: 17.5, y: 6.5, w: 4.2, h: 2.2 });
for (const x of [16.5, 18.5]) {
  add({ kind: 'chair', x, y: 4.85, w: 0.85, h: 0.85, rotation: 180 });
  add({ kind: 'chair', x, y: 8.15, w: 0.85, h: 0.85, rotation: 0 });
}
add({ kind: 'plant', x: 21.0, y: 2.0, w: 1, h: 1 });
zones.push({ type: 'meeting', id: 'nova', name: 'Nova', x: 13, y: 1.2, w: 9, h: 10.8 });

// ---- Kitchen + lounge (x 22–46) -------------------------------------------
add({ kind: 'counter', x: 27, y: 1.9, w: 8, h: 1.3 });
add({ kind: 'fridge', x: 31.9, y: 1.9, w: 1.5, h: 1.3 });
add({ kind: 'plant', x: 33.6, y: 2.1, w: 1.1, h: 1.1 });
add({ kind: 'barTable', x: 27, y: 6.5, w: 5, h: 1.3 });
for (const x of [25.2, 27, 28.8]) {
  add({ kind: 'stool', x, y: 5.35, w: 0.7, h: 0.7 });
  add({ kind: 'stool', x, y: 7.65, w: 0.7, h: 0.7 });
}
add({ kind: 'rug', x: 39.5, y: 6.8, w: 9.5, h: 6.4, color: 0xd9cdbb });
add({ kind: 'sofa', x: 39.5, y: 3.1, w: 5, h: 1.5, rotation: 180, color: 0x5f7a6b });
add({ kind: 'coffeeTable', x: 39.5, y: 6.6, w: 2.8, h: 1.4 });
add({ kind: 'armchair', x: 35.6, y: 6.6, w: 1.5, h: 1.4, rotation: 90, color: 0xc9845f });
add({ kind: 'armchair', x: 43.4, y: 6.6, w: 1.5, h: 1.4, rotation: 270, color: 0xc9845f });
add({ kind: 'beanbag', x: 37.5, y: 9.6, w: 1.3, h: 1.2, color: 0x4f6d8f });
add({ kind: 'beanbag', x: 41.5, y: 9.6, w: 1.3, h: 1.2, color: 0xd8b25c });
add({ kind: 'floorLamp', x: 44.9, y: 2.4, w: 1, h: 1 });
add({ kind: 'plant', x: 23.2, y: 10.8, w: 1, h: 1 });
add({ kind: 'plant', x: 45.0, y: 11.0, w: 1, h: 1 });
zones.push({ type: 'chill', id: 'lounge', name: 'Lounge', x: 22, y: 0, w: 24, h: 12 });

// ---- Open space (y 12–34) --------------------------------------------------
let desk = 1;
for (const oy of [15.5, 23]) {
  for (const ox of [5, 20, 35]) {
    deskCluster(ox, oy, desk);
    desk += 4;
  }
}
add({ kind: 'plant', x: 15.5, y: 21.75, w: 1.2, h: 1.2 });
add({ kind: 'plant', x: 30.5, y: 21.75, w: 1.2, h: 1.2 });
add({ kind: 'plant', x: 1.0, y: 13.9, w: 1, h: 1 });
add({ kind: 'plant', x: 45.0, y: 13.9, w: 1, h: 1 });
add({ kind: 'bookshelf', x: 0.6, y: 22, w: 5, h: 0.8, rotation: 270 });
add({ kind: 'bookshelf', x: 45.4, y: 22, w: 5, h: 0.8, rotation: 90 });

// Waiting area by the entrance.
add({ kind: 'rug', x: 6, y: 31.6, w: 8.4, h: 3.8, color: 0xc8c2d6 });
add({ kind: 'sofa', x: 6, y: 33.0, w: 4.4, h: 1.4, rotation: 0, color: 0x3f4a5a });
add({ kind: 'coffeeTable', x: 6, y: 31.2, w: 2.4, h: 1.1 });
add({ kind: 'armchair', x: 2.6, y: 31.4, w: 1.4, h: 1.3, rotation: 90, color: 0xb8a48a });
add({ kind: 'armchair', x: 9.4, y: 31.4, w: 1.4, h: 1.3, rotation: 270, color: 0xb8a48a });
add({ kind: 'floorLamp', x: 1.0, y: 33.0, w: 1, h: 1 });
add({ kind: 'rug', x: 23, y: 33.35, w: 3.6, h: 0.9, color: 0x6b6f73 });
add({ kind: 'plant', x: 45.0, y: 33.0, w: 1.1, h: 1.1 });

// Desk zones first: the most specific zone wins.
zones.sort((a, b) => (a.type === 'desk' ? -1 : 0) - (b.type === 'desk' ? -1 : 0));

export const studioLayout: OfficeLayout = {
  id: 'studio',
  name: 'Studio',
  width: 46,
  height: 34,
  rooms: [
    { id: 'atlas', name: 'Atlas', x: 0, y: 0, w: 13, h: 12, floor: 'carpet', color: 0x7d8796 },
    { id: 'nova', name: 'Nova', x: 13, y: 0, w: 9, h: 12, floor: 'carpet', color: 0x8b8478 },
    { id: 'lounge', name: 'Lounge', x: 22, y: 0, w: 24, h: 12, floor: 'terrazzo' },
    { id: 'open', name: 'Open space', x: 0, y: 12, w: 46, h: 22, floor: 'oak' },
  ],
  walls: [
    // Outside walls (door to the street at x 21–25).
    { x1: 0, y1: 0, x2: 46, y2: 0, kind: 'solid' },
    { x1: 0, y1: 34, x2: 21, y2: 34, kind: 'solid', face: false },
    { x1: 25, y1: 34, x2: 46, y2: 34, kind: 'solid', face: false },
    { x1: 0, y1: 0, x2: 0, y2: 34, kind: 'solid' },
    { x1: 46, y1: 0, x2: 46, y2: 34, kind: 'solid' },
    // Meeting rooms (glass, doors at x 8.5–11.5 and 14–17).
    { x1: 13, y1: 0, x2: 13, y2: 12, kind: 'glass' },
    { x1: 0, y1: 12, x2: 8.5, y2: 12, kind: 'glass' },
    { x1: 11.5, y1: 12, x2: 13, y2: 12, kind: 'glass' },
    { x1: 13, y1: 12, x2: 14, y2: 12, kind: 'glass' },
    { x1: 17, y1: 12, x2: 22, y2: 12, kind: 'glass' },
    // Lounge (openings at x 25–29 and 35–38).
    { x1: 22, y1: 0, x2: 22, y2: 12, kind: 'solid' },
    { x1: 22, y1: 12, x2: 25, y2: 12, kind: 'solid' },
    { x1: 29, y1: 12, x2: 35, y2: 12, kind: 'solid' },
    { x1: 38, y1: 12, x2: 46, y2: 12, kind: 'solid' },
  ],
  furniture,
  zones,
  labels: [
    { text: 'ATLAS', x: 6.5, y: 10.9 },
    { text: 'NOVA', x: 17.5, y: 10.9 },
    { text: 'LOUNGE', x: 32, y: 11.1, tone: 'dark' },
  ],
  spawn: { x: 23, y: 31.5 },
};
