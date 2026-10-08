import type * as Phaser from 'phaser';
import { officeEvents } from '@/features/office/events';
import { TILE } from '../constants';
import { deriveZones, itemBounds, numberedDesks, type Rect, seatPoint } from '../layout/derive';
import type { OfficeLayout } from '../layout/types';
import { Bubble } from '../objects/Bubble';
import type { DeskOwner } from '../objects/DeskPlates';

interface Target {
  /** `board` = a screen (tv), `kanban` = the task board on the wall, games = chill room games. */
  type: 'desk' | 'board' | 'kanban' | 'foosball' | 'uno' | 'lego';
  id: string;
  name: string;
  /** Where the player must stand (tiles). */
  area: Rect;
  /** Closest wins when areas overlap. */
  spot: { x: number; y: number };
  /** Where the hint appears (pixels, bottom of the bubble). */
  anchor: { x: number; y: number };
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

  constructor(
    private readonly scene: Phaser.Scene,
    layout: OfficeLayout,
    private readonly o: { fontFamily: string; resolution: number; myId: string; touch: boolean; depth: number },
  ) {
    // Desks: the same area as the desk's zone ("Desk 3 · Workstation" in the HUD).
    const zones = new Map(deriveZones(layout).map((z) => [z.id, z]));
    const desks: Target[] = numberedDesks(layout).map(({ desk, name }) => {
      const spot = seatPoint(desk);
      // Over the desk, on the half away from the person (their name plate is on their side).
      const dy = spot.y - desk.y;
      const y = desk.y * TILE + (dy > 0.1 ? 2 : dy < -0.1 ? 26 : 12);
      return { type: 'desk', id: desk.id, name, spot, area: zones.get(desk.id)!, anchor: { x: desk.x * TILE, y } };
    });
    const screens: Target[] = layout.furniture
      .filter((f) => f.kind === 'tv')
      .map((tv) => {
        const b = itemBounds(tv);
        return {
          type: 'board',
          id: tv.id,
          name: 'Screen',
          spot: { x: tv.x, y: tv.y + 1.2 },
          area: { x: b.x - 0.5, y: b.y, w: b.w + 1, h: 2.6 },
          anchor: { x: tv.x * TILE, y: b.y * TILE - 6 },
        };
      });
    const boards: Target[] = layout.furniture
      .filter((f) => f.kind === 'board')
      .map((board) => {
        const b = itemBounds(board);
        return {
          type: 'kanban',
          id: board.id,
          name: 'Task board',
          spot: { x: board.x, y: b.y + b.h + 1.2 },
          area: { x: b.x - 0.5, y: b.y, w: b.w + 1, h: b.h + 2.4 },
          anchor: { x: board.x * TILE, y: b.y * TILE - 6 },
        };
      });
    const foosballs: Target[] = layout.furniture
      .filter((f) => f.kind === 'foosball')
      .map((f) => {
        const b = itemBounds(f);
        return {
          type: 'foosball',
          id: f.id,
          name: 'Baby foot table',
          spot: { x: f.x, y: f.y },
          area: { x: b.x - 1.2, y: b.y - 1.2, w: b.w + 2.4, h: b.h + 2.4 },
          anchor: { x: f.x * TILE, y: b.y * TILE - 6 },
        };
      });
    const cardTables: Target[] = layout.furniture
      .filter((f) => f.kind === 'cardTable')
      .map((f) => {
        const b = itemBounds(f);
        return {
          type: 'uno',
          id: f.id,
          name: 'Uno table',
          spot: { x: f.x, y: f.y },
          area: { x: b.x - 1.2, y: b.y - 1.2, w: b.w + 2.4, h: b.h + 2.4 },
          anchor: { x: f.x * TILE, y: b.y * TILE - 6 },
        };
      });
    const legos: Target[] = layout.furniture
      .filter((f) => f.kind === 'legoBoard')
      .map((lego) => {
        const b = itemBounds(lego);
        return {
          type: 'lego',
          id: lego.id,
          name: 'Lego wall',
          spot: { x: lego.x, y: b.y + b.h + 1.2 },
          area: { x: b.x - 0.5, y: b.y, w: b.w + 1, h: b.h + 2.4 },
          anchor: { x: lego.x * TILE, y: b.y * TILE - 6 },
        };
      });
    this.targets = [...desks, ...screens, ...boards, ...foosballs, ...cardTables, ...legos];
  }

  setOwners(owners: DeskOwner[]) {
    this.owners = new Map(owners.map((o) => [o.deskId, o]));
    if (this.current) this.show(this.current);
  }

  /** Player feet in pixels; `enabled` false hides the hint (editing...). */
  update(px: number, py: number, enabled: boolean) {
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
    return x >= a.x - w / 2 - 6 && x <= a.x + w / 2 + 6 && y >= a.y - h - 10 && y <= a.y + 6;
  }

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
