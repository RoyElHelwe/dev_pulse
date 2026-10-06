'use client';

import { Dices, Sparkles } from 'lucide-react';
import { useMemo } from 'react';
import { type Direction, drawCharacter } from '@/game/art/character';
import { css } from '@/game/art/color';
import { drawDesk } from '@/game/art/desk';
import { BOTTOM, CLOTH, HAIR, SHOES, SKIN, type Swatch } from '@/game/art/palette';
import { svgPen } from '@/game/art/pen';
import {
  encode, FIELDS, HAT_FREE_HAIR, mutate, PRESET_KEYS, PRESETS, randomRecipe, type Recipe, recipeOf, tidy,
} from '@/game/art/recipe';
import { seededRandom } from '@/game/render/draw';
import { cn } from '@/lib/cn';
import { CharacterPreview } from './CharacterPreview';

const GROUPS: { title: string; keys: (keyof Recipe)[] }[] = [
  { title: 'Body', keys: ['build', 'height', 'skin', 'freckles'] },
  { title: 'Hair & face', keys: ['hair', 'hairColor', 'beard', 'glasses'] },
  { title: 'Outfit', keys: ['top', 'topColor', 'pattern', 'trimColor', 'bottom', 'bottomColor', 'shoes'] },
  { title: 'Extras', keys: ['hat', 'hatColor', 'vibe'] },
];

const LABELS: Partial<Record<keyof Recipe, string>> = {
  hairColor: 'hair colour', topColor: 'top colour', trimColor: 'second colour',
  bottomColor: 'bottom colour', hatColor: 'hat colour', vibe: 'desk vibe',
};

const SWATCHES: Partial<Record<keyof Recipe, Swatch[]>> = {
  skin: SKIN, hairColor: HAIR, topColor: CLOTH, trimColor: CLOTH, hatColor: CLOTH, bottomColor: BOTTOM, shoes: SHOES,
};

const DIRS: Direction[] = ['down', 'right', 'up', 'left'];

export function CharacterStudio({
  value,
  onChange,
  disabled,
  className,
}: {
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const recipe = recipeOf(value);
  const code = encode(recipe);

  const { dirs, desk } = useMemo(() => {
    const r = recipeOf(code);
    const renderedDirs = DIRS.map((dir) => {
      const pen = svgPen();
      drawCharacter(pen, r, { dir, shadow: true });
      return { dir, markup: pen.markup() };
    });
    const deskPen = svgPen();
    drawDesk(deskPen, 96, 48, { seed: `studio-${r.vibe}`, owner: r });
    return { dirs: renderedDirs, desk: deskPen.markup() };
  }, [code]);

  const valueOf = (key: keyof Recipe) => {
    const field = FIELDS.find((f) => f.key === key)!;
    const v = recipe[key];
    return field.options ? field.options.indexOf(v as string) : typeof v === 'boolean' ? Number(v) : (v as number);
  };

  const setField = (key: keyof Recipe, index: number) => {
    const field = FIELDS.find((f) => f.key === key)!;
    const nextVal = field.options ? field.options[index] : key === 'freckles' ? index === 1 : index;
    onChange(encode(tidy({ ...recipe, [key]: nextVal } as Recipe)));
  };

  return (
    <div className={cn('grid grid-cols-1 gap-6 sm:grid-cols-2', className)}>
      {/* Left column: preview & quick picks */}
      <div className="space-y-4 sm:sticky sm:top-4 sm:self-start">
        <div className="space-y-3 rounded-2xl border border-zinc-200 bg-zinc-50/50 p-4">
          <div className="flex items-end justify-center gap-3 py-1">
            {dirs.map(({ dir, markup }) => (
              <svg
                key={dir}
                viewBox="-22 -62 44 66"
                className={cn('w-auto transition-transform', dir === 'down' ? 'h-20' : 'h-12 opacity-80')}
                aria-hidden="true"
                dangerouslySetInnerHTML={{ __html: markup }}
              />
            ))}
          </div>
          <div className="flex justify-center rounded-xl bg-[#dcc29e] p-2.5">
            <svg
              viewBox="-52 -28 104 56"
              className="h-auto w-full max-w-[200px]"
              aria-hidden="true"
              dangerouslySetInnerHTML={{ __html: desk }}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(encode(randomRecipe(seededRandom(String(Math.random())))))}
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-zinc-600 transition hover:bg-zinc-900/5 disabled:opacity-60"
          >
            <Dices className="size-3.5" aria-hidden="true" />
            Random
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(encode(mutate(recipe, seededRandom(String(Math.random())))))}
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-zinc-600 transition hover:bg-zinc-900/5 disabled:opacity-60"
          >
            <Sparkles className="size-3.5" aria-hidden="true" />
            Change a little
          </button>
        </div>

        <div className="space-y-1.5">
          <span className="text-xs font-medium text-zinc-500">Presets</span>
          <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Presets">
            {PRESET_KEYS.map((key) => {
              const isSelected = value === key || code === encode(PRESETS[key]);
              return (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  aria-label={key}
                  disabled={disabled}
                  onClick={() => onChange(key)}
                  className={cn(
                    'rounded-xl bg-zinc-50 p-1.5 ring-2 transition disabled:opacity-60',
                    isSelected ? 'bg-emerald-50 ring-emerald-500' : 'ring-transparent hover:ring-zinc-300',
                  )}
                >
                  <CharacterPreview character={key} className="mx-auto h-10" />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right column: part pickers */}
      <div className="space-y-4">
        {GROUPS.map((group) => (
          <fieldset key={group.title} className="space-y-3 rounded-xl border border-zinc-200/80 bg-zinc-50/50 p-3">
            <legend className="px-1 text-xs font-semibold text-zinc-700">{group.title}</legend>
            {group.keys.map((key) => {
              const field = FIELDS.find((f) => f.key === key)!;
              const swatches = SWATCHES[key];
              const current = valueOf(key);
              return (
                <div key={key} className="space-y-1">
                  <span className="block text-xs font-medium capitalize text-zinc-500">{LABELS[key] ?? key}</span>
                  <div className="flex flex-wrap gap-1">
                    {Array.from({ length: field.size }, (_, i) => {
                      if (swatches) {
                        const swatch = swatches[i];
                        const on = i === current;
                        return (
                          <button
                            key={i}
                            type="button"
                            title={swatch.name}
                            aria-label={`${LABELS[key] ?? key}: ${swatch.name}`}
                            aria-pressed={on}
                            disabled={disabled}
                            onClick={() => setField(key, i)}
                            style={{ background: `linear-gradient(135deg, ${css(swatch.ramp.base)} 55%, ${css(swatch.ramp.shadow)} 56%)` }}
                            className={cn(
                              'size-6 rounded-full transition ring-2 ring-offset-1 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.15)] disabled:opacity-60 disabled:cursor-not-allowed',
                              on ? 'ring-emerald-500' : 'ring-transparent hover:ring-zinc-300',
                            )}
                          />
                        );
                      }
                      const label = field.options ? field.options[i] : key === 'height' ? ['short', 'average', 'tall'][i] : ['no', 'yes'][i];
                      const off = key === 'hat' && i > 0 && HAT_FREE_HAIR.includes(recipe.hair);
                      const on = i === current;
                      return (
                        <button
                          key={i}
                          type="button"
                          aria-pressed={on}
                          disabled={disabled || off}
                          title={off ? `Not with ${recipe.hair} hair` : undefined}
                          onClick={() => setField(key, i)}
                          className={cn(
                            'rounded-full border px-2.5 py-0.5 text-xs font-medium transition disabled:opacity-40 disabled:cursor-not-allowed',
                            on
                              ? 'border-emerald-500 bg-emerald-50 text-emerald-900 ring-1 ring-emerald-500'
                              : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50',
                          )}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </fieldset>
        ))}
      </div>
    </div>
  );
}
