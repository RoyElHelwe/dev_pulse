// Procedural office generation tailored to team size and seed.
// Constructs a northern meeting/lounge band, central open desk grid, and southern entrance.

import { pick, seededRandom, shuffle } from '../layout/random';
import type { OfficeLayout, Room, Wall } from '../layout/types';
import { LayoutBuilder } from './builder';
import { CARPETS, SOFAS } from './palette';

const BAND = 12; // depth of the north band (meeting rooms, lounge) in tiles
const COL = 14; // distance between desk clusters, west to east, in tiles
const ROW = 7.5; // distance between desk clusters, north to south, in tiles
const CLUSTER_W = 7; // a cluster with its plant, in tiles
const FIRST_ROW = 15.5; // y coordinate of the first desk cluster row, in tiles
const MIN_LOUNGE = 21; // minimum lounge width in tiles

const MAX_TEAM = 100; // max supported team size
const MIN_TEAM = 1; // min supported team size
const DESKS_PER_CLUSTER = 4; // number of desks per standard cluster
const CLUSTERS_PER_ROW_MAX = 6; // maximum number of cluster columns
const PLANT_BETWEEN_CLUSTERS_CHANCE = 0.7; // probability of placing a decorative plant between adjacent clusters

const TWO_CHILL_CORNERS_MIN_LOUNGE_W = 34; // tiles: minimum lounge width to place two chill corners
const SECOND_WAITING_AREA_MIN_W = 50; // tiles: minimum building width to place two waiting areas

const KITCHEN_TEAM_SMALL = 8;
const KITCHEN_TEAM_MEDIUM = 24;
const KITCHEN_COUNTER_W_SMALL = 6; // tiles: counter width for small teams (<= 8)
const KITCHEN_COUNTER_W_MEDIUM = 8; // tiles: counter width for medium teams (<= 24)
const KITCHEN_COUNTER_W_LARGE = 9; // tiles: counter width for large teams (> 24)

const MEETING_DOOR_LEFT_OFFSET = 4.5; // tiles: door start offset from east wall of meeting room
const MEETING_DOOR_RIGHT_OFFSET = 1.5; // tiles: door end offset from east wall of meeting room

const ROOM_NAMES = ['Atlas', 'Nova', 'Orion', 'Vega', 'Lyra', 'Juno', 'Echo', 'Focus', 'Cedar', 'Maple', 'Pixel', 'Sol'];
const ROOM_SIZES = { big: { w: 13, table: 7 }, medium: { w: 11, table: 5 }, small: { w: 9, table: 4.2 } };

/** Desks for the team, with ~25% to grow (at least 4). */
function desksFor(teamSize: number) {
  return Math.max(4, Math.ceil(teamSize * 1.25));
}

/** One meeting room per ~10 people, up to 4. */
function meetingRoomsFor(teamSize: number) {
  return Math.min(4, Math.max(1, Math.ceil(teamSize / 10)));
}

/** Generates a complete office layout procedurally based on team size and a visual seed. */
export function generatedOffice(teamSize: number, seed: string): OfficeLayout {
  const team = Math.min(MAX_TEAM, Math.max(MIN_TEAM, Math.round(teamSize)));
  const rand = seededRandom(seed.trim().toLowerCase().replace(/\s+/g, ' '));
  const flip = rand() < 0.5;
  const b = new LayoutBuilder();

  // Sizes: meeting rooms, desk grid, then the building around them.
  const meetings = meetingRooms(team, rand);
  const clusters = Math.ceil(desksFor(team) / DESKS_PER_CLUSTER);
  const cols = Math.min(CLUSTERS_PER_ROW_MAX, Math.ceil(Math.sqrt(clusters)));
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
      { x1: x, y1: BAND, x2: x + m.w - MEETING_DOOR_LEFT_OFFSET, y2: BAND, kind: 'glass' },
      { x1: x + m.w - MEETING_DOOR_RIGHT_OFFSET, y1: BAND, x2: x + m.w, y2: BAND, kind: 'glass' },
    );
    x += m.w;
  });

  // Kitchen + lounge: fills the rest of the band, a second chill corner when it's long.
  const lounge = width - x;
  const counterW =
    team <= KITCHEN_TEAM_SMALL
      ? KITCHEN_COUNTER_W_SMALL
      : team <= KITCHEN_TEAM_MEDIUM
        ? KITCHEN_COUNTER_W_MEDIUM
        : KITCHEN_COUNTER_W_LARGE;
  b.kitchen(x + 1, counterW);
  b.barTable(x + 5, 6.5);
  b.chillCorner(width - 5.5, pick(SOFAS, rand));
  if (lounge >= TWO_CHILL_CORNERS_MIN_LOUNGE_W) b.chillCorner(width - 18, pick(SOFAS, rand));
  b.plant(x + 1.2, 10.8);
  b.plant(width - 1, 11);
  rooms.push({ id: 'lounge', name: 'Lounge', kind: 'lounge', x, y: 0, w: lounge, h: BAND, floor: 'terrazzo' });
  walls.push(
    { x1: x, y1: 0, x2: x, y2: BAND, kind: 'solid' },
    { x1: x, y1: BAND, x2: x + 3, y2: BAND, kind: 'solid' },
    { x1: x + 7, y1: BAND, x2: width - 10, y2: BAND, kind: 'solid' },
    { x1: width - 6, y1: BAND, x2: width, y2: BAND, kind: 'solid' },
  );

  // 2. Open space: desk clusters in a centred grid, sometimes a plant between them.
  rooms.push({ id: 'open', name: 'Open space', kind: 'open', x: 0, y: BAND, w: width, h: height - BAND, floor: 'oak' });
  b.wallBoard('board', (x + 7 + width - 10) / 2, BAND, 3, 0.5);
  const left = Math.round(width - (COL * (cols - 1) + CLUSTER_W)) / 2;
  for (let i = 0; i < clusters; i++) {
    const ox = left + (i % cols) * COL;
    const oy = FIRST_ROW + Math.floor(i / cols) * ROW;
    b.deskCluster(ox, oy);
    const nextInRow = i % cols < cols - 1 && i + 1 < clusters;
    if (nextInRow && i + cols < clusters && rand() < PLANT_BETWEEN_CLUSTERS_CHANCE) b.plant(ox + 10.5, oy + 6.25, 1.2);
  }
  b.plant(1, 13.9);
  b.plant(width - 1, 13.9);
  if (rows > 1 || rand() < 0.5) b.add({ kind: 'bookshelf', x: width - 0.6, y: FIRST_ROW + 3, w: 4, h: 0.8, rotation: 90 });

  // 3. Entrance, waiting area(s), a plant in the corners.
  b.waitingArea(6, height);
  if (width >= SECOND_WAITING_AREA_MIN_W) b.waitingArea(width - 7, height);
  else b.plant(width - 1, height - 1, 1.1);
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
