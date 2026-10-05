import type { OfficeLayout, Room, Wall } from '../layout/types';
import { LayoutBuilder } from './builder';

// An office made for the team, in a few steps (same conventions as the hand-made templates):
// 1. a north band, 12 deep: meeting rooms side by side, then the kitchen + lounge;
// 2. an open space below with desk clusters (4 desks each) in a grid;
// 3. the entrance in the middle of the south wall, a waiting area next to it.
// The seed only changes the look: room order and names, carpet colours, plants, which side
// the meeting rooms are on (the seed is the office name, so the wizard's preview is what you
// get). The size only depends on the team.

const BAND = 12; // depth of the north band (meeting rooms, lounge)
const COL = 14; // distance between desk clusters, west to east
const ROW = 7.5; // and north to south
const CLUSTER_W = 7; // a cluster with its plant
const FIRST_ROW = 15.5;
const MIN_LOUNGE = 21;

const ROOM_NAMES = ['Atlas', 'Nova', 'Orion', 'Vega', 'Lyra', 'Juno', 'Echo', 'Focus', 'Cedar', 'Maple', 'Pixel', 'Sol'];
const CARPETS = [0x7d8796, 0x8b8478, 0x6f7f74, 0x7b7489, 0x8a7f8f, 0x6e7c86];
const SOFAS = [0x5f7a6b, 0x3d5a80, 0x6b5b7a, 0x8a5a44];
const ROOM_SIZES = { big: { w: 13, table: 7 }, medium: { w: 11, table: 5 }, small: { w: 9, table: 4.2 } };

/** Desks for the team, with ~25% to grow (at least 4). */
export function desksFor(teamSize: number) {
  return Math.max(4, Math.ceil(teamSize * 1.25));
}

/** One meeting room per ~10 people, up to 4. */
export function meetingRoomsFor(teamSize: number) {
  return Math.min(4, Math.max(1, Math.ceil(teamSize / 10)));
}

export function generatedOffice(teamSize: number, seed: string): OfficeLayout {
  const team = Math.min(100, Math.max(1, Math.round(teamSize)));
  const rand = random(seed.trim().toLowerCase().replace(/\s+/g, ' '));
  const flip = rand() < 0.5;
  const b = new LayoutBuilder();

  // Sizes: meeting rooms, desk grid, then the building around them.
  const meetings = meetingRooms(team, rand);
  const clusters = Math.ceil(desksFor(team) / 4);
  const cols = Math.min(6, Math.ceil(Math.sqrt(clusters)));
  const rows = Math.ceil(clusters / cols);
  const meetingsW = meetings.reduce((sum, m) => sum + m.w, 0);
  const width = Math.max(COL * cols + 4, meetingsW + MIN_LOUNGE);
  const height = Math.ceil(FIRST_ROW + ROW * (rows - 1) + 11);
  const door = Math.round(width / 2);

  const rooms: Room[] = [];
  const walls: Wall[] = [
    { x1: 0, y1: 0, x2: width, y2: 0, kind: 'solid' },
    { x1: 0, y1: height, x2: door - 2, y2: height, kind: 'solid', face: false },
    { x1: door + 2, y1: height, x2: width, y2: height, kind: 'solid', face: false },
    { x1: 0, y1: 0, x2: 0, y2: height, kind: 'solid' },
    { x1: width, y1: 0, x2: width, y2: height, kind: 'solid' },
  ];

  // 1. Meeting rooms, glass between them, a door near each one's east side.
  const names = shuffle(ROOM_NAMES, rand);
  const carpets = shuffle(CARPETS, rand);
  let x = 0;
  meetings.forEach((m, i) => {
    b.meetingRoom(x, m.w, m.table);
    rooms.push({ id: names[i].toLowerCase(), name: names[i], kind: 'meeting', x, y: 0, w: m.w, h: BAND, floor: 'carpet', color: carpets[i] });
    if (x > 0) walls.push({ x1: x, y1: 0, x2: x, y2: BAND, kind: 'glass' });
    walls.push(
      { x1: x, y1: BAND, x2: x + m.w - 4.5, y2: BAND, kind: 'glass' },
      { x1: x + m.w - 1.5, y1: BAND, x2: x + m.w, y2: BAND, kind: 'glass' },
    );
    x += m.w;
  });

  // Kitchen + lounge: fills the rest of the band, a second chill corner when it's long.
  const lounge = width - x;
  b.kitchen(x + 1, team <= 8 ? 6 : team <= 24 ? 8 : 9);
  b.barTable(x + 5, 6.5);
  b.chillCorner(width - 5.5, pick(SOFAS, rand));
  if (lounge >= 34) b.chillCorner(width - 18, pick(SOFAS, rand));
  b.add({ kind: 'plant', x: x + 1.2, y: 10.8, w: 1, h: 1 });
  b.add({ kind: 'plant', x: width - 1, y: 11, w: 1, h: 1 });
  rooms.push({ id: 'lounge', name: 'Lounge', kind: 'lounge', x, y: 0, w: lounge, h: BAND, floor: 'terrazzo' });
  walls.push(
    { x1: x, y1: 0, x2: x, y2: BAND, kind: 'solid' },
    { x1: x, y1: BAND, x2: x + 3, y2: BAND, kind: 'solid' },
    { x1: x + 7, y1: BAND, x2: width - 10, y2: BAND, kind: 'solid' },
    { x1: width - 6, y1: BAND, x2: width, y2: BAND, kind: 'solid' },
  );

  // 2. Open space: desk clusters in a centred grid, sometimes a plant between them.
  rooms.push({ id: 'open', name: 'Open space', kind: 'open', x: 0, y: BAND, w: width, h: height - BAND, floor: 'oak' });
  const left = Math.round(width - (COL * (cols - 1) + CLUSTER_W)) / 2;
  for (let i = 0; i < clusters; i++) {
    const ox = left + (i % cols) * COL;
    const oy = FIRST_ROW + Math.floor(i / cols) * ROW;
    b.deskCluster(ox, oy);
    const nextInRow = i % cols < cols - 1 && i + 1 < clusters;
    if (nextInRow && i + cols < clusters && rand() < 0.7) b.add({ kind: 'plant', x: ox + 10.5, y: oy + 6.25, w: 1.2, h: 1.2 });
  }
  b.add({ kind: 'plant', x: 1, y: 13.9, w: 1, h: 1 });
  b.add({ kind: 'plant', x: width - 1, y: 13.9, w: 1, h: 1 });
  if (rows > 1 || rand() < 0.5) b.add({ kind: 'bookshelf', x: width - 0.6, y: FIRST_ROW + 3, w: 4, h: 0.8, rotation: 90 });

  // 3. Entrance, waiting area(s), a plant in the corners.
  b.waitingArea(6, height);
  if (width >= 50) b.waitingArea(width - 7, height);
  else b.add({ kind: 'plant', x: width - 1, y: height - 1, w: 1.1, h: 1.1 });
  b.doormat(door, height);

  const layout = b.build({ width, height, rooms, walls, spawn: { x: door, y: height - 2.5 } });
  return { ...(flip ? mirror(layout) : layout), generated: { teamSize: team, seed } };
}

/** The first room is bigger (or medium for a small team), the others small; the seed shuffles them. */
function meetingRooms(team: number, rand: () => number) {
  const count = meetingRoomsFor(team);
  if (count === 1) return [team > 6 ? ROOM_SIZES.big : ROOM_SIZES.medium];
  return shuffle([ROOM_SIZES.big, ...Array.from({ length: count - 1 }, () => ROOM_SIZES.small)], rand);
}

/** West ↔ east, so the meeting rooms end up on the other side. */
function mirror(layout: OfficeLayout): OfficeLayout {
  const W = layout.width;
  const turn = { 90: 270, 270: 90 } as const;
  return {
    ...layout,
    rooms: layout.rooms.map((r) => ({ ...r, x: W - r.x - r.w })),
    walls: layout.walls.map((w) => ({ ...w, x1: W - w.x2, x2: W - w.x1 })),
    furniture: layout.furniture.map((f) => ({
      ...f,
      x: W - f.x,
      ...(f.rotation === 90 || f.rotation === 270 ? { rotation: turn[f.rotation] } : {}),
    })),
    spawn: { x: W - layout.spawn.x, y: layout.spawn.y },
  };
}

/** Small seeded random numbers (FNV-1a hash + mulberry32): same seed, same office. */
function random(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(list: readonly T[], rand: () => number) {
  return list[Math.floor(rand() * list.length)];
}

function shuffle<T>(list: readonly T[], rand: () => number) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
