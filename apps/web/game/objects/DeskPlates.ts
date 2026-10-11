/**
 * Workstation desk nameplates.
 * Displays owner labels on desks, highlighted for the local user.
 */

import type * as Phaser from 'phaser';
import { TILE } from '../constants';
import { numberedDesks, seatPoint } from '../layout/geometry';
import type { OfficeLayout } from '../layout/types';
import { Bubble } from './Bubble';

const DESK_EDGE_INSET_TILES = 0.22;
const SEAT_DISTANCE_TILES = 0.45;
const PLATE_Y_OFFSET_PX = 7;
const PLATE_FONT_SIZE_PX = 9;
const PLATE_ALPHA = 0.92;
const MAX_PLATE_NAME_LENGTH = 14;

/** Who owns a desk (from the API). */
export interface DeskOwner {
  deskId: string;
  userId: string;
  name: string;
  /** Their character: the desk decorates itself for them. */
  character?: string;
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
        const k = (desk.h / 2 - DESK_EDGE_INSET_TILES) / (desk.h / 2 + SEAT_DISTANCE_TILES);
        return [desk.id, { x: desk.x + (seat.x - desk.x) * k, y: desk.y + (seat.y - desk.y) * k }];
      }),
    );
  }

  /** Updates desk ownership nameplates across all assigned workstations. */
  set(owners: DeskOwner[]) {
    this.plates.forEach((p) => p.destroy());
    this.plates = owners.flatMap((owner) => {
      const at = this.desks.get(owner.deskId);
      if (!at) return [];
      const mine = owner.userId === this.o.myId;
      const plate = new Bubble(this.scene, at.x * TILE, at.y * TILE + PLATE_Y_OFFSET_PX, firstName(owner.name), {
        fontFamily: this.o.fontFamily,
        resolution: this.o.resolution,
        tone: mine ? 'accent' : 'dark',
        fontSize: PLATE_FONT_SIZE_PX,
      });
      return [plate.setDepth(this.o.depth).setAlpha(PLATE_ALPHA)];
    });
  }

  /** Hidden while editing: desks move, plates would float. */
  setVisible(visible: boolean) {
    this.plates.forEach((p) => p.setVisible(visible));
  }

  /** Cleans up and destroys all active desk plate bubbles. */
  destroy() {
    this.plates.forEach((p) => p.destroy());
    this.plates = [];
  }
}

const firstName = (name: string) =>
  name.length > MAX_PLATE_NAME_LENGTH ? `${name.split(' ')[0].slice(0, MAX_PLATE_NAME_LENGTH)}` : name;
