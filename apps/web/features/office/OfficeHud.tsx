'use client';

import { KanbanSquare, LocateFixed, MapPin, Minus, PencilRuler, Plus, UserPlus, WifiOff } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { IconButton } from '@/components/ui/IconButton';
import { Kbd } from '@/components/ui/Kbd';
import { Logo } from '@/components/ui/Logo';
import { Panel } from '@/components/ui/Panel';
import { UserMenu } from '@/features/auth/UserMenu';
import { buttonStyles } from '@/components/ui/Button';
import { useAuth } from '@/features/auth/AuthProvider';
import { useOpenTaskCounts } from '@/features/tasks/store';
import { canManage, type MyWorkspace } from '@/features/workspace/types';
import type { OfficeController } from '@/game/createGame';
import { deriveZones } from '@/game/layout/derive';
import { cn } from '@/lib/cn';
import { useKeyName } from '@/features/settings/keybinds';
import type { Presence } from './connection';
import { officeEvents, type ZoneEvent } from './events';
import { Joystick } from './Joystick';
import { Minimap } from './Minimap';
import { PresenceList } from './PresenceList';

const ZONE_LABEL: Record<ZoneEvent['type'], string> = {
  meeting: 'Meeting room',
  chill: 'Break area',
  desk: 'Workstation',
};

interface OfficeHudProps {
  controller: OfficeController | null;
  workspace: MyWorkspace | null;
  people: Presence[];
  toast: string;
  /** False while the live connection is lost (it reconnects by itself). */
  online: boolean;
  /** The office editor is open (it brings its own panels). */
  editing: boolean;
  onEdit(): void;
  /** The task board is open (it floats in from the right and pushes this whole HUD off to the left). */
  boardOpen: boolean;
  onBoard(): void;
}

export function OfficeHud({ controller, workspace, people, toast, online, editing, onEdit, boardOpen, onBoard }: OfficeHudProps) {
  const zone = useCurrentZone();
  const openCounts = useOpenTaskCounts();
  const myOpen = openCounts.get(useAuth().user?.id ?? '') ?? 0;
  const nearby = useNearby();
  const { user } = useAuth();
  const manager = canManage(workspace?.role);
  const interactKey = useKeyName('interact');
  const [showHelp, setShowHelp] = useState(true);
  const [touch, setTouch] = useState(false);
  useEffect(() => setTouch(window.matchMedia('(pointer: coarse)').matches), []);

  // Zone id → "Atlas · Meeting room" for the people list.
  const layout = workspace?.layout;
  const zones = useMemo(() => new Map((layout ? deriveZones(layout) : []).map((z) => [z.id, z])), [layout]);
  const desks = workspace?.desks;
  const placeOf = useCallback(
    (id: string | null | undefined) => {
      const z = id ? zones.get(id) : undefined;
      if (!z) return null;
      if (z.type !== 'desk') return `${z.name} · ${ZONE_LABEL[z.type]}`;
      const owner = desks?.find((d) => d.deskId === z.id);
      if (!owner) return `At ${z.name}`;
      return owner.userId === user?.id ? 'At your desk' : `At ${owner.name.split(' ')[0]}’s desk`;
    },
    [zones, desks, user?.id],
  );

  // The controls hint fades out after a few seconds.
  useEffect(() => {
    const timer = setTimeout(() => setShowHelp(false), 8000);
    return () => clearTimeout(timer);
  }, []);

  if (editing) {
    return (
      <>
        <Panel className="absolute right-4 bottom-5 flex items-center gap-0.5 p-1">
          <IconButton aria-label="Zoom out" onClick={() => controller?.zoomOut()}>
            <Minus className="size-4" />
          </IconButton>
          <IconButton aria-label="Zoom in" onClick={() => controller?.zoomIn()}>
            <Plus className="size-4" />
          </IconButton>
        </Panel>
        {toast && <Toast text={toast} />}
      </>
    );
  }

  return (
    <>
      {/* Top left: brand + where you are. */}
      <Panel className="absolute top-4 left-4 flex items-center gap-3 py-2 pr-2.5 pl-2.5 sm:pr-4">
        <Link href="/" aria-label="Back to home" className="rounded-lg">
          <Logo className="text-sm" />
        </Link>
        <span className="hidden h-5 w-px bg-zinc-200 sm:block" />
        <div className="hidden leading-tight sm:block">
          <p className="max-w-48 truncate text-[11px] font-medium tracking-wide text-zinc-500 uppercase">
            {workspace?.name ?? '…'}
          </p>
          <p className="flex items-center gap-1 text-sm font-semibold" aria-live="polite">
            <MapPin className="size-3.5 text-emerald-600" aria-hidden="true" />
            {zone ? zone.name : 'Open space'}
            {zone && <span className="font-normal text-zinc-500">· {ZONE_LABEL[zone.type]}</span>}
          </p>
        </div>
      </Panel>

      {/* Top right: view controls and the user menu. */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        {manager && (
          <Panel className="hidden items-center gap-0.5 p-1 lg:flex">
            <button type="button" onClick={onEdit} disabled={!controller} className={buttonStyles('ghost', 'sm', 'h-9')}>
              <PencilRuler className="size-4" /> Edit office
            </button>
            <Link href="/team" className={buttonStyles('ghost', 'sm', 'h-9')}>
              <UserPlus className="size-4" /> Invite
            </Link>
          </Panel>
        )}
        <Panel className="p-1">
          <button
            type="button"
            onClick={onBoard}
            aria-expanded={boardOpen}
            className={buttonStyles('ghost', 'sm', cn('h-9', boardOpen && 'bg-zinc-900/5 text-zinc-900'))}
          >
            <KanbanSquare className="size-4" /> Board
            {myOpen > 0 && (
              <span className="rounded-full bg-emerald-100 px-1.5 text-xs font-semibold text-emerald-800" title="Your open issues">
                {myOpen}
              </span>
            )}
          </button>
        </Panel>
        <PresenceList people={people} placeOf={placeOf} myZone={zone?.id ?? null} myStatus={workspace?.status ?? null} nearby={nearby} />
        <Panel className="flex items-center gap-0.5 p-1">
          <IconButton
            aria-label="Zoom out"
            onClick={() => controller?.zoomOut()}
            disabled={!controller}
          >
            <Minus className="size-4" />
          </IconButton>
          <IconButton
            aria-label="Zoom in"
            onClick={() => controller?.zoomIn()}
            disabled={!controller}
          >
            <Plus className="size-4" />
          </IconButton>
          <span className="mx-0.5 h-5 w-px bg-zinc-200" />
          <IconButton
            aria-label="Reset view"
            onClick={() => controller?.resetView()}
            disabled={!controller}
          >
            <LocateFixed className="size-4" />
          </IconButton>
        </Panel>
        <Panel className="p-1">
          <UserMenu compact profile={workspace ? { character: workspace.character, status: workspace.status } : undefined} />
        </Panel>
      </div>

      {/* Bottom: how to move. */}
      <Panel
        className={cn(
          'absolute bottom-20 left-1/2 hidden -translate-x-1/2 items-center gap-4 px-4 py-2.5 text-sm text-zinc-600 transition duration-700',
          !touch && 'sm:flex',
          showHelp ? 'opacity-100' : 'pointer-events-none translate-y-2 opacity-0',
        )}
      >
        <span className="flex items-center gap-1.5">
          <Kbd>W</Kbd>
          <Kbd>A</Kbd>
          <Kbd>S</Kbd>
          <Kbd>D</Kbd>
          <span className="mx-0.5 text-zinc-400">or</span>
          <Kbd>←</Kbd>
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd>
          <Kbd>→</Kbd>
          <span className="ml-1">to walk</span>
        </span>
        <span className="h-4 w-px bg-zinc-200" />
        <span className="flex items-center gap-1.5">
          <Kbd>{interactKey}</Kbd> to use
        </span>
        <span className="h-4 w-px bg-zinc-200" />
        <span className="flex items-center gap-1.5">
          <Kbd>Scroll</Kbd> to zoom
        </span>
      </Panel>

      {workspace && !touch && <Minimap controller={controller} layout={workspace.layout} />}
      <Joystick controller={controller} />

      {!online && (
        <Panel role="status" className="absolute top-20 left-1/2 flex -translate-x-1/2 items-center gap-2 px-4 py-2.5 text-sm font-medium text-amber-800">
          <WifiOff className="size-4" aria-hidden="true" />
          Connection lost. Reconnecting…
          <span className="size-3.5 animate-spin rounded-full border-2 border-amber-200 border-t-amber-600" />
        </Panel>
      )}

      {toast && <Toast text={toast} />}

      {/* Loading state. */}
      {!controller && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Panel className="flex items-center gap-3 px-5 py-3 text-sm font-medium text-zinc-600">
            <span className="size-4 animate-spin rounded-full border-2 border-zinc-300 border-t-emerald-500" />
            Setting up your office…
          </Panel>
        </div>
      )}
    </>
  );
}

function Toast({ text }: { text: string }) {
  return (
    <Panel role="status" className="absolute bottom-20 left-1/2 -translate-x-1/2 px-4 py-2.5 text-sm font-medium text-zinc-700">
      {text}
    </Panel>
  );
}

/** Who is close enough to talk to (from the game's proximity events). */
function useNearby() {
  const [nearby, setNearby] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    const offNear = officeEvents.on('player:near', ({ userId }) => setNearby((s) => new Set(s).add(userId)));
    const offFar = officeEvents.on('player:far', ({ userId }) =>
      setNearby((s) => {
        const next = new Set(s);
        next.delete(userId);
        return next;
      }),
    );
    return () => {
      offNear();
      offFar();
    };
  }, []);
  return nearby;
}

/** The zone the local player is standing in, or null in the open space. */
function useCurrentZone() {
  const [zone, setZone] = useState<ZoneEvent | null>(null);
  useEffect(() => {
    const offEnter = officeEvents.on('zone:enter', setZone);
    const offLeave = officeEvents.on('zone:leave', (left) =>
      setZone((current) => (current?.id === left.id ? null : current)),
    );
    return () => {
      offEnter();
      offLeave();
    };
  }, []);
  return zone;
}
