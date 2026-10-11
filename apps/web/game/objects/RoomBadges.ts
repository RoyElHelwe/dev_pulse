/**
 * Room status badges displayed above meeting rooms.
 * Renders occupancy counts and calendar booking schedule indicators.
 */

import type * as Phaser from 'phaser';
import { TILE } from '../constants';
import type { OfficeLayout } from '../layout/types';
import { Bubble } from './Bubble';

const BADGE_Y_OFFSET_TILES = 1.1;
const BADGE_FONT_SIZE_PX = 10;

/** A meeting room booked right now, until `until` ("15:00", already in local time). */
export interface RoomBooking {
  roomId: string;
  until: string;
}

/** At the top of each meeting room: "Booked · until 15:00", or "In use · 2" with people inside. */
export class RoomBadges {
  private readonly badges = new Map<string, Bubble>();
  private counts = new Map<string, number>();
  private booked = new Map<string, string>();

  constructor(scene: Phaser.Scene, layout: OfficeLayout, o: { fontFamily: string; resolution: number; depth: number }) {
    for (const room of layout.rooms.filter((r) => r.kind === 'meeting')) {
      const badge = new Bubble(scene, (room.x + room.w / 2) * TILE, (room.y + BADGE_Y_OFFSET_TILES) * TILE, '', {
        fontFamily: o.fontFamily,
        resolution: o.resolution,
        tone: 'dark',
        fontSize: BADGE_FONT_SIZE_PX,
      });
      this.badges.set(room.id, badge.setDepth(o.depth).setVisible(false));
    }
  }

  /** People per room id. */
  update(counts: Map<string, number>) {
    this.counts = counts;
    this.render();
  }

  /** Rooms booked right now. */
  setBookings(bookings: RoomBooking[]) {
    this.booked = new Map(bookings.map((b) => [b.roomId, b.until]));
    this.render();
  }

  private render() {
    for (const [roomId, badge] of this.badges) {
      const n = this.counts.get(roomId) ?? 0;
      const until = this.booked.get(roomId);
      badge.setVisible(n > 0 || !!until);
      if (until) badge.setText(`● Booked · until ${until}${n > 0 ? ` · ${n}` : ''}`);
      else if (n > 0) badge.setText(`● In use · ${n}`);
    }
  }
}
