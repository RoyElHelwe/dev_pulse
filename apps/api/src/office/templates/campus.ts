import { LayoutBuilder } from './builder';

/** Large team: three meeting rooms, a big kitchen + lounge, 48 desks. */
export function campus() {
  const b = new LayoutBuilder();
  b.meetingRoom(0, 13, 7);
  b.meetingRoom(13, 9, 4.2);
  b.meetingRoom(22, 9, 4.2);

  b.kitchen(32, 9);
  b.add({ kind: 'plant', x: 44.0, y: 2.1, w: 1.1, h: 1.1 });
  b.barTable(37, 6.5);
  b.chillCorner(51.5, 0x3d5a80);
  b.add({ kind: 'floorLamp', x: 58.9, y: 2.4, w: 1, h: 1 });
  b.add({ kind: 'plant', x: 32.2, y: 10.8, w: 1, h: 1 });
  b.add({ kind: 'plant', x: 59.0, y: 11.0, w: 1, h: 1 });

  for (const oy of [15.5, 23, 30.5]) for (const ox of [5, 19, 33, 47]) b.deskCluster(ox, oy);
  b.wallBoard('board', 42.5, 12, 3, 0.5);
  for (const y of [21.75, 29.25]) for (const x of [15.5, 29.5, 43.5]) b.add({ kind: 'plant', x, y, w: 1.2, h: 1.2 });
  b.add({ kind: 'plant', x: 1.0, y: 13.9, w: 1, h: 1 });
  b.add({ kind: 'plant', x: 59.0, y: 13.9, w: 1, h: 1 });
  b.add({ kind: 'bookshelf', x: 0.6, y: 26, w: 5, h: 0.8, rotation: 270 });
  b.add({ kind: 'bookshelf', x: 59.4, y: 26, w: 5, h: 0.8, rotation: 90 });

  b.waitingArea(7, 42);
  b.waitingArea(53, 42);
  b.doormat(30, 42);

  return b.build({
    width: 60,
    height: 42,
    rooms: [
      { id: 'atlas', name: 'Atlas', kind: 'meeting', x: 0, y: 0, w: 13, h: 12, floor: 'carpet', color: 0x7d8796 },
      { id: 'nova', name: 'Nova', kind: 'meeting', x: 13, y: 0, w: 9, h: 12, floor: 'carpet', color: 0x8b8478 },
      { id: 'orion', name: 'Orion', kind: 'meeting', x: 22, y: 0, w: 9, h: 12, floor: 'carpet', color: 0x6f7f74 },
      { id: 'lounge', name: 'Lounge', kind: 'lounge', x: 31, y: 0, w: 29, h: 12, floor: 'terrazzo' },
      { id: 'open', name: 'Open space', kind: 'open', x: 0, y: 12, w: 60, h: 30, floor: 'oak' },
    ],
    walls: [
      { x1: 0, y1: 0, x2: 60, y2: 0, kind: 'solid' },
      { x1: 0, y1: 42, x2: 28, y2: 42, kind: 'solid', face: false },
      { x1: 32, y1: 42, x2: 60, y2: 42, kind: 'solid', face: false },
      { x1: 0, y1: 0, x2: 0, y2: 42, kind: 'solid' },
      { x1: 60, y1: 0, x2: 60, y2: 42, kind: 'solid' },
      { x1: 13, y1: 0, x2: 13, y2: 12, kind: 'glass' },
      { x1: 22, y1: 0, x2: 22, y2: 12, kind: 'glass' },
      { x1: 0, y1: 12, x2: 8.5, y2: 12, kind: 'glass' },
      { x1: 11.5, y1: 12, x2: 14, y2: 12, kind: 'glass' },
      { x1: 17, y1: 12, x2: 23, y2: 12, kind: 'glass' },
      { x1: 26, y1: 12, x2: 31, y2: 12, kind: 'glass' },
      { x1: 31, y1: 0, x2: 31, y2: 12, kind: 'solid' },
      { x1: 31, y1: 12, x2: 34, y2: 12, kind: 'solid' },
      { x1: 38, y1: 12, x2: 47, y2: 12, kind: 'solid' },
      { x1: 51, y1: 12, x2: 60, y2: 12, kind: 'solid' },
    ],
    spawn: { x: 30, y: 39.5 },
  });
}
