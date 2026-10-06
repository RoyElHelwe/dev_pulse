import { LayoutBuilder } from './builder';

/** Medium team: two glass meeting rooms, a kitchen + lounge, 24 desks. */
export function studio() {
  const b = new LayoutBuilder();
  b.meetingRoom(0, 13, 7);
  b.add({ kind: 'plant', x: 12.0, y: 10.9, w: 1, h: 1 });
  b.meetingRoom(13, 9, 4.2);

  b.kitchen(23, 8);
  b.add({ kind: 'plant', x: 33.6, y: 2.1, w: 1.1, h: 1.1 });
  b.barTable(27, 6.5);
  b.chillCorner(39.5);
  b.add({ kind: 'floorLamp', x: 44.9, y: 2.4, w: 1, h: 1 });
  b.add({ kind: 'plant', x: 23.2, y: 10.8, w: 1, h: 1 });
  b.add({ kind: 'plant', x: 45.0, y: 11.0, w: 1, h: 1 });

  for (const oy of [15.5, 23]) for (const ox of [5, 20, 35]) b.deskCluster(ox, oy);
  b.add({ kind: 'board', x: 32, y: 12.75, w: 3, h: 0.5 });
  b.add({ kind: 'plant', x: 15.5, y: 21.75, w: 1.2, h: 1.2 });
  b.add({ kind: 'plant', x: 30.5, y: 21.75, w: 1.2, h: 1.2 });
  b.add({ kind: 'plant', x: 1.0, y: 13.9, w: 1, h: 1 });
  b.add({ kind: 'plant', x: 45.0, y: 13.9, w: 1, h: 1 });
  b.add({ kind: 'bookshelf', x: 0.6, y: 22, w: 5, h: 0.8, rotation: 270 });
  b.add({ kind: 'bookshelf', x: 45.4, y: 22, w: 5, h: 0.8, rotation: 90 });

  b.waitingArea(6, 34);
  b.add({ kind: 'floorLamp', x: 1.0, y: 33.0, w: 1, h: 1 });
  b.doormat(23, 34);
  b.add({ kind: 'plant', x: 45.0, y: 33.0, w: 1.1, h: 1.1 });

  return b.build({
    width: 46,
    height: 34,
    rooms: [
      { id: 'atlas', name: 'Atlas', kind: 'meeting', x: 0, y: 0, w: 13, h: 12, floor: 'carpet', color: 0x7d8796 },
      { id: 'nova', name: 'Nova', kind: 'meeting', x: 13, y: 0, w: 9, h: 12, floor: 'carpet', color: 0x8b8478 },
      { id: 'lounge', name: 'Lounge', kind: 'lounge', x: 22, y: 0, w: 24, h: 12, floor: 'terrazzo' },
      { id: 'open', name: 'Open space', kind: 'open', x: 0, y: 12, w: 46, h: 22, floor: 'oak' },
    ],
    walls: [
      { x1: 0, y1: 0, x2: 46, y2: 0, kind: 'solid' },
      { x1: 0, y1: 34, x2: 21, y2: 34, kind: 'solid', face: false },
      { x1: 25, y1: 34, x2: 46, y2: 34, kind: 'solid', face: false },
      { x1: 0, y1: 0, x2: 0, y2: 34, kind: 'solid' },
      { x1: 46, y1: 0, x2: 46, y2: 34, kind: 'solid' },
      { x1: 13, y1: 0, x2: 13, y2: 12, kind: 'glass' },
      { x1: 0, y1: 12, x2: 8.5, y2: 12, kind: 'glass' },
      { x1: 11.5, y1: 12, x2: 13, y2: 12, kind: 'glass' },
      { x1: 13, y1: 12, x2: 14, y2: 12, kind: 'glass' },
      { x1: 17, y1: 12, x2: 22, y2: 12, kind: 'glass' },
      { x1: 22, y1: 0, x2: 22, y2: 12, kind: 'solid' },
      { x1: 22, y1: 12, x2: 25, y2: 12, kind: 'solid' },
      { x1: 29, y1: 12, x2: 35, y2: 12, kind: 'solid' },
      { x1: 38, y1: 12, x2: 46, y2: 12, kind: 'solid' },
    ],
    spawn: { x: 23, y: 31.5 },
  });
}
