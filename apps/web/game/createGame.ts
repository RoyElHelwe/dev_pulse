import * as Phaser from 'phaser';
import type { OfficeLayout } from './layout/types';
import { OfficeScene, type OfficeSceneData, type PlayerState } from './scenes/OfficeScene';

export type { PlayerState };

export interface OfficeController {
  zoomIn(): void;
  zoomOut(): void;
  resetView(): void;
  /** The whole list of other people (on connect / reconnect). */
  setPlayers(players: PlayerState[]): void;
  upsertPlayer(player: PlayerState): void;
  movePlayer(id: string, x: number, y: number, dir: number, moving: boolean): void;
  removePlayer(id: string): void;
  setPlayerCharacter(id: string, character: string): void;
  setOwnCharacter(character: string): void;
  /** Rebuild the office with a new layout (organiser saved), keeping everyone in place. */
  setLayout(layout: OfficeLayout): void;
  /** Where the local player is, to (re)announce it. */
  localPosition(): { x: number; y: number } | null;
  destroy(): void;
}

interface GameOptions {
  layout: OfficeLayout;
  character: string;
  name: string;
  fontFamily: string;
  onMove: OfficeSceneData['onMove'];
}

/**
 * Starts the office inside `parent`. The canvas is rendered at the device
 * pixel ratio and scaled down with CSS, so everything stays sharp on retina
 * screens. Import this file dynamically: Phaser only runs in the browser.
 */
export function createGame(parent: HTMLElement, options: GameOptions): OfficeController {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const size = () => ({
    width: Math.max(1, Math.round(parent.clientWidth * dpr)),
    height: Math.max(1, Math.round(parent.clientHeight * dpr)),
  });

  // Other people live here, outside the scene, so a layout reload keeps them.
  const players = new Map<string, PlayerState>();
  let data: OfficeSceneData = { ...options, dpr, players: () => [...players.values()] };

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
  game.scene.add('office', OfficeScene, true, data);

  const observer = new ResizeObserver(() => {
    const { width, height } = size();
    game.scale.resize(width, height);
  });
  observer.observe(parent);

  const scene = () => {
    const s = game.scene.getScene('office') as unknown as OfficeScene | null;
    return s && s.sys.isActive() ? s : null;
  };

  return {
    zoomIn: () => scene()?.zoomBy(1.2),
    zoomOut: () => scene()?.zoomBy(1 / 1.2),
    resetView: () => scene()?.resetView(),
    setPlayers(list) {
      for (const id of players.keys()) if (!list.some((p) => p.id === id)) this.removePlayer(id);
      list.forEach((p) => this.upsertPlayer(p));
    },
    upsertPlayer(p) {
      players.set(p.id, p);
      scene()?.upsertPlayer(p);
    },
    movePlayer(id, x, y, dir, moving) {
      const p = players.get(id);
      if (!p) return;
      Object.assign(p, { x, y, dir, moving });
      scene()?.movePlayer(id, x, y, dir, moving);
    },
    removePlayer(id) {
      players.delete(id);
      scene()?.removePlayer(id);
    },
    setPlayerCharacter(id, character) {
      const p = players.get(id);
      if (p) p.character = character;
      scene()?.setPlayerCharacter(id, character);
    },
    setOwnCharacter(character) {
      data = { ...data, character };
      scene()?.setOwnLook(character);
    },
    setLayout(layout) {
      const s = scene();
      data = { ...data, layout, startAt: s?.localPosition() };
      s?.scene.restart(data);
    },
    localPosition: () => scene()?.localPosition() ?? null,
    destroy: () => {
      observer.disconnect();
      game.destroy(true);
    },
  };
}
