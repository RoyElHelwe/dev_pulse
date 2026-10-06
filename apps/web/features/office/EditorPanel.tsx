'use client';

import {
  Armchair,
  Coffee,
  Columns2,
  Copy,
  LampFloor,
  Laptop,
  Leaf,
  Library,
  type LucideIcon,
  RectangleHorizontal,
  Redo2,
  Refrigerator,
  RotateCcw,
  RotateCw,
  Sofa,
  SquareKanban,
  Sprout,
  Square,
  Table2,
  Trash2,
  Tv,
  Undo2,
  Utensils,
} from 'lucide-react';
import { useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Kbd } from '@/components/ui/Kbd';
import { Panel } from '@/components/ui/Panel';
import { CATALOG, type CatalogItem, catalogEntry, KIND_LABEL } from '@/game/editor/catalog';
import type { LayoutEditor } from '@/game/editor/LayoutEditor';
import { PROBLEM_TEXT, type PlacementProblem } from '@/game/editor/rules';
import type { FurnitureKind } from '@/game/layout/types';
import { cn } from '@/lib/cn';

const ICON: Record<FurnitureKind, LucideIcon> = {
  desk: Laptop,
  chair: Armchair,
  divider: Columns2,
  bookshelf: Library,
  meetingTable: Table2,
  tv: Tv,
  sofa: Sofa,
  armchair: Armchair,
  coffeeTable: Coffee,
  beanbag: Square,
  rug: RectangleHorizontal,
  floorLamp: LampFloor,
  board: SquareKanban,
  counter: Utensils,
  fridge: Refrigerator,
  barTable: Table2,
  stool: Square,
  plant: Sprout,
};

const GROUPS = [...new Set(CATALOG.map((c) => c.group))];

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

interface EditorPanelProps {
  editor: LayoutEditor;
  saving: boolean;
  error: { message: string; reload: boolean } | null;
  onSave(): void;
  onDiscard(): void;
  onReload(): void;
  /** Puts back the template's original furniture (asks first). */
  onReset(): void;
  /** Shows why an action was refused. */
  onProblem(text: string): void;
}

/** The organiser's tools around the office while editing it. */
export function EditorPanel({ editor, saving, error, onSave, onDiscard, onReload, onReset, onProblem }: EditorPanelProps) {
  const state = useSyncExternalStore(editor.subscribe, editor.getState, editor.getState);
  const selected = state.selectedId ? editor.item(state.selectedId) : undefined;
  const count = state.selectedIds.length;
  const report = (problem: PlacementProblem | null) => problem && onProblem(PROBLEM_TEXT[problem]);

  return (
    <>
      {/* Top: what's going on + save. */}
      <Panel className="absolute top-4 left-1/2 flex -translate-x-1/2 items-center gap-1 py-1.5 pr-1.5 pl-4">
        <p className="mr-2 text-sm font-semibold whitespace-nowrap">Editing the office</p>
        <IconButton aria-label="Undo (Ctrl+Z)" onClick={() => editor.undo()} disabled={!state.canUndo} className="disabled:opacity-40">
          <Undo2 className="size-4" />
        </IconButton>
        <IconButton aria-label="Redo (Ctrl+Y)" onClick={() => editor.redo()} disabled={!state.canRedo} className="disabled:opacity-40">
          <Redo2 className="size-4" />
        </IconButton>
        <span className="mx-1 h-5 w-px bg-zinc-200" />
        <Button variant="ghost" size="sm" onClick={onDiscard} disabled={saving}>
          {state.dirty ? 'Discard' : 'Close'}
        </Button>
        <Button size="sm" onClick={onSave} loading={saving} disabled={!state.dirty}>
          Save for everyone
        </Button>
      </Panel>

      {error && (
        <Panel role="alert" className="absolute top-20 left-1/2 flex max-w-md -translate-x-1/2 items-center gap-3 border-rose-200 px-4 py-2.5 text-sm text-rose-700">
          <span>{error.message}</span>
          {error.reload && (
            <Button variant="secondary" size="sm" onClick={onReload}>
              Load the latest
            </Button>
          )}
        </Panel>
      )}

      {/* Left: furniture to add. */}
      <Panel className="absolute top-20 bottom-5 left-4 flex w-56 flex-col overflow-hidden">
        <p className="border-b border-zinc-200/70 px-4 py-3 text-sm font-semibold">Add furniture</p>
        <div className="flex-1 space-y-4 overflow-y-auto p-3">
          {GROUPS.map((group) => (
            <section key={group}>
              <h3 className="mb-1.5 px-1 text-[11px] font-medium tracking-wide text-zinc-500 uppercase">{group}</h3>
              <div className="grid grid-cols-2 gap-1.5">
                {CATALOG.filter((c) => c.group === group).map((item) => (
                  <PaletteButton key={item.label} item={item} editor={editor} active={isPlacing(state.placing, item)} />
                ))}
              </div>
            </section>
          ))}
        </div>
        <p className="border-t border-zinc-200/70 px-4 py-2.5 text-xs text-zinc-500">
          {state.placing ? (
            <>
              Click in the office to place it. <Kbd>Esc</Kbd> to cancel.
            </>
          ) : (
            'Pick a piece, then click where it goes.'
          )}
        </p>
      </Panel>

      {/* Right: the selected piece, or the room names. */}
      <Panel className="absolute top-20 right-4 w-64 overflow-hidden">
        {selected ? (
          <div>
            <div className="flex items-center justify-between border-b border-zinc-200/70 px-4 py-3">
              <p className="text-sm font-semibold">
                {count > 1 ? `${count} pieces selected` : (KIND_LABEL[selected.kind] ?? selected.kind)}
              </p>
              {state.selectedIds.some((id) => state.flagged.includes(id)) && (
                <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-medium text-rose-700">Blocked</span>
              )}
            </div>
            <div className="space-y-3 p-3">
              <div className="grid grid-cols-2 gap-1.5">
                <Tool icon={RotateCcw} label="Rotate left" onClick={() => report(editor.rotate(false))} />
                <Tool icon={RotateCw} label="Rotate right" onClick={() => report(editor.rotate(true))} />
                <Tool icon={Copy} label="Duplicate" onClick={() => report(editor.duplicate())} />
                <Tool icon={Trash2} label="Remove" danger onClick={() => editor.remove()} />
              </div>
              {count === 1 && catalogEntry(selected.kind)?.colors && (
                <div>
                  <p className="mb-1.5 text-xs font-medium text-zinc-500">Colour</p>
                  <div className="flex flex-wrap gap-1.5">
                    {catalogEntry(selected.kind)!.colors!.map((color) => (
                      <button
                        key={color}
                        type="button"
                        aria-label={`Colour ${hex(color)}`}
                        aria-pressed={selected.color === color}
                        onClick={() => editor.setColor(selected.id, color)}
                        className={cn(
                          'size-7 rounded-full ring-2 ring-offset-2 transition',
                          selected.color === color ? 'ring-emerald-500' : 'ring-transparent hover:ring-zinc-300',
                        )}
                        style={{ background: hex(color) }}
                      />
                    ))}
                  </div>
                </div>
              )}
              <p className="text-xs leading-relaxed text-zinc-500">
                Drag to move. <Kbd>R</Kbd> rotate, <Kbd>Del</Kbd> remove, arrows nudge. <Kbd>Shift</Kbd>-click to
                add or remove a piece.
              </p>
            </div>
          </div>
        ) : (
          <div>
            <p className="border-b border-zinc-200/70 px-4 py-3 text-sm font-semibold">Rooms</p>
            <div className="max-h-[60vh] space-y-2 overflow-y-auto p-3">
              {editor.layout.rooms
                .filter((room) => room.name)
                .map((room) => (
                  <RoomName key={room.id} id={room.id} value={state.roomNames[room.id]} editor={editor} />
                ))}
            </div>
            <p className="border-t border-zinc-200/70 px-4 py-2.5 text-xs text-zinc-500">
              Click a piece of furniture to change it. Drag the floor to look around. <Kbd>Shift</Kbd>-drag to select
              several, <Kbd>Ctrl</Kbd> <Kbd>A</Kbd> for all.
            </p>
            <div className="border-t border-zinc-200/70 p-3">
              <Button variant="ghost" size="sm" className="w-full text-zinc-600" onClick={onReset}>
                <RotateCcw className="size-3.5" /> Reset to the original furniture
              </Button>
            </div>
          </div>
        )}
      </Panel>
    </>
  );
}

function isPlacing(placing: { kind: FurnitureKind; w: number; h: number } | null, item: CatalogItem) {
  return !!placing && placing.kind === item.kind && placing.w === item.w && placing.h === item.h;
}

function PaletteButton({ item, editor, active }: { item: CatalogItem; editor: LayoutEditor; active: boolean }) {
  const Icon = item.label === 'Big plant' ? Leaf : ICON[item.kind];
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={() => (active ? editor.cancelPlacing() : editor.startPlacing(item.kind, item.w, item.h))}
      className={cn(
        'flex flex-col items-center gap-1 rounded-xl border px-1.5 py-2 text-center text-xs font-medium transition',
        active
          ? 'border-emerald-400 bg-emerald-50 text-emerald-800'
          : 'border-zinc-200/80 bg-white/70 text-zinc-700 hover:border-zinc-300 hover:bg-white',
      )}
    >
      <Icon className="size-4" aria-hidden="true" />
      <span className="leading-tight">{item.label}</span>
    </button>
  );
}

function Tool({ icon: Icon, label, onClick, danger }: { icon: LucideIcon; label: string; onClick(): void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 rounded-xl border border-zinc-200/80 bg-white/70 px-2.5 py-2 text-xs font-medium transition hover:bg-white',
        danger ? 'text-rose-600 hover:border-rose-200' : 'text-zinc-700 hover:border-zinc-300',
      )}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {label}
    </button>
  );
}

/** A room name field; the change is one undo step, applied on Enter or when leaving the field. */
function RoomName({ id, value, editor }: { id: string; value: string; editor: LayoutEditor }) {
  const commit = (input: HTMLInputElement) => {
    const name = input.value.trim();
    if (name) editor.renameRoom(id, name);
    else input.value = value;
  };
  return (
    <input
      key={value}
      defaultValue={value}
      maxLength={24}
      aria-label={`Name of ${value}`}
      onBlur={(e) => commit(e.currentTarget)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') {
          e.currentTarget.value = value;
          e.currentTarget.blur();
        }
      }}
      className="h-9 w-full rounded-lg border border-zinc-200 bg-white/80 px-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20"
    />
  );
}
