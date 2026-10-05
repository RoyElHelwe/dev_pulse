import { memo } from 'react';
import { itemBounds } from '@/game/layout/derive';
import type { FurnitureKind, OfficeLayout } from '@/game/layout/types';
import { cn } from '@/lib/cn';

const FLOOR: Record<string, string> = { oak: '#dcc29e', terrazzo: '#ebe6de' };

const FURNITURE_COLOR: Partial<Record<FurnitureKind, string>> = {
  desk: '#f6f2ec',
  meetingTable: '#6e5241',
  counter: '#f5f4f1',
  fridge: '#e2e6e9',
  barTable: '#efe8de',
  coffeeTable: '#e7ddd0',
  bookshelf: '#8b6b4e',
  divider: '#a9b4b0',
  plant: '#4c8f57',
  chair: '#2b2f33',
  stool: '#33383d',
  tv: '#111417',
};

const hex = (c?: number) => (c === undefined ? undefined : `#${c.toString(16).padStart(6, '0')}`);

/** A small floor plan of an office (rooms, walls, furniture), as SVG. */
export const LayoutPreview = memo(function LayoutPreview({ layout, className }: { layout: OfficeLayout; className?: string }) {
  const items = [...layout.furniture].sort((a, b) => Number(a.kind !== 'rug') - Number(b.kind !== 'rug'));
  return (
    <svg
      viewBox={`-0.5 -0.5 ${layout.width + 1} ${layout.height + 1}`}
      className={cn('h-auto w-full', className)}
      role="img"
      aria-label="Floor plan"
    >
      <rect x="-0.5" y="-0.5" width={layout.width + 1} height={layout.height + 1} rx="1.2" fill="#d6d1c9" />
      {layout.rooms.map((r) => (
        <rect key={r.id} x={r.x} y={r.y} width={r.w} height={r.h} fill={hex(r.color) ?? FLOOR[r.floor]} />
      ))}
      {items.map((f) => {
        const b = itemBounds(f);
        const round = f.kind === 'plant' || f.kind === 'stool' || f.kind === 'beanbag';
        const fill = FURNITURE_COLOR[f.kind] ?? hex(f.color) ?? '#9ca3af';
        if (f.kind === 'floorLamp') return null;
        return round ? (
          <circle key={f.id} cx={f.x} cy={f.y} r={Math.min(b.w, b.h) / 2} fill={fill} />
        ) : (
          <rect
            key={f.id}
            x={b.x}
            y={b.y}
            width={b.w}
            height={b.h}
            rx={Math.min(0.3, b.w / 3, b.h / 3)}
            fill={fill}
            opacity={f.kind === 'rug' ? 0.9 : 1}
            stroke={f.kind === 'desk' ? '#d8d0c4' : undefined}
            strokeWidth={0.08}
          />
        );
      })}
      {layout.walls.map((w, i) => (
        <line
          key={i}
          x1={w.x1}
          y1={w.y1}
          x2={w.x2}
          y2={w.y2}
          stroke={w.kind === 'glass' ? '#8fc5d6' : '#2d3236'}
          strokeWidth={w.kind === 'glass' ? 0.25 : 0.4}
          strokeLinecap="square"
        />
      ))}
    </svg>
  );
});
