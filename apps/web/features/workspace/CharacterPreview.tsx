// Vector character avatar renderers producing full body or cropped face SVGs.
// Used across member rosters, presences, chat feeds, and character pickers.

import { drawCharacter } from '@/game/art/character';
import { svgPen } from '@/game/art/pen';
import { recipeOf } from '@/game/art/recipe';
import { cn } from '@/lib/cn';

// Cache generated SVG markup to avoid re-drawing recurring characters in lists.
const figures = new Map<string, string>();

function figureOf(character: string) {
  let figure = figures.get(character);
  if (!figure) {
    const pen = svgPen();
    drawCharacter(pen, recipeOf(character), { dir: 'down', shadow: true });
    figure = pen.markup();
    figures.set(character, figure);
  }
  return figure;
}

/** Renders a full-body SVG preview of a character recipe code. */
export function CharacterPreview({ character, className }: { character: string; className?: string }) {
  const figure = figureOf(character);
  return <svg viewBox="-22 -62 44 66" className={className} aria-hidden="true" dangerouslySetInnerHTML={{ __html: figure }} />;
}

/** Renders a circular cropped avatar face SVG for roster listings. */
export function CharacterFace({ character, className }: { character: string; className?: string }) {
  const figure = figureOf(character);
  return (
    <svg
      viewBox="-14 -56 28 28"
      className={cn('rounded-full bg-zinc-100', className)}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: figure }}
    />
  );
}
