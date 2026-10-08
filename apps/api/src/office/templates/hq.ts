import { LayoutBuilder } from './builder';

/** Very large team: four meeting rooms, a long lounge with two chill corners, 100 desks. */
export function hq() {
  const b = new LayoutBuilder();
  b.meetingRoom(0, 13, 7);
  b.meetingRoom(13, 9, 4.2);
  b.meetingRoom(22, 9, 4.2);
  b.meetingRoom(31, 9, 4.2);

  b.kitchen(41, 9);
  b.barTable(46, 6.5);
  b.chillCorner(58, 0x3d5a80);
  b.chillCorner(70.5);
  b.add({ kind: 'plant', x: 41.2, y: 10.8, w: 1, h: 1 });
  b.add({ kind: 'plant', x: 64.3, y: 2.1, w: 1.1, h: 1.1 });
  b.add({ kind: 'plant', x: 75.0, y: 10.9, w: 1, h: 1 });

  for (const oy of [15.5, 23, 30.5, 38, 45.5]) for (const ox of [6, 20, 34, 48, 62]) b.deskCluster(ox, oy);
  b.wallBoard('board', 53.5, 12, 3, 0.5);
  for (const y of [21.75, 29.25, 36.75, 44.25]) for (const x of [16.5, 30.5, 44.5, 58.5]) b.add({ kind: 'plant', x, y, w: 1.2, h: 1.2 });
  b.add({ kind: 'plant', x: 1.0, y: 13.9, w: 1, h: 1 });
  b.add({ kind: 'plant', x: 75.0, y: 13.9, w: 1, h: 1 });
  for (const y of [28, 42]) {
    b.add({ kind: 'bookshelf', x: 0.6, y, w: 5, h: 0.8, rotation: 270 });
    b.add({ kind: 'bookshelf', x: 75.4, y, w: 5, h: 0.8, rotation: 90 });
  }

  b.waitingArea(9, 57);
  b.waitingArea(67, 57);
  b.doormat(38, 57);

  return b.build({
    width: 76,
    height: 57,
    rooms: [
      { id: 'atlas', name: 'Atlas', kind: 'meeting', x: 0, y: 0, w: 13, h: 12, floor: 'carpet', color: 0x7d8796 },
      { id: 'nova', name: 'Nova', kind: 'meeting', x: 13, y: 0, w: 9, h: 12, floor: 'carpet', color: 0x8b8478 },
      { id: 'orion', name: 'Orion', kind: 'meeting', x: 22, y: 0, w: 9, h: 12, floor: 'carpet', color: 0x6f7f74 },
      { id: 'vega', name: 'Vega', kind: 'meeting', x: 31, y: 0, w: 9, h: 12, floor: 'carpet', color: 0x7b7489 },
      { id: 'lounge', name: 'Lounge', kind: 'lounge', x: 40, y: 0, w: 36, h: 12, floor: 'terrazzo' },
      { id: 'open', name: 'Open space', kind: 'open', x: 0, y: 12, w: 76, h: 45, floor: 'oak' },
    ],
    walls: [
      { x1: 0, y1: 0, x2: 76, y2: 0, kind: 'solid' },
      { x1: 0, y1: 57, x2: 36, y2: 57, kind: 'solid', face: false },
      { x1: 40, y1: 57, x2: 76, y2: 57, kind: 'solid', face: false },
      { x1: 0, y1: 0, x2: 0, y2: 57, kind: 'solid' },
      { x1: 76, y1: 0, x2: 76, y2: 57, kind: 'solid' },
      { x1: 13, y1: 0, x2: 13, y2: 12, kind: 'glass' },
      { x1: 22, y1: 0, x2: 22, y2: 12, kind: 'glass' },
      { x1: 31, y1: 0, x2: 31, y2: 12, kind: 'glass' },
      { x1: 0, y1: 12, x2: 8.5, y2: 12, kind: 'glass' },
      { x1: 11.5, y1: 12, x2: 14, y2: 12, kind: 'glass' },
      { x1: 17, y1: 12, x2: 23, y2: 12, kind: 'glass' },
      { x1: 26, y1: 12, x2: 32, y2: 12, kind: 'glass' },
      { x1: 35, y1: 12, x2: 40, y2: 12, kind: 'glass' },
      { x1: 40, y1: 0, x2: 40, y2: 12, kind: 'solid' },
      { x1: 40, y1: 12, x2: 43, y2: 12, kind: 'solid' },
      { x1: 47, y1: 12, x2: 60, y2: 12, kind: 'solid' },
      { x1: 64, y1: 12, x2: 76, y2: 12, kind: 'solid' },
    ],
    spawn: { x: 38, y: 54.5 },
  });
}
