import type * as Phaser from 'phaser';
import { TILE } from '../constants';
import type { Room } from '../layout/types';
import { seededRandom, shade } from './draw';

type G = Phaser.GameObjects.Graphics;

export function drawFloor(g: G, room: Room) {
  const x = room.x * TILE;
  const y = room.y * TILE;
  const w = room.w * TILE;
  const h = room.h * TILE;
  const random = seededRandom(room.id);

  switch (room.floor) {
    case 'oak': {
      // Staggered planks with slightly different tones, like real wood.
      const base = 0xdcc29e;
      const plankH = 12;
      g.fillStyle(base, 1);
      g.fillRect(x, y, w, h);
      for (let py = y; py < y + h; py += plankH) {
        let px = x - random() * 120;
        while (px < x + w) {
          const len = 90 + random() * 110;
          const left = Math.max(px, x);
          const right = Math.min(px + len, x + w);
          g.fillStyle(shade(base, (random() - 0.5) * 0.1), 1);
          g.fillRect(left, py, right - left, plankH - 1);
          px += len;
        }
        g.fillStyle(0xb99a72, 0.35);
        g.fillRect(x, py + plankH - 1, w, 1);
      }
      break;
    }
    case 'carpet': {
      // Carpet tiles, slightly rotated tones, subtle seams.
      const base = room.color ?? 0x7d8796;
      g.fillStyle(base, 1);
      g.fillRect(x, y, w, h);
      const size = TILE * 2;
      for (let ty = y; ty < y + h; ty += size) {
        for (let tx = x; tx < x + w; tx += size) {
          g.fillStyle(shade(base, (random() - 0.5) * 0.06), 1);
          g.fillRect(tx, ty, Math.min(size, x + w - tx), Math.min(size, y + h - ty));
        }
      }
      g.fillStyle(0x000000, 0.05);
      for (let ty = y; ty < y + h; ty += size) g.fillRect(x, ty, w, 1);
      for (let tx = x; tx < x + w; tx += size) g.fillRect(tx, y, 1, h);
      break;
    }
    case 'terrazzo': {
      const base = 0xebe6de;
      g.fillStyle(base, 1);
      g.fillRect(x, y, w, h);
      const chips = [0xb9b1a6, 0xd3a58b, 0x9fb3a9, 0x8f8a84, 0xffffff];
      const count = Math.round((w * h) / 260);
      for (let i = 0; i < count; i++) {
        g.fillStyle(chips[i % chips.length], 0.55);
        const s = 1.5 + random() * 2.5;
        g.fillRect(x + random() * (w - s), y + random() * (h - s), s, s * (0.6 + random() * 0.6));
      }
      break;
    }
  }
}
