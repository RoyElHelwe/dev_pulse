// Studio template for medium teams (6-24 people).
// Features Atlas & Nova (glass meeting rooms), Lounge (kitchen & bar), and an Open space with 24 desks.

import type { OfficeLayout } from '../layout/types';
import { LayoutBuilder } from './builder';

const WIDTH = 46;
const HEIGHT = 34;
const BAND_H = 12;

/** Generates the Studio layout for medium teams: 2 meeting rooms, lounge, and 24 desks. */
export function studio(): OfficeLayout {
  const b = new LayoutBuilder();
  b.meetingRoom(0, 13, 7);
  b.plant(12.0, 10.9);
  b.meetingRoom(13, 9, 4.2);

  b.kitchen(23, 8);
  b.plant(33.6, 2.1, 1.1);
  b.barTable(27, 6.5);
  b.chillCorner(39.5);
  b.add({ kind: 'floorLamp', x: 44.9, y: 2.4, w: 1, h: 1 });
  b.plant(23.2, 10.8);
  b.plant(45.0, 11.0);

  for (const oy of [15.5, 23]) for (const ox of [5, 20, 35]) b.deskCluster(ox, oy);
  b.wallBoard('board', 32, BAND_H, 3, 0.5);
  b.plant(15.5, 21.75, 1.2);
  b.plant(30.5, 21.75, 1.2);
  b.plant(1.0, 13.9);
  b.plant(45.0, 13.9);
  b.add({ kind: 'bookshelf', x: 0.6, y: 22, w: 5, h: 0.8, rotation: 270 });
  b.add({ kind: 'bookshelf', x: 45.4, y: 22, w: 5, h: 0.8, rotation: 90 });

  b.waitingArea(6, HEIGHT);
  b.add({ kind: 'floorLamp', x: 1.0, y: 33.0, w: 1, h: 1 });
  b.doormat(23, HEIGHT);
  b.plant(45.0, 33.0, 1.1);

  return b.build({
    width: WIDTH,
    height: HEIGHT,
    rooms: [
      { id: 'atlas', name: 'Atlas', kind: 'meeting', x: 0, y: 0, w: 13, h: BAND_H, floor: 'carpet', color: 0x7d8796 },
      { id: 'nova', name: 'Nova', kind: 'meeting', x: 13, y: 0, w: 9, h: BAND_H, floor: 'carpet', color: 0x8b8478 },
      { id: 'lounge', name: 'Lounge', kind: 'lounge', x: 22, y: 0, w: 24, h: BAND_H, floor: 'terrazzo' },
      { id: 'open', name: 'Open space', kind: 'open', x: 0, y: BAND_H, w: WIDTH, h: HEIGHT - BAND_H, floor: 'oak' },
    ],
    walls: [
      { x1: 0, y1: 0, x2: WIDTH, y2: 0, kind: 'solid' },
      { x1: 0, y1: HEIGHT, x2: 21, y2: HEIGHT, kind: 'solid', face: false },
      { x1: 25, y1: HEIGHT, x2: WIDTH, y2: HEIGHT, kind: 'solid', face: false },
      { x1: 0, y1: 0, x2: 0, y2: HEIGHT, kind: 'solid' },
      { x1: WIDTH, y1: 0, x2: WIDTH, y2: HEIGHT, kind: 'solid' },
      { x1: 13, y1: 0, x2: 13, y2: BAND_H, kind: 'glass' },
      { x1: 0, y1: BAND_H, x2: 8.5, y2: BAND_H, kind: 'glass' },
      { x1: 11.5, y1: BAND_H, x2: 13, y2: BAND_H, kind: 'glass' },
      { x1: 13, y1: BAND_H, x2: 14, y2: BAND_H, kind: 'glass' },
      { x1: 17, y1: BAND_H, x2: 22, y2: BAND_H, kind: 'glass' },
      { x1: 22, y1: 0, x2: 22, y2: BAND_H, kind: 'solid' },
      { x1: 22, y1: BAND_H, x2: 25, y2: BAND_H, kind: 'solid' },
      { x1: 29, y1: BAND_H, x2: 35, y2: BAND_H, kind: 'solid' },
      { x1: 38, y1: BAND_H, x2: WIDTH, y2: BAND_H, kind: 'solid' },
    ],
    spawn: { x: 23, y: 31.5 },
  });
}
