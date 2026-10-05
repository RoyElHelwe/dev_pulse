import type { Furniture, FurnitureKind, OfficeLayout } from '../layout/types';
import { catalogEntry } from './catalog';
import { placementProblem, type PlacementProblem } from './rules';

/** Positions snap to a quarter of a tile. */
export const SNAP = 0.25;
export const snap = (v: number) => Math.round(v / SNAP) * SNAP;

interface Snapshot {
  furniture: Furniture[];
  rooms: Record<string, string>;
}

export interface EditorState {
  furniture: Furniture[];
  roomNames: Record<string, string>;
  selectedId: string | null;
  /** Kind being placed from the palette (follows the mouse until clicked). */
  placing: { kind: FurnitureKind; w: number; h: number; color?: number } | null;
  /** Items the server said break the office (unreachable desk...). */
  flagged: string[];
  dirty: boolean;
  canUndo: boolean;
  canRedo: boolean;
}

/**
 * The office editor's state, without Phaser: the furniture being edited,
 * the selection and the undo history. The scene draws it; React shows the
 * panels; both subscribe to changes.
 */
export class LayoutEditor {
  private furniture: Furniture[];
  private roomNames: Record<string, string>;
  private selectedId: string | null = null;
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

  item(id: string) {
    return this.furniture.find((f) => f.id === id);
  }

  problemOf(item: Furniture): PlacementProblem | null {
    return placementProblem(item, this.layout, this.furniture);
  }

  // ---- selection and placing -----------------------------------------------------

  select(id: string | null) {
    this.selectedId = id;
    this.placing = null;
    this.publish();
  }

  startPlacing(kind: FurnitureKind, w?: number, h?: number) {
    const entry = catalogEntry(kind)!;
    this.placing = { kind, w: w ?? entry.w, h: h ?? entry.h, color: entry.colors?.[0] };
    this.selectedId = null;
    this.publish();
  }

  cancelPlacing() {
    this.placing = null;
    this.publish();
  }

  // ---- edits (each one is one undo step) -------------------------------------------

  /** Places the palette item at (x, y). Returns the problem instead if it doesn't fit. */
  place(x: number, y: number): PlacementProblem | null {
    if (!this.placing) return null;
    const { kind, w, h, color } = this.placing;
    const item: Furniture = { id: newId(kind), kind, x: snap(x), y: snap(y), w, h, ...(color !== undefined && { color }) };
    const problem = this.problemOf(item);
    if (problem) return problem;
    this.record();
    this.furniture.push(item);
    this.selectedId = item.id;
    this.placing = null;
    this.publish();
    return null;
  }

  /** Live move while dragging (no undo step until `endDrag`). */
  dragTo(id: string, x: number, y: number) {
    const item = this.item(id);
    if (!item) return;
    item.x = snap(x);
    item.y = snap(y);
    this.publish();
  }

  /** Remembers where a drag started, so it can be undone or cancelled. */
  beginDrag() {
    this.record();
  }

  /** Drops the item; if it doesn't fit, it goes back where it was. */
  endDrag(id: string): PlacementProblem | null {
    const item = this.item(id);
    const problem = item ? this.problemOf(item) : null;
    const before = this.past[this.past.length - 1];
    const moved = before && JSON.stringify(before.furniture) !== JSON.stringify(this.furniture);
    if (problem || !moved) {
      this.past.pop();
      if (before) this.furniture = before.furniture.map((f) => ({ ...f }));
    }
    this.publish();
    return problem;
  }

  nudge(id: string, dx: number, dy: number): PlacementProblem | null {
    const item = this.item(id);
    if (!item) return null;
    return this.tryChange(id, { x: snap(item.x + dx), y: snap(item.y + dy) });
  }

  rotate(id: string, clockwise = true): PlacementProblem | null {
    const item = this.item(id);
    if (!item) return null;
    const rotation = (((item.rotation ?? 0) + (clockwise ? 90 : 270)) % 360) as Furniture['rotation'];
    return this.tryChange(id, { rotation });
  }

  setColor(id: string, color: number) {
    this.tryChange(id, { color });
  }

  duplicate(id: string): PlacementProblem | null {
    const item = this.item(id);
    if (!item) return null;
    // Try a free spot next to the original: right, below, left, above.
    for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
      const copy = { ...item, id: newId(item.kind), x: snap(item.x + dx * (item.w + 0.5)), y: snap(item.y + dy * (item.h + 0.5)) };
      if (!this.problemOf(copy)) {
        this.record();
        this.furniture.push(copy);
        this.selectedId = copy.id;
        this.publish();
        return null;
      }
    }
    return 'overlap';
  }

  remove(id: string) {
    if (!this.item(id)) return;
    this.record();
    this.furniture = this.furniture.filter((f) => f.id !== id);
    if (this.selectedId === id) this.selectedId = null;
    this.publish();
  }

  renameRoom(id: string, name: string) {
    if (this.roomNames[id] === name) return;
    this.record();
    this.roomNames = { ...this.roomNames, [id]: name };
    this.publish();
  }

  undo() {
    const previous = this.past.pop();
    if (!previous) return;
    this.future.push(this.snapshot());
    this.restore(previous);
  }

  redo() {
    const next = this.future.pop();
    if (!next) return;
    this.past.push(this.snapshot());
    this.restore(next);
  }

  /** Marks the items the server refused (and selects the first one). */
  flag(ids: string[]) {
    this.flagged = ids;
    if (ids[0]) this.selectedId = ids[0];
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

  private tryChange(id: string, patch: Partial<Furniture>): PlacementProblem | null {
    const item = this.item(id);
    if (!item) return null;
    const problem = this.problemOf({ ...item, ...patch });
    if (problem) return problem;
    this.record();
    Object.assign(item, patch);
    this.publish();
    return null;
  }

  private snapshot(): Snapshot {
    return { furniture: this.furniture.map((f) => ({ ...f })), rooms: { ...this.roomNames } };
  }

  private record() {
    this.past.push(this.snapshot());
    if (this.past.length > 100) this.past.shift();
    this.future = [];
    this.flagged = [];
  }

  private restore(s: Snapshot) {
    this.furniture = s.furniture.map((f) => ({ ...f }));
    this.roomNames = { ...s.rooms };
    if (this.selectedId && !this.item(this.selectedId)) this.selectedId = null;
    this.publish();
  }

  private publish() {
    this.state = {
      furniture: this.furniture,
      roomNames: this.roomNames,
      selectedId: this.selectedId,
      placing: this.placing,
      flagged: this.flagged,
      dirty: JSON.stringify(this.snapshot()) !== this.initial,
      canUndo: this.past.length > 0,
      canRedo: this.future.length > 0,
    };
    this.listeners.forEach((l) => l());
  }
}

function newId(kind: string) {
  return `${kind}-${Math.random().toString(36).slice(2, 8)}`;
}
