import { LayoutBuilder } from './builder';

/** Small team: one meeting room, a kitchen + lounge, 8 desks. */
export function loft() {
  const b = new LayoutBuilder();
  b.meetingRoom(0, 11, 5);

  b.kitchen(12, 4);
  b.barTable(16, 6.2);
  b.add({ kind: 'plant', x: 12.0, y: 10.5, w: 1, h: 1 });

  b.chillRoom(21, 0, 11, 12);

  for (const ox of [4, 18]) b.deskCluster(ox, 15);
  b.add({ kind: 'board', x: 29, y: 12.75, w: 3, h: 0.5 });
  b.add({ kind: 'plant', x: 1.0, y: 13.9, w: 1, h: 1 });
  b.add({ kind: 'plant', x: 31.0, y: 13.9, w: 1, h: 1 });
  b.add({ kind: 'bookshelf', x: 31.4, y: 18, w: 4, h: 0.8, rotation: 90 });

  b.waitingArea(6, 28);
  b.doormat(17, 28);
  b.add({ kind: 'plant', x: 31.0, y: 27.0, w: 1.1, h: 1.1 });

  return b.build({
    width: 32,
    height: 28,
    rooms: [
      { id: 'focus', name: 'Focus', kind: 'meeting', x: 0, y: 0, w: 11, h: 12, floor: 'carpet', color: 0x6f7f74 },
      { id: 'lounge', name: 'Lounge', kind: 'lounge', x: 11, y: 0, w: 10, h: 12, floor: 'terrazzo' },
      { id: 'chill', name: 'Chill room', kind: 'chill', x: 21, y: 0, w: 11, h: 12, floor: 'terrazzo' },
      { id: 'open', name: 'Open space', kind: 'open', x: 0, y: 12, w: 32, h: 16, floor: 'oak' },
    ],
    walls: [
      { x1: 0, y1: 0, x2: 32, y2: 0, kind: 'solid' },
      { x1: 0, y1: 28, x2: 15, y2: 28, kind: 'solid', face: false },
      { x1: 19, y1: 28, x2: 32, y2: 28, kind: 'solid', face: false },
      { x1: 0, y1: 0, x2: 0, y2: 28, kind: 'solid' },
      { x1: 32, y1: 0, x2: 32, y2: 28, kind: 'solid' },
      { x1: 11, y1: 0, x2: 11, y2: 12, kind: 'glass' },
      { x1: 21, y1: 0, x2: 21, y2: 12, kind: 'glass' },
      { x1: 0, y1: 12, x2: 6.5, y2: 12, kind: 'glass' },
      { x1: 9.5, y1: 12, x2: 11, y2: 12, kind: 'glass' },
      { x1: 11, y1: 12, x2: 14, y2: 12, kind: 'solid' },
      { x1: 18, y1: 12, x2: 22, y2: 12, kind: 'solid' },
      { x1: 26, y1: 12, x2: 32, y2: 12, kind: 'solid' },
    ],
    spawn: { x: 17, y: 25.5 },
  });
}
