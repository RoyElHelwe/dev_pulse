// Loft template for small teams (1-8 people).
// Features Focus (meeting room), Lounge (kitchen & bar), Chill room (games), and an Open space with 8 desks.

import type { OfficeLayout } from '../layout/types';
import { LayoutBuilder } from './builder';

const WIDTH = 32;
const HEIGHT = 28;
const BAND_H = 12;

/** Generates the Loft layout for small teams: 1 meeting room, kitchen, chill room, and 8 desks. */
export function loft(): OfficeLayout {
  const b = new LayoutBuilder();
  b.meetingRoom(0, 11, 5);

  b.kitchen(12, 4);
  b.barTable(16, 6.2);
  b.plant(12.0, 10.5);

  b.chillRoom(21, 0, 11, BAND_H);

  for (const ox of [4, 18]) b.deskCluster(ox, 15);
  b.wallBoard('board', 29, BAND_H, 3, 0.5);
  b.plant(1.0, 13.9);
  b.plant(31.0, 13.9);
  b.add({ kind: 'bookshelf', x: 31.4, y: 18, w: 4, h: 0.8, rotation: 90 });

  b.waitingArea(6, HEIGHT);
  b.doormat(17, HEIGHT);
  b.plant(31.0, 27.0, 1.1);

  return b.build({
    width: WIDTH,
    height: HEIGHT,
    rooms: [
      { id: 'focus', name: 'Focus', kind: 'meeting', x: 0, y: 0, w: 11, h: BAND_H, floor: 'carpet', color: 0x6f7f74 },
      { id: 'lounge', name: 'Lounge', kind: 'lounge', x: 11, y: 0, w: 10, h: BAND_H, floor: 'terrazzo' },
      { id: 'chill', name: 'Chill room', kind: 'chill', x: 21, y: 0, w: 11, h: BAND_H, floor: 'terrazzo' },
      { id: 'open', name: 'Open space', kind: 'open', x: 0, y: BAND_H, w: WIDTH, h: HEIGHT - BAND_H, floor: 'oak' },
    ],
    walls: [
      { x1: 0, y1: 0, x2: WIDTH, y2: 0, kind: 'solid' },
      { x1: 0, y1: HEIGHT, x2: 15, y2: HEIGHT, kind: 'solid', face: false },
      { x1: 19, y1: HEIGHT, x2: WIDTH, y2: HEIGHT, kind: 'solid', face: false },
      { x1: 0, y1: 0, x2: 0, y2: HEIGHT, kind: 'solid' },
      { x1: WIDTH, y1: 0, x2: WIDTH, y2: HEIGHT, kind: 'solid' },
      { x1: 11, y1: 0, x2: 11, y2: BAND_H, kind: 'glass' },
      { x1: 21, y1: 0, x2: 21, y2: BAND_H, kind: 'glass' },
      { x1: 0, y1: BAND_H, x2: 6.5, y2: BAND_H, kind: 'glass' },
      { x1: 9.5, y1: BAND_H, x2: 11, y2: BAND_H, kind: 'glass' },
      { x1: 11, y1: BAND_H, x2: 14, y2: BAND_H, kind: 'solid' },
      { x1: 18, y1: BAND_H, x2: 22, y2: BAND_H, kind: 'solid' },
      { x1: 26, y1: BAND_H, x2: WIDTH, y2: BAND_H, kind: 'solid' },
    ],
    spawn: { x: 17, y: 25.5 },
  });
}
