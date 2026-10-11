// Campus template for large teams (20-48 people).
// Features Atlas, Nova & Orion (meeting rooms), a spacious Lounge, and an Open space with 48 desks.

import type { OfficeLayout } from '../layout/types';
import { LayoutBuilder } from './builder';

const WIDTH = 60;
const HEIGHT = 42;
const BAND_H = 12;

/** Generates the Campus layout for large teams: 3 meeting rooms, large lounge, and 48 desks. */
export function campus(): OfficeLayout {
  const b = new LayoutBuilder();
  b.meetingRoom(0, 13, 7);
  b.meetingRoom(13, 9, 4.2);
  b.meetingRoom(22, 9, 4.2);

  b.kitchen(32, 9);
  b.plant(44.0, 2.1, 1.1);
  b.barTable(37, 6.5);
  b.chillCorner(51.5, 0x3d5a80);
  b.add({ kind: 'floorLamp', x: 58.9, y: 2.4, w: 1, h: 1 });
  b.plant(32.2, 10.8);
  b.plant(59.0, 11.0);

  for (const oy of [15.5, 23, 30.5]) for (const ox of [5, 19, 33, 47]) b.deskCluster(ox, oy);
  b.wallBoard('board', 42.5, BAND_H, 3, 0.5);
  for (const y of [21.75, 29.25]) for (const x of [15.5, 29.5, 43.5]) b.plant(x, y, 1.2);
  b.plant(1.0, 13.9);
  b.plant(59.0, 13.9);
  b.add({ kind: 'bookshelf', x: 0.6, y: 26, w: 5, h: 0.8, rotation: 270 });
  b.add({ kind: 'bookshelf', x: 59.4, y: 26, w: 5, h: 0.8, rotation: 90 });

  b.waitingArea(7, HEIGHT);
  b.waitingArea(53, HEIGHT);
  b.doormat(30, HEIGHT);

  return b.build({
    width: WIDTH,
    height: HEIGHT,
    rooms: [
      { id: 'atlas', name: 'Atlas', kind: 'meeting', x: 0, y: 0, w: 13, h: BAND_H, floor: 'carpet', color: 0x7d8796 },
      { id: 'nova', name: 'Nova', kind: 'meeting', x: 13, y: 0, w: 9, h: BAND_H, floor: 'carpet', color: 0x8b8478 },
      { id: 'orion', name: 'Orion', kind: 'meeting', x: 22, y: 0, w: 9, h: BAND_H, floor: 'carpet', color: 0x6f7f74 },
      { id: 'lounge', name: 'Lounge', kind: 'lounge', x: 31, y: 0, w: 29, h: BAND_H, floor: 'terrazzo' },
      { id: 'open', name: 'Open space', kind: 'open', x: 0, y: BAND_H, w: WIDTH, h: HEIGHT - BAND_H, floor: 'oak' },
    ],
    walls: [
      { x1: 0, y1: 0, x2: WIDTH, y2: 0, kind: 'solid' },
      { x1: 0, y1: HEIGHT, x2: 28, y2: HEIGHT, kind: 'solid', face: false },
      { x1: 32, y1: HEIGHT, x2: WIDTH, y2: HEIGHT, kind: 'solid', face: false },
      { x1: 0, y1: 0, x2: 0, y2: HEIGHT, kind: 'solid' },
      { x1: WIDTH, y1: 0, x2: WIDTH, y2: HEIGHT, kind: 'solid' },
      { x1: 13, y1: 0, x2: 13, y2: BAND_H, kind: 'glass' },
      { x1: 22, y1: 0, x2: 22, y2: BAND_H, kind: 'glass' },
      { x1: 0, y1: BAND_H, x2: 8.5, y2: BAND_H, kind: 'glass' },
      { x1: 11.5, y1: BAND_H, x2: 14, y2: BAND_H, kind: 'glass' },
      { x1: 17, y1: BAND_H, x2: 23, y2: BAND_H, kind: 'glass' },
      { x1: 26, y1: BAND_H, x2: 31, y2: BAND_H, kind: 'glass' },
      { x1: 31, y1: 0, x2: 31, y2: BAND_H, kind: 'solid' },
      { x1: 31, y1: BAND_H, x2: 34, y2: BAND_H, kind: 'solid' },
      { x1: 38, y1: BAND_H, x2: 47, y2: BAND_H, kind: 'solid' },
      { x1: 51, y1: BAND_H, x2: WIDTH, y2: BAND_H, kind: 'solid' },
    ],
    spawn: { x: 30, y: 39.5 },
  });
}
