import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';
import type { GameKind, GamePanelProps } from './types';

export const GAME_PANELS: Record<GameKind, ComponentType<GamePanelProps>> = {
  foosball: dynamic(() => import('./foosball/FoosballPanel')),
  uno: dynamic(() => import('./uno/UnoPanel')),
  lego: dynamic(() => import('./lego/LegoPanel')),
};
