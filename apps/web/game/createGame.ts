import * as Phaser from 'phaser';
import type { LayoutEditor } from './editor/LayoutEditor';
import type { OfficeLayout } from './layout/types';
import type { DeskOwner } from './objects/DeskPlates';
import type { RoomBooking } from './objects/RoomBadges';
import { OfficeScene, type OfficeSceneData, type OfficeSnapshot, type PlayerState } from './scenes/OfficeScene';

export type { DeskOwner, OfficeSnapshot, PlayerState, RoomBooking };

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
  setPlayerZone(id: string, zone: string | null): void;
  setPlayerStatus(id: string, status: string | null): void;
  setOwnStatus(status: string | null): void;
  /** Voice: `id` (yours or someone else's) is in a call → headset on; `talking` → its light blinks. */
  setVoice(id: string, inCall: boolean, talking: boolean): void;
  /** Who sits where (name plates on desks). */
  setDesks(desks: DeskOwner[]): void;
  /** Touch joystick, -1..1 on each axis (0, 0 = stop). */
  setJoystick(x: number, y: number): void;
  /** Positions for the minimap (tiles). */
  snapshot(): OfficeSnapshot | null;
  /** Rebuild the office with a new layout (organiser saved), keeping everyone in place. */
  setLayout(layout: OfficeLayout): void;
  /** Organisers: edit the office in place. Stop by calling setLayout (saved or original). */
  startEditing(editor: LayoutEditor, onProblem: (text: string) => void): void;
  /**
   * Meetings: rooms the local player may not enter right now (booked without them).
   * Returns the id of the room they were moved out of, if they stood in one.
   */
  setLockedRooms(roomIds: string[]): string | null;
  /** Meetings: rooms booked right now, with the end time shown on their badge ("15:00"). */
  setRoomBookings(bookings: RoomBooking[]): void;
  /** Where the local player is, to (re)announce it. */
  localPosition(): { x: number; y: number } | null;
  destroy(): void;
}

interface GameOptions {
  layout: OfficeLayout;
  myId: string;
  character: string;
  name: string;
  status: string | null;
  desks: DeskOwner[];
  fontFamily: string;
  onMove: OfficeSceneData['onMove'];
  onZone: OfficeSceneData['onZone'];
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
  let desks = options.desks;
  let locked: string[] = [];
  let bookings: RoomBooking[] = [];
  const voice = new Map<string, { inCall: boolean; talking: boolean }>();
  const touch = window.matchMedia('(pointer: coarse)').matches;
  let data: OfficeSceneData = {
    ...options,
    dpr,
    touch,
    players: () => [...players.values()],
    desks: () => desks,
    locked: () => locked,
    bookings: () => bookings,
    voice: () => voice,
  };

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
      desks = withCharacter(desks, id, character);
      scene()?.setPlayerCharacter(id, character);
    },
    setOwnCharacter(character) {
      data = { ...data, character };
      desks = withCharacter(desks, options.myId, character);
      scene()?.setOwnLook(character);
    },
    setPlayerZone(id, zone) {
      const p = players.get(id);
      if (p) p.zone = zone;
      scene()?.setPlayerZone(id, zone);
    },
    setPlayerStatus(id, status) {
      const p = players.get(id);
      if (p) p.status = status;
      scene()?.setPlayerStatus(id, status);
    },
    setVoice(id, inCall, talking) {
      if (inCall) voice.set(id, { inCall, talking });
      else voice.delete(id);
      scene()?.setVoice(id, inCall, talking);
    },
    setOwnStatus(status) {
      data = { ...data, status };
      scene()?.setOwnStatus(status);
    },
    setDesks(list) {
      desks = list;
      scene()?.setDesks(list);
    },
    setJoystick: (x, y) => scene()?.setJoystick(x, y),
    setLockedRooms(ids) {
      locked = ids;
      return scene()?.setLockedRooms(ids) ?? null;
    },
    setRoomBookings(list) {
      bookings = list;
      scene()?.setRoomBookings(list);
    },
    snapshot: () => scene()?.snapshot() ?? null,
    setLayout(layout) {
      const s = scene();
      data = { ...data, layout, startAt: s?.localPosition() };
      s?.scene.restart(data);
    },
    startEditing: (editor, onProblem) => scene()?.startEditing(editor, onProblem),
    localPosition: () => scene()?.localPosition() ?? null,
    destroy: () => {
      observer.disconnect();
      game.destroy(true);
    },
  };
}

/** Desk owners with one person's new character (their desk follows their look after a layout reload). */
function withCharacter(desks: DeskOwner[], userId: string, character: string) {
  return desks.map((d) => (d.userId === userId ? { ...d, character } : d));
}
