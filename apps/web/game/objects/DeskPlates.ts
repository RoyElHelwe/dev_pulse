import type * as Phaser from 'phaser';
import { TILE } from '../constants';
import { numberedDesks, seatPoint } from '../layout/derive';
import type { OfficeLayout } from '../layout/types';
import { Bubble } from './Bubble';

/** Who owns a desk (from the API). */
export interface DeskOwner {
  deskId: string;
  userId: string;
  name: string;
}

/** Name plates on the front edge of each owned desk (yours in green). */
export class DeskPlates {
  private plates: Bubble[] = [];
  private readonly desks: Map<string, { x: number; y: number }>;

  constructor(
    private readonly scene: Phaser.Scene,
    layout: OfficeLayout,
    private readonly o: { fontFamily: string; resolution: number; myId: string; depth: number },
  ) {
    this.desks = new Map(
      numberedDesks(layout).map(({ desk }) => {
        const seat = seatPoint(desk);
        // Just inside the desk, on the side the person sits.
        const k = (desk.h / 2 - 0.22) / (desk.h / 2 + 0.45);
        return [desk.id, { x: desk.x + (seat.x - desk.x) * k, y: desk.y + (seat.y - desk.y) * k }];
      }),
    );
  }

  set(owners: DeskOwner[]) {
    this.plates.forEach((p) => p.destroy());
    this.plates = owners.flatMap((owner) => {
      const at = this.desks.get(owner.deskId);
      if (!at) return [];
      const mine = owner.userId === this.o.myId;
      const plate = new Bubble(this.scene, at.x * TILE, at.y * TILE + 7, firstName(owner.name), {
        fontFamily: this.o.fontFamily,
        resolution: this.o.resolution,
        tone: mine ? 'accent' : 'dark',
        fontSize: 9,
      });
      return [plate.setDepth(this.o.depth).setAlpha(0.92)];
    });
  }

  destroy() {
    this.plates.forEach((p) => p.destroy());
    this.plates = [];
  }
}

const firstName = (name: string) => (name.length > 14 ? `${name.split(' ')[0].slice(0, 14)}` : name);
