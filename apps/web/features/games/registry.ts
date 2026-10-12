/**
 * Dynamic registry of game panel components for interactive office games.
 * Maps each supported GameKind to its lazily loaded UI panel component.
 */

import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';
import type { GameKind, GamePanelProps } from './types';

/**
 * Registry mapping game kinds to their respective dynamically imported panel components.
 *
 * WHY dynamic imports: Game panels load heavy rendering assets (Pixi canvas, physics engines,
 * audio, and card graphics). Using `next/dynamic` defers bundle loading until a user actually
 * interacts with that specific game object in the virtual office.
 */
export const GAME_PANELS: Record<GameKind, ComponentType<GamePanelProps>> = {
  foosball: dynamic(() => import('./foosball/FoosballPanel')),
  uno: dynamic(() => import('./uno/UnoPanel')),
  lego: dynamic(() => import('./lego/LegoPanel')),
};
