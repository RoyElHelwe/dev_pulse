/**
 * Interactive prop and furniture trigger system.
 * Manages interaction areas, prompt bubbles, and action dispatches for desks, boards, and games.
 */

import type * as Phaser from 'phaser';
import { officeEvents } from '@/features/office/events';
import { TILE } from '../constants';
import { deriveZones } from '../layout/derive';
import { itemBounds, numberedDesks, type Rect, seatPoint } from '../layout/geometry';
import type { OfficeLayout } from '../layout/types';
import { Bubble } from '../objects/Bubble';
import type { DeskOwner } from '../objects/DeskPlates';

// Anchor & trigger offsets in tiles and pixels
const DESK_SEAT_DY_THRESHOLD = 0.1;
const DESK_ANCHOR_Y_AWAY_PX = 2;
const DESK_ANCHOR_Y_NEAR_PX = 26;
const DESK_ANCHOR_Y_DEFAULT_PX = 12;

const BADGE_ANCHOR_OFFSET_Y_PX = 6;

const TV_SPOT_OFFSET_Y_TILES = 1.2;
const TV_TRIGGER_MARGIN_X_TILES = 0.5;
const TV_TRIGGER_EXTRA_W_TILES = 1;
const TV_TRIGGER_HEIGHT_TILES = 2.6;

const BOARD_SPOT_OFFSET_Y_TILES = 1.2;
const BOARD_TRIGGER_MARGIN_X_TILES = 0.5;
const BOARD_TRIGGER_EXTRA_W_TILES = 1;
const BOARD_TRIGGER_EXTRA_H_TILES = 2.4;

const TABLE_GAME_TRIGGER_MARGIN_TILES = 1.2;
const TABLE_GAME_TRIGGER_EXTRA_TILES = 2.4;

const LEGO_SPOT_OFFSET_Y_TILES = 1.2;
const LEGO_TRIGGER_MARGIN_X_TILES = 0.5;
const LEGO_TRIGGER_EXTRA_W_TILES = 1;
const LEGO_TRIGGER_EXTRA_H_TILES = 2.4;

/** The kitchen café opens from around its fridge and counter (the server accepts purchases within 2.5 tiles). */
const KITCHEN_TRIGGER_MARGIN_TILES = 1.2;

const HINT_HIT_MARGIN_X_PX = 6;
const HINT_HIT_MARGIN_TOP_PX = 10;
const HINT_HIT_MARGIN_BOTTOM_PX = 6;

interface Target {
  /** `board` = a screen (tv), `kanban` = the task board on the wall, games = chill room games. */
  type: 'desk' | 'board' | 'kanban' | 'foosball' | 'uno' | 'lego' | 'kitchen';
  id: string;
  name: string;
  /** Where the player must stand (tiles). */
  area: Rect;
  /** Closest wins when areas overlap. */
  spot: { x: number; y: number };
  /** Where the hint appears (pixels, bottom of the bubble). */
  anchor: { x: number; y: number };
}

/** Registers desk interaction targets matching layout desk zones. */
function registerDeskTargets(layout: OfficeLayout): Target[] {
  const zones = new Map(deriveZones(layout).map((z) => [z.id, z]));
  return numberedDesks(layout).map(({ desk, name }) => {
    const spot = seatPoint(desk);
    // Over the desk, on the half away from the person (their name plate is on their side).
    const dy = spot.y - desk.y;
    const y = desk.y * TILE + (dy > DESK_SEAT_DY_THRESHOLD ? DESK_ANCHOR_Y_AWAY_PX : dy < -DESK_SEAT_DY_THRESHOLD ? DESK_ANCHOR_Y_NEAR_PX : DESK_ANCHOR_Y_DEFAULT_PX);
    return { type: 'desk', id: desk.id, name, spot, area: zones.get(desk.id)!, anchor: { x: desk.x * TILE, y } };
  });
}

/** Registers TV screen interaction targets. */
function registerTvTargets(layout: OfficeLayout): Target[] {
  return layout.furniture
    .filter((f) => f.kind === 'tv')
    .map((tv) => {
      const b = itemBounds(tv);
      return {
        type: 'board',
        id: tv.id,
        name: 'Screen',
        spot: { x: tv.x, y: tv.y + TV_SPOT_OFFSET_Y_TILES },
        area: { x: b.x - TV_TRIGGER_MARGIN_X_TILES, y: b.y, w: b.w + TV_TRIGGER_EXTRA_W_TILES, h: TV_TRIGGER_HEIGHT_TILES },
        anchor: { x: tv.x * TILE, y: b.y * TILE - BADGE_ANCHOR_OFFSET_Y_PX },
      };
    });
}

/** Registers wall kanban task board interaction targets. */
function registerBoardTargets(layout: OfficeLayout): Target[] {
  return layout.furniture
    .filter((f) => f.kind === 'board')
    .map((board) => {
      const b = itemBounds(board);
      return {
        type: 'kanban',
        id: board.id,
        name: 'Task board',
        spot: { x: board.x, y: b.y + b.h + BOARD_SPOT_OFFSET_Y_TILES },
        area: { x: b.x - BOARD_TRIGGER_MARGIN_X_TILES, y: b.y, w: b.w + BOARD_TRIGGER_EXTRA_W_TILES, h: b.h + BOARD_TRIGGER_EXTRA_H_TILES },
        anchor: { x: board.x * TILE, y: b.y * TILE - BADGE_ANCHOR_OFFSET_Y_PX },
      };
    });
}

/** Registers foosball (baby foot) table interaction targets. */
function registerFoosballTargets(layout: OfficeLayout): Target[] {
  return layout.furniture
    .filter((f) => f.kind === 'foosball')
    .map((f) => {
      const b = itemBounds(f);
      return {
        type: 'foosball',
        id: f.id,
        name: 'Baby foot table',
        spot: { x: f.x, y: f.y },
        area: {
          x: b.x - TABLE_GAME_TRIGGER_MARGIN_TILES,
          y: b.y - TABLE_GAME_TRIGGER_MARGIN_TILES,
          w: b.w + TABLE_GAME_TRIGGER_EXTRA_TILES,
          h: b.h + TABLE_GAME_TRIGGER_EXTRA_TILES,
        },
        anchor: { x: f.x * TILE, y: b.y * TILE - BADGE_ANCHOR_OFFSET_Y_PX },
      };
    });
}

/** Registers Uno card table (chill room game) interaction targets. */
function registerChillTargets(layout: OfficeLayout): Target[] {
  return layout.furniture
    .filter((f) => f.kind === 'cardTable')
    .map((f) => {
      const b = itemBounds(f);
      return {
        type: 'uno',
        id: f.id,
        name: 'Uno table',
        spot: { x: f.x, y: f.y },
        area: {
          x: b.x - TABLE_GAME_TRIGGER_MARGIN_TILES,
          y: b.y - TABLE_GAME_TRIGGER_MARGIN_TILES,
          w: b.w + TABLE_GAME_TRIGGER_EXTRA_TILES,
          h: b.h + TABLE_GAME_TRIGGER_EXTRA_TILES,
        },
        anchor: { x: f.x * TILE, y: b.y * TILE - BADGE_ANCHOR_OFFSET_Y_PX },
      };
    });
}

/** Registers Lego wall board interaction targets. */
function registerLegoTargets(layout: OfficeLayout): Target[] {
  return layout.furniture
    .filter((f) => f.kind === 'legoBoard')
    .map((lego) => {
      const b = itemBounds(lego);
      return {
        type: 'lego',
        id: lego.id,
        name: 'Lego wall',
        spot: { x: lego.x, y: b.y + b.h + LEGO_SPOT_OFFSET_Y_TILES },
        area: { x: b.x - LEGO_TRIGGER_MARGIN_X_TILES, y: b.y, w: b.w + LEGO_TRIGGER_EXTRA_W_TILES, h: b.h + LEGO_TRIGGER_EXTRA_H_TILES },
        anchor: { x: lego.x * TILE, y: b.y * TILE - BADGE_ANCHOR_OFFSET_Y_PX },
      };
    });
}

/** Registers the kitchen café (its fridge and counter): buy water, Pepsi or dinner with PulseCoin. */
function registerKitchenTargets(layout: OfficeLayout): Target[] {
  return layout.furniture
    .filter((f) => f.kind === 'fridge' || f.kind === 'counter')
    .map((f) => {
      const b = itemBounds(f);
      const m = KITCHEN_TRIGGER_MARGIN_TILES;
      return {
        type: 'kitchen',
        id: f.id,
        name: 'Kitchen café',
        spot: { x: f.x, y: f.y },
        area: { x: b.x - m, y: b.y - m, w: b.w + 2 * m, h: b.h + 2 * m },
        anchor: { x: f.x * TILE, y: b.y * TILE - BADGE_ANCHOR_OFFSET_Y_PX },
      };
    });
}

/**
 * Things you can use: your desk (and others'), screens. Standing next to one
 * shows a hint; E (or tapping the hint) emits `object:interact`.
 */
export class Interactions {
  private readonly targets: Target[];
  private owners = new Map<string, DeskOwner>();
  private current: Target | null = null;
  private hint: Bubble | null = null;
  private lastPx = NaN;
  private lastPy = NaN;
  private lastEnabled = false;

  constructor(
    private readonly scene: Phaser.Scene,
    layout: OfficeLayout,
    private readonly o: { fontFamily: string; resolution: number; myId: string; touch: boolean; depth: number },
  ) {
    this.targets = [
      ...registerDeskTargets(layout),
      ...registerTvTargets(layout),
      ...registerBoardTargets(layout),
      ...registerFoosballTargets(layout),
      ...registerChillTargets(layout),
      ...registerLegoTargets(layout),
      ...registerKitchenTargets(layout),
    ];
  }

  /** Updates desk ownership records to reflect correct nameplates on interaction hints. */
  setOwners(owners: DeskOwner[]) {
    this.lastPx = NaN;
    this.owners = new Map(owners.map((o) => [o.deskId, o]));
    if (this.current) this.show(this.current);
  }

  /** Player feet in pixels; `enabled` false hides the hint (editing...). */
  update(px: number, py: number, enabled: boolean) {
    if (px === this.lastPx && py === this.lastPy && enabled === this.lastEnabled) return;
    this.lastPx = px;
    this.lastPy = py;
    this.lastEnabled = enabled;

    let best: Target | null = null;
    if (enabled) {
      const x = px / TILE;
      const y = py / TILE;
      let bestDistance = Infinity;
      for (const t of this.targets) {
        const { area } = t;
        if (x < area.x || x > area.x + area.w || y < area.y || y > area.y + area.h) continue;
        const d = Math.hypot(t.spot.x - x, t.spot.y - y);
        if (d < bestDistance) {
          best = t;
          bestDistance = d;
        }
      }
    }
    if (best === this.current) return;
    this.current = best;
    if (best) this.show(best);
    else this.hide();
  }

  /** E pressed or hint tapped. */
  trigger() {
    const t = this.current;
    if (!t) return false;
    officeEvents.emit('object:interact', {
      type: t.type,
      id: t.id,
      name: t.name,
      ownerId: t.type === 'desk' ? (this.owners.get(t.id)?.userId ?? null) : null,
    });
    return true;
  }

  /** True if a tap at this world point hits the hint. */
  hits(x: number, y: number) {
    if (!this.hint || !this.current) return false;
    const { w, h } = this.hint.box;
    const a = this.current.anchor;
    return (
      x >= a.x - w / 2 - HINT_HIT_MARGIN_X_PX &&
      x <= a.x + w / 2 + HINT_HIT_MARGIN_X_PX &&
      y >= a.y - h - HINT_HIT_MARGIN_TOP_PX &&
      y <= a.y + HINT_HIT_MARGIN_BOTTOM_PX
    );
  }

  /** Cleans up active hint bubble and resets target state. */
  destroy() {
    this.hide();
  }

  private label(t: Target) {
    if (t.type === 'foosball') return 'Play Baby foot';
    if (t.type === 'uno') return 'Play Uno';
    if (t.type === 'lego') return 'Build with Lego';
    if (t.type === 'board') return 'Use the screen';
    if (t.type === 'kanban') return 'Open the task board';
    const owner = this.owners.get(t.id);
    if (!owner) return `Move to ${t.name}`;
    return owner.userId === this.o.myId ? 'Your desk' : `${owner.name.split(' ')[0]}’s desk`;
  }

  private show(t: Target) {
    const text = this.o.touch ? `Tap · ${this.label(t)}` : this.label(t);
    this.hint?.destroy();
    this.hint = new Bubble(this.scene, t.anchor.x, t.anchor.y, text, {
      fontFamily: this.o.fontFamily,
      resolution: this.o.resolution,
      key: this.o.touch ? undefined : 'E',
      tail: true,
    }).setDepth(this.o.depth);
  }

  private hide() {
    this.hint?.destroy();
    this.hint = null;
  }
}
