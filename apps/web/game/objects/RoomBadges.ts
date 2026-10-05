import type * as Phaser from 'phaser';
import { TILE } from '../constants';
import type { OfficeLayout } from '../layout/types';
import { Bubble } from './Bubble';

/** "In use · 2" at the top of each meeting room with people inside. */
export class RoomBadges {
  private readonly badges = new Map<string, Bubble>();

  constructor(scene: Phaser.Scene, layout: OfficeLayout, o: { fontFamily: string; resolution: number; depth: number }) {
    for (const room of layout.rooms.filter((r) => r.kind === 'meeting')) {
      const badge = new Bubble(scene, (room.x + room.w / 2) * TILE, (room.y + 1.1) * TILE, '', {
        fontFamily: o.fontFamily,
        resolution: o.resolution,
        tone: 'dark',
        fontSize: 10,
      });
      this.badges.set(room.id, badge.setDepth(o.depth).setVisible(false));
    }
  }

  /** People per room id. */
  update(counts: Map<string, number>) {
    for (const [roomId, badge] of this.badges) {
      const n = counts.get(roomId) ?? 0;
      badge.setVisible(n > 0);
      if (n > 0) badge.setText(`● In use · ${n}`);
    }
  }
}
