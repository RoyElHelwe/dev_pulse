'use client';

import { Shuffle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { encode, PRESET_KEYS, randomRecipe } from '@/game/art/recipe';
import { seededRandom } from '@/game/render/draw';
import { cn } from '@/lib/cn';
import { CharacterPreview } from './CharacterPreview';

function freshFaces(count: number) {
  const random = seededRandom(String(Math.random()));
  return Array.from({ length: count }, () => encode(randomRecipe(random)));
}

/**
 * Character picker: the 8 named characters plus a row of new ones generated
 * from random recipes (game/art/recipe.ts), which "New faces" re-rolls. A
 * generated character is stored as its code, so it's unique to its owner.
 */
export function CharacterGrid({
  value,
  onPick,
  disabled,
  fresh = 4,
  className,
  tileClassName,
  previewClassName = 'h-12',
}: {
  value: string;
  onPick: (character: string) => void;
  disabled?: boolean;
  /** How many generated characters to offer. */
  fresh?: number;
  className?: string;
  tileClassName?: string;
  previewClassName?: string;
}) {
  // Generated after mounting, so the server and the browser render the same first frame.
  const [faces, setFaces] = useState<string[]>([]);
  useEffect(() => setFaces(freshFaces(fresh)), [fresh]);

  // Keep the current character visible when it's a generated one from earlier.
  const options = useMemo(() => {
    const list = [...PRESET_KEYS, ...faces];
    return list.includes(value) ? list : [...PRESET_KEYS, value, ...faces.slice(0, Math.max(0, fresh - 1))];
  }, [faces, fresh, value]);

  return (
    <div className="grid gap-2">
      <div className={cn('grid grid-cols-4 gap-2', className)} role="radiogroup" aria-label="Character">
        {options.map((key, i) => (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={value === key}
            aria-label={PRESET_KEYS.includes(key) ? key : `New character ${i - PRESET_KEYS.length + 1}`}
            disabled={disabled}
            onClick={() => onPick(key)}
            className={cn(
              'rounded-xl bg-zinc-50 p-1.5 ring-2 transition disabled:opacity-60',
              value === key ? 'bg-emerald-50 ring-emerald-500' : 'ring-transparent hover:ring-zinc-300',
              tileClassName,
            )}
          >
            <CharacterPreview character={key} className={cn('mx-auto', previewClassName)} />
          </button>
        ))}
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setFaces(freshFaces(fresh))}
        className="inline-flex items-center gap-1.5 justify-self-start rounded-full px-2.5 py-1 text-xs font-medium text-zinc-600 transition hover:bg-zinc-900/5 disabled:opacity-60"
      >
        <Shuffle className="size-3.5" aria-hidden="true" />
        New faces
      </button>
    </div>
  );
}
