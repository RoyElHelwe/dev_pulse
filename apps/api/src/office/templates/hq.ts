// Headquarters template for very large teams (40-100 people).
// Features Atlas, Nova, Orion & Vega (meeting rooms), a dual-lounge relaxation area, and 100 desks.

import type { OfficeLayout } from '../layout/types';
import { LayoutBuilder } from './builder';

const WIDTH = 76;
const HEIGHT = 57;
const BAND_H = 12;
const MEDIUM_MEETING_W = 9;

/** Generates the HQ layout for very large teams: 4 meeting rooms, expansive lounge, and 100 desks. */
export function hq(): OfficeLayout {
  const b = new LayoutBuilder();
  b.meetingRoom(0, 13, 7);
  b.meetingRoom(13, MEDIUM_MEETING_W, 4.2);
  b.meetingRoom(22, MEDIUM_MEETING_W, 4.2);
  b.meetingRoom(31, MEDIUM_MEETING_W, 4.2);

  b.kitchen(41, 9);
  b.barTable(46, 6.5);
  b.chillCorner(58, 0x3d5a80);
  b.chillCorner(70.5);
  b.plant(41.2, 10.8);
  b.plant(64.3, 2.1, 1.1);
  b.plant(75.0, 10.9);

  for (const oy of [15.5, 23, 30.5, 38, 45.5]) for (const ox of [6, 20, 34, 48, 62]) b.deskCluster(ox, oy);
  b.wallBoard('board', 53.5, BAND_H, 3, 0.5);
  for (const y of [21.75, 29.25, 36.75, 44.25]) for (const x of [16.5, 30.5, 44.5, 58.5]) b.plant(x, y, 1.2);
  b.plant(1.0, 13.9);
  b.plant(75.0, 13.9);
  for (const y of [28, 42]) {
    b.add({ kind: 'bookshelf', x: 0.6, y, w: 5, h: 0.8, rotation: 270 });
    b.add({ kind: 'bookshelf', x: 75.4, y, w: 5, h: 0.8, rotation: 90 });
  }

  b.waitingArea(9, HEIGHT);
  b.waitingArea(67, HEIGHT);
  b.doormat(38, HEIGHT);

  return b.build({
    width: WIDTH,
    height: HEIGHT,
    rooms: [
      { id: 'atlas', name: 'Atlas', kind: 'meeting', x: 0, y: 0, w: 13, h: BAND_H, floor: 'carpet', color: 0x7d8796 },
      { id: 'nova', name: 'Nova', kind: 'meeting', x: 13, y: 0, w: MEDIUM_MEETING_W, h: BAND_H, floor: 'carpet', color: 0x8b8478 },
      { id: 'orion', name: 'Orion', kind: 'meeting', x: 22, y: 0, w: MEDIUM_MEETING_W, h: BAND_H, floor: 'carpet', color: 0x6f7f74 },
      { id: 'vega', name: 'Vega', kind: 'meeting', x: 31, y: 0, w: MEDIUM_MEETING_W, h: BAND_H, floor: 'carpet', color: 0x7b7489 },
      { id: 'lounge', name: 'Lounge', kind: 'lounge', x: 40, y: 0, w: 36, h: BAND_H, floor: 'terrazzo' },
      { id: 'open', name: 'Open space', kind: 'open', x: 0, y: BAND_H, w: WIDTH, h: 45, floor: 'oak' },
    ],
    walls: [
      { x1: 0, y1: 0, x2: WIDTH, y2: 0, kind: 'solid' },
      { x1: 0, y1: HEIGHT, x2: 36, y2: HEIGHT, kind: 'solid', face: false },
      { x1: 40, y1: HEIGHT, x2: WIDTH, y2: HEIGHT, kind: 'solid', face: false },
      { x1: 0, y1: 0, x2: 0, y2: HEIGHT, kind: 'solid' },
      { x1: WIDTH, y1: 0, x2: WIDTH, y2: HEIGHT, kind: 'solid' },
      { x1: 13, y1: 0, x2: 13, y2: BAND_H, kind: 'glass' },
      { x1: 22, y1: 0, x2: 22, y2: BAND_H, kind: 'glass' },
      { x1: 31, y1: 0, x2: 31, y2: BAND_H, kind: 'glass' },
      { x1: 0, y1: BAND_H, x2: 8.5, y2: BAND_H, kind: 'glass' },
      { x1: 11.5, y1: BAND_H, x2: 14, y2: BAND_H, kind: 'glass' },
      { x1: 17, y1: BAND_H, x2: 23, y2: BAND_H, kind: 'glass' },
      { x1: 26, y1: BAND_H, x2: 32, y2: BAND_H, kind: 'glass' },
      { x1: 35, y1: BAND_H, x2: 40, y2: BAND_H, kind: 'glass' },
      { x1: 40, y1: 0, x2: 40, y2: BAND_H, kind: 'solid' },
      { x1: 40, y1: BAND_H, x2: 43, y2: BAND_H, kind: 'solid' },
      { x1: 47, y1: BAND_H, x2: 60, y2: BAND_H, kind: 'solid' },
      { x1: 64, y1: BAND_H, x2: WIDTH, y2: BAND_H, kind: 'solid' },
    ],
    spawn: { x: 38, y: 54.5 },
  });
}
