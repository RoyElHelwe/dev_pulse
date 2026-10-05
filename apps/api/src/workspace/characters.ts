/** Character looks the game knows (apps/web/game/objects/looks.ts). */
export const CHARACTERS = ['maya', 'sam', 'noor', 'lea', 'omar', 'kai', 'zoe', 'ivan'] as const;

export function randomCharacter() {
  return CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)];
}
