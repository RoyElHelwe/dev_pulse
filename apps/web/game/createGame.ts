import * as Phaser from 'phaser';
import { OfficeScene, type OfficeSceneData } from './scenes/OfficeScene';

export interface OfficeController {
  zoomIn(): void;
  zoomOut(): void;
  resetView(): void;
  destroy(): void;
}

/**
 * Starts the office inside `parent`. The canvas is rendered at the device
 * pixel ratio and scaled down with CSS, so everything stays sharp on retina
 * screens. Import this file dynamically: Phaser only runs in the browser.
 */
export function createGame(parent: HTMLElement, data: Omit<OfficeSceneData, 'dpr'>): OfficeController {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const size = () => ({
    width: Math.max(1, Math.round(parent.clientWidth * dpr)),
    height: Math.max(1, Math.round(parent.clientHeight * dpr)),
  });

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    banner: false,
    audio: { noAudio: true },
    backgroundColor: '#e4e0da',
    scale: { mode: Phaser.Scale.NONE, ...size(), zoom: 1 / dpr },
    physics: { default: 'arcade', arcade: { debug: false } },
    render: { antialias: true },
  });
  game.scene.add('office', OfficeScene, true, { ...data, dpr });

  const observer = new ResizeObserver(() => {
    const { width, height } = size();
    game.scale.resize(width, height);
  });
  observer.observe(parent);

  const scene = () => game.scene.getScene('office') as unknown as OfficeScene | null;
  return {
    zoomIn: () => scene()?.zoomBy(1.2),
    zoomOut: () => scene()?.zoomBy(1 / 1.2),
    resetView: () => scene()?.resetView(),
    destroy: () => {
      observer.disconnect();
      game.destroy(true);
    },
  };
}
