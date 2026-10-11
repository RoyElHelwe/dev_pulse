/**
 * Headless state container and history manager for office layout modifications.
 * Coordinates selection, dragging, snapping, placement rules, and undo/redo stacks.
 */

import { itemBounds } from '../layout/geometry';
import { isWallMounted, snapToWall } from '../layout/mount';
import type { Furniture, FurnitureKind, OfficeLayout } from '../layout/types';
import { catalogEntry } from './catalog';
import { placementProblem, type PlacementProblem } from './rules';

/** Positions snap to a quarter of a tile. */
const SNAP = 0.25;
const snap = (v: number) => Math.round(v / SNAP) * SNAP;

/** Maximum wall search distance in tiles for auto-snapping wall-mounted furniture. */
const WALL_SNAP_DISTANCE_TILES = 4;
/** Maximum retained edit operations in undo history. */
const MAX_UNDO_DEPTH = 100;
/** Extra tile spacing margin added when duplicating furniture beside selected group. */
const DUPLICATE_OFFSET_MARGIN_TILES = 0.5;

const ROTATION_STEP_CW_DEG = 90;
const ROTATION_STEP_CCW_DEG = 270;
const FULL_ROTATION_DEG = 360;

const RANDOM_ID_RADIX = 36;
const RANDOM_ID_START_INDEX = 2;
const RANDOM_ID_END_INDEX = 8;

interface Snapshot {
  furniture: Furniture[];
  rooms: Record<string, string>;
}

interface EditorState {
  furniture: Furniture[];
  roomNames: Record<string, string>;
  /** The piece shown in the inspector (the last one clicked). */
  selectedId: string | null;
  /** Everything selected (shift-click or a box drawn with shift). */
  selectedIds: string[];
  /** Kind being placed from the palette (follows the mouse until clicked). */
  placing: { kind: FurnitureKind; w: number; h: number; color?: number } | null;
  /** Items the server said break the office (unreachable desk...). */
  flagged: string[];
  dirty: boolean;
  canUndo: boolean;
  canRedo: boolean;
}

/** Headless office editor state manager tracking furniture layout, selection, and undo history. */
export class LayoutEditor {
  private furniture: Furniture[];
  private roomNames: Record<string, string>;
  private selection: string[] = [];
  /** Positions when a drag started (to move a group by the same amount). */
  private dragStart: Map<string, { x: number; y: number }> | null = null;
  private placing: EditorState['placing'] = null;
  private flagged: string[] = [];
  private past: Snapshot[] = [];
  private future: Snapshot[] = [];
  private listeners = new Set<() => void>();
  private state!: EditorState;
  private readonly initial: string;

  constructor(readonly layout: OfficeLayout) {
    this.furniture = layout.furniture.map((f) => ({ ...f }));
    this.roomNames = Object.fromEntries(layout.rooms.map((r) => [r.id, r.name]));
    this.initial = JSON.stringify(this.snapshot());
    this.publish();
  }

  // ---- subscription (useSyncExternalStore) ---------------------------------------

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getState = () => this.state;

  // ---- queries -------------------------------------------------------------------

  /** Finds a furniture item by id, or undefined if not in layout. */
  item(id: string) {
    return this.furniture.find((f) => f.id === id);
  }

  /** Returns placement conflict/error for an item, or null if position is valid. */
  problemOf(item: Furniture): PlacementProblem | null {
    return placementProblem(item, this.layout, this.furniture);
  }

  // ---- selection and placing -----------------------------------------------------

  /** Select one piece; `add` toggles it in the current selection (shift-click). */
  select(id: string | null, add = false) {
    if (!id) this.selection = add ? this.selection : [];
    else if (!add) this.selection = [id];
    else if (this.selection.includes(id)) this.selection = this.selection.filter((s) => s !== id);
    else this.selection = [...this.selection, id];
    this.placing = null;
    this.publish();
  }

  /** Select every piece whose centre is inside the rectangle (tiles). */
  selectBox(x1: number, y1: number, x2: number, y2: number, add = false) {
    const [ax, bx] = [Math.min(x1, x2), Math.max(x1, x2)];
    const [ay, by] = [Math.min(y1, y2), Math.max(y1, y2)];
    const inside = this.furniture.filter((f) => f.x >= ax && f.x <= bx && f.y >= ay && f.y <= by).map((f) => f.id);
    this.selection = add ? [...new Set([...this.selection, ...inside])] : inside;
    this.placing = null;
    this.publish();
  }

  /** Returns true if the furniture id is currently in the active selection set. */
  isSelected(id: string) {
    return this.selection.includes(id);
  }

  /** Sets an item from catalog to be actively placed following the cursor. */
  startPlacing(kind: FurnitureKind, w?: number, h?: number) {
    const entry = catalogEntry(kind)!;
    this.placing = { kind, w: w ?? entry.w, h: h ?? entry.h, color: entry.colors?.[0] };
    this.selection = [];
    this.publish();
  }

  /** Cancels active furniture placement mode without creating an item. */
  cancelPlacing() {
    this.placing = null;
    this.publish();
  }

  // ---- edits (each one is one undo step) -------------------------------------------

  /** Places the palette item at (x, y). Returns the problem instead if it doesn't fit. */
  place(x: number, y: number): PlacementProblem | null {
    if (!this.placing) return null;
    const { kind, w, h, color } = this.placing;
    let item: Furniture = { id: newId(kind), kind, x: snap(x), y: snap(y), w, h, ...(color !== undefined && { color }) };
    if (isWallMounted(item.kind)) {
      const snapped = snapToWall(item, this.layout.walls, WALL_SNAP_DISTANCE_TILES);
      if (snapped) item = snapped;
    }
    const problem = this.problemOf(item);
    if (problem) return problem;
    this.record();
    this.furniture.push(item);
    this.selection = [item.id];
    this.placing = null;
    this.publish();
    return null;
  }

  /** Starts dragging the selection (one undo step for the whole drag). */
  beginDrag() {
    this.record();
    this.dragStart = new Map(this.selected().map((f) => [f.id, { x: f.x, y: f.y }]));
  }

  /** Live move while dragging, by (dx, dy) tiles from where the drag started. */
  dragBy(dx: number, dy: number) {
    if (!this.dragStart) return;
    const sx = snap(dx);
    const sy = snap(dy);
    for (const [id, start] of this.dragStart) {
      const item = this.item(id);
      if (item) {
        let next: Furniture = { ...item, x: start.x + sx, y: start.y + sy };
        if (isWallMounted(next.kind)) {
          const snapped = snapToWall(next, this.layout.walls, WALL_SNAP_DISTANCE_TILES);
          if (snapped) next = snapped;
        }
        Object.assign(item, { x: next.x, y: next.y, rotation: next.rotation });
      }
    }
    this.publish();
  }

  /** Drops the selection; if any piece doesn't fit, everything goes back. */
  endDrag(): PlacementProblem | null {
    for (const item of this.selected()) {
      if (isWallMounted(item.kind)) {
        const snapped = snapToWall(item, this.layout.walls, WALL_SNAP_DISTANCE_TILES);
        if (snapped) {
          item.x = snapped.x;
          item.y = snapped.y;
          item.rotation = 0;
        }
      }
    }
    const problem = this.firstProblem(this.selected());
    const before = this.past[this.past.length - 1];
    const moved = before && JSON.stringify(before.furniture) !== JSON.stringify(this.furniture);
    if (problem || !moved) {
      this.past.pop();
      if (before) this.furniture = before.furniture.map((f) => ({ ...f }));
    }
    this.dragStart = null;
    this.publish();
    return problem;
  }

  /** Problems of the dragged pieces right now (to tint them while dragging). */
  dragProblem(): PlacementProblem | null {
    return this.dragStart ? this.firstProblem(this.selected()) : null;
  }

  /** Shifts all selected items by delta tiles if no placement rules are violated. */
  nudge(dx: number, dy: number): PlacementProblem | null {
    return this.changeSelected((f) => {
      let next: Furniture = { ...f, x: snap(f.x + dx), y: snap(f.y + dy) };
      if (isWallMounted(next.kind)) {
        const snapped = snapToWall(next, this.layout.walls, WALL_SNAP_DISTANCE_TILES);
        if (snapped) next = snapped;
      }
      return { x: next.x, y: next.y, rotation: next.rotation };
    });
  }

  /** Each selected piece turns in place. */
  rotate(clockwise = true): PlacementProblem | null {
    if (this.selected().every((f) => isWallMounted(f.kind))) return null;
    return this.changeSelected((f) => {
      if (isWallMounted(f.kind)) return {};
      return {
        rotation: (((f.rotation ?? 0) + (clockwise ? ROTATION_STEP_CW_DEG : ROTATION_STEP_CCW_DEG)) % FULL_ROTATION_DEG) as Furniture['rotation'],
      };
    });
  }

  /** Updates custom color tint of the specified furniture item. */
  setColor(id: string, color: number) {
    const item = this.item(id);
    if (!item) return;
    this.record();
    item.color = color;
    this.publish();
  }

  /** Copies the selection next to itself (right, below, left or above: the first free side). */
  duplicate(): PlacementProblem | null {
    const group = this.selected();
    if (group.length === 0) return null;
    const box = bounds(group);
    for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
      const ox = snap(dx * (box.w + DUPLICATE_OFFSET_MARGIN_TILES));
      const oy = snap(dy * (box.h + DUPLICATE_OFFSET_MARGIN_TILES));
      const copies = group.map((f) => ({ ...f, id: newId(f.kind), x: f.x + ox, y: f.y + oy }));
      const others = [...this.furniture, ...copies];
      if (copies.every((c) => !placementProblem(c, this.layout, others))) {
        this.record();
        this.furniture.push(...copies);
        this.selection = copies.map((c) => c.id);
        this.publish();
        return null;
      }
    }
    return 'overlap';
  }

  /** Deletes all currently selected furniture items and records undo step. */
  remove() {
    if (this.selection.length === 0) return;
    this.record();
    const gone = new Set(this.selection);
    this.furniture = this.furniture.filter((f) => !gone.has(f.id));
    this.selection = [];
    this.publish();
  }

  /** Puts back the template's original furniture and room names (one undo step, saved like any edit). */
  reset(original: OfficeLayout) {
    this.record();
    this.furniture = original.furniture.map((f) => ({ ...f }));
    this.roomNames = Object.fromEntries(original.rooms.map((r) => [r.id, r.name]));
    this.selection = [];
    this.publish();
  }

  /** Updates display name of a room boundary in the layout. */
  renameRoom(id: string, name: string) {
    if (this.roomNames[id] === name) return;
    this.record();
    this.roomNames = { ...this.roomNames, [id]: name };
    this.publish();
  }

  /** Reverts the last layout edit from history. */
  undo() {
    const previous = this.past.pop();
    if (!previous) return;
    this.future.push(this.snapshot());
    this.restore(previous);
  }

  /** Reapplies the most recently reverted layout edit. */
  redo() {
    const next = this.future.pop();
    if (!next) return;
    this.past.push(this.snapshot());
    this.restore(next);
  }

  /** Marks the items the server refused (and selects them). */
  flag(ids: string[]) {
    this.flagged = ids;
    if (ids.length > 0) this.selection = ids.filter((id) => this.item(id));
    this.publish();
  }

  /** What the API's PUT /workspace/layout expects. */
  toSave(version: number) {
    return {
      version,
      furniture: this.furniture,
      rooms: Object.entries(this.roomNames).map(([id, name]) => ({ id, name })),
    };
  }

  // ---- internals -------------------------------------------------------------------

  private selected() {
    return this.selection.map((id) => this.item(id)).filter((f): f is Furniture => !!f);
  }

  private firstProblem(items: Furniture[]) {
    for (const item of items) {
      const problem = this.problemOf(item);
      if (problem) return problem;
    }
    return null;
  }

  /** Applies a change to every selected piece, only if all of them still fit. */
  private changeSelected(change: (f: Furniture) => Partial<Furniture>): PlacementProblem | null {
    const group = this.selected();
    if (group.length === 0) return null;
    const ids = new Set(group.map((f) => f.id));
    const next = this.furniture.map((f) => (ids.has(f.id) ? { ...f, ...change(f) } : f));
    for (const f of next) {
      if (!ids.has(f.id)) continue;
      const problem = placementProblem(f, this.layout, next);
      if (problem) return problem;
    }
    this.record();
    this.furniture = next;
    this.publish();
    return null;
  }

  private snapshot(): Snapshot {
    return { furniture: this.furniture.map((f) => ({ ...f })), rooms: { ...this.roomNames } };
  }

  private record() {
    this.past.push(this.snapshot());
    if (this.past.length > MAX_UNDO_DEPTH) this.past.shift();
    this.future = [];
    this.flagged = [];
  }

  private restore(s: Snapshot) {
    this.furniture = s.furniture.map((f) => ({ ...f }));
    this.roomNames = { ...s.rooms };
    this.selection = this.selection.filter((id) => this.item(id));
    this.publish();
  }

  private publish() {
    this.state = {
      furniture: this.furniture,
      roomNames: this.roomNames,
      selectedId: this.selection[this.selection.length - 1] ?? null,
      selectedIds: this.selection,
      placing: this.placing,
      flagged: this.flagged,
      dirty: JSON.stringify(this.snapshot()) !== this.initial,
      canUndo: this.past.length > 0,
      canRedo: this.future.length > 0,
    };
    this.listeners.forEach((l) => l());
  }
}

function bounds(items: Furniture[]) {
  const boxes = items.map(itemBounds);
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  return { x, y, w: Math.max(...boxes.map((b) => b.x + b.w)) - x, h: Math.max(...boxes.map((b) => b.y + b.h)) - y };
}

function newId(kind: string) {
  return `${kind}-${Math.random().toString(RANDOM_ID_RADIX).slice(RANDOM_ID_START_INDEX, RANDOM_ID_END_INDEX)}`;
}
