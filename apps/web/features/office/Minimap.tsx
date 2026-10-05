'use client';

import { Map as MapIcon, Minus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { IconButton } from '@/components/ui/IconButton';
import { Panel } from '@/components/ui/Panel';
import { LayoutPreview } from '@/features/workspace/LayoutPreview';
import type { OfficeController, OfficeSnapshot } from '@/game/createGame';
import type { OfficeLayout } from '@/game/layout/types';

const STORAGE_KEY = 'devpulse:minimap';

/** Floor plan in a corner with everyone's position and what the screen shows. */
export function Minimap({ controller, layout }: { controller: OfficeController | null; layout: OfficeLayout }) {
  const [open, setOpen] = useState(true);
  const [snap, setSnap] = useState<OfficeSnapshot | null>(null);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === 'closed') setOpen(false);
    } catch {}
  }, []);

  useEffect(() => {
    if (!open || !controller) return;
    const timer = setInterval(() => setSnap(controller.snapshot()), 150);
    return () => clearInterval(timer);
  }, [open, controller]);

  const toggle = (next: boolean) => {
    setOpen(next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? 'open' : 'closed');
    } catch {}
  };

  if (!open) {
    return (
      <Panel className="absolute right-4 bottom-5 hidden p-1 md:block">
        <IconButton aria-label="Show the map" onClick={() => toggle(true)}>
          <MapIcon className="size-4" />
        </IconButton>
      </Panel>
    );
  }

  return (
    <Panel className="absolute right-4 bottom-5 hidden w-56 p-2 md:block">
      <div className="mb-1 flex items-center justify-between pl-1">
        <span className="text-[11px] font-medium tracking-wide text-zinc-500 uppercase">Map</span>
        <IconButton aria-label="Hide the map" className="size-6" onClick={() => toggle(false)}>
          <Minus className="size-3.5" />
        </IconButton>
      </div>
      <div className="relative" style={{ aspectRatio: `${layout.width + 1} / ${layout.height + 1}` }}>
        <LayoutPreview layout={layout} className="absolute inset-0 rounded-lg" />
        {snap && (
          <svg
            viewBox={`-0.5 -0.5 ${layout.width + 1} ${layout.height + 1}`}
            className="absolute inset-0 h-full w-full"
            aria-hidden="true"
          >
            <rect
              x={snap.view.x}
              y={snap.view.y}
              width={snap.view.w}
              height={snap.view.h}
              fill="rgb(16 185 129 / 0.08)"
              stroke="#10b981"
              strokeWidth={0.25}
              rx={0.6}
            />
            {snap.others.map((p) => (
              <circle key={p.id} cx={p.x} cy={p.y - 0.4} r={0.75} fill="#3f3f46" stroke="#fff" strokeWidth={0.3} />
            ))}
            <circle cx={snap.me.x} cy={snap.me.y - 0.4} r={0.95} fill="#10b981" stroke="#fff" strokeWidth={0.35} />
          </svg>
        )}
      </div>
    </Panel>
  );
}
