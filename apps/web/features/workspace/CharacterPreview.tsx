import { drawCharacter } from '@/game/art/character';
import { svgPen } from '@/game/art/pen';
import { recipeOf } from '@/game/art/recipe';
import { cn } from '@/lib/cn';

/** SVG markup per character, drawn once (lists show the same people over and over). */
const figures = new Map<string, string>();

/**
 * The game character as SVG (front view), drawn by the same code as the game
 * (game/art/character.ts), for pickers and lists outside the game. The markup
 * only contains shapes and colours generated from the recipe.
 */
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

/** Whole character, e.g. in the character picker. */
export function CharacterPreview({ character, className }: { character: string; className?: string }) {
  const figure = figureOf(character);
  return <svg viewBox="-22 -62 44 66" className={className} aria-hidden="true" dangerouslySetInnerHTML={{ __html: figure }} />;
}

/** Just the head in a circle, for lists of people. */
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
