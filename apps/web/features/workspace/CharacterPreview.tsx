import { shade } from '@/game/render/draw';
import { type CharacterLook, lookOf } from '@/game/objects/looks';
import { cn } from '@/lib/cn';

const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

/**
 * The game character as SVG (front view), same shapes and colours as
 * game/objects/Avatar.ts, for pickers and lists outside the game.
 */
function Figure({ look }: { look: CharacterLook }) {
  const { skin, hair, hairStyle, top, bottom } = look;
  const sleeve = hex(shade(top, -0.12));
  const hy = -39;
  return (
    <g>
      <ellipse cx="0" cy="0" rx="13" ry="4.5" fill="#000" opacity="0.16" />
      <rect x="-7" y="-14" width="6" height="12" rx="3" fill={hex(bottom)} />
      <rect x="1" y="-14" width="6" height="12" rx="3" fill={hex(bottom)} />
      <rect x="-7.5" y="-4" width="7" height="4" rx="2" fill="#1f2125" />
      <rect x="0.5" y="-4" width="7" height="4" rx="2" fill="#1f2125" />
      {hairStyle === 'long' && <rect x="-11" y={hy - 2} width="22" height="17" rx="6" fill={hex(shade(hair, -0.1))} />}
      {hairStyle === 'bun' && <circle cx="0" cy={hy - 10} r="4.8" fill={hex(hair)} />}
      <rect x="-10" y="-30" width="20" height="18" rx="7" fill={hex(top)} />
      <rect x="-10" y="-17" width="20" height="3" fill="#000" opacity="0.08" />
      <rect x="-14" y="-28" width="5" height="13" rx="2.5" fill={sleeve} />
      <rect x="9" y="-28" width="5" height="13" rx="2.5" fill={sleeve} />
      <circle cx="-11.5" cy="-14.5" r="2.6" fill={hex(skin)} />
      <circle cx="11.5" cy="-14.5" r="2.6" fill={hex(skin)} />
      <rect x="-3" y="-31" width="6" height="4" rx="2" fill={hex(shade(skin, -0.1))} />
      <circle cx="0" cy={hy} r="9.5" fill={hex(skin)} />
      <path d={`M -10 ${hy} A 10 10 0 0 1 10 ${hy} Z`} fill={hex(hair)} />
      <rect x="-9.8" y={hy - 3.5} width="19.6" height="4.5" rx="2" fill={hex(hair)} />
      {hairStyle !== 'short' && <rect x="-9.8" y={hy - 3} width="3.5" height="7" rx="1.5" fill={hex(hair)} />}
      {hairStyle === 'curly' &&
        Array.from({ length: 7 }, (_, i) => {
          const a = Math.PI + (i / 6) * Math.PI;
          return <circle key={i} cx={Math.cos(a) * 9.5} cy={hy + Math.sin(a) * 9.5} r="3.4" fill={hex(hair)} />;
        })}
      <circle cx="-3.4" cy={hy + 1.8} r="1.3" fill="#2a2522" />
      <circle cx="3.4" cy={hy + 1.8} r="1.3" fill="#2a2522" />
      <circle cx="-5.5" cy={hy + 4.5} r="1.8" fill="#e58c8a" opacity="0.35" />
      <circle cx="5.5" cy={hy + 4.5} r="1.8" fill="#e58c8a" opacity="0.35" />
    </g>
  );
}

/** Whole character, e.g. in the character picker. */
export function CharacterPreview({ character, className }: { character: string; className?: string }) {
  return (
    <svg viewBox="-18 -54 36 58" className={className} aria-hidden="true">
      <Figure look={lookOf(character)} />
    </svg>
  );
}

/** Just the head in a circle, for lists of people. */
export function CharacterFace({ character, className }: { character: string; className?: string }) {
  return (
    <svg viewBox="-13 -53 26 26" className={cn('rounded-full bg-zinc-100', className)} aria-hidden="true">
      <Figure look={lookOf(character)} />
    </svg>
  );
}
