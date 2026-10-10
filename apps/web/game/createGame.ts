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
  /** Keep the player this many CSS px right of the view centre (negative: left), e.g. while the task board is open. */
  setViewShift(cssPx: number): void;
  /** The whole list of other people (on connect / reconnect). */
  setPlayers(players: PlayerState[]): void;
  upsertPlayer(player: PlayerState): void;
  movePlayer(id: string, x: number, y: number, dir: number, moving: boolean, seated?: boolean): void;
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
  /** Chat: show a message over someone's head (their id; yours too). */
  showChat(userId: string, text: string): void;
  /** Open tasks per user id: the paper stacks on their desks grow with them. */
  setTaskCounts(counts: ReadonlyMap<string, number>): void;
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
  /** Dev/test hook: teleport the local player to pixel coordinates. */
  teleportTo(x: number, y: number): void;
  /**
   * Take the office off the display's frame clock while something covers it (a slow background tick keeps
   * people, proximity and timers going). `hidden` (default, a full-screen game): no rendering and no local input;
   * `throttled` (the board drawer): ~15 fps rendering. `setPaused(false)` resumes instantly.
   */
  setPaused(paused: boolean, mode?: 'hidden' | 'throttled'): void;
  destroy(): void;
}

interface GameOptions {
  layout: OfficeLayout;
  /** Everyone already in the office (the game may finish loading after the first update). */
  players: PlayerState[];
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
/** Frame-rate cap requested by a test browser (0: none). */
function fpsCap(): number {
  const cap = (window as unknown as { __devpulseFps?: unknown }).__devpulseFps;
  return typeof cap === 'number' && cap >= 5 && cap <= 60 ? cap : 0;
}

export function createGame(parent: HTMLElement, options: GameOptions): OfficeController {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const size = () => ({
    width: Math.max(1, Math.round(parent.clientWidth * dpr)),
    height: Math.max(1, Math.round(parent.clientHeight * dpr)),
  });

  // Other people live here, outside the scene, so a layout reload keeps them.
  const players = new Map(options.players.map((p) => [p.id, p]));
  let desks = options.desks;
  let taskCounts: ReadonlyMap<string, number> = new Map();
  let locked: string[] = [];
  let bookings: RoomBooking[] = [];
  const voice = new Map<string, { inCall: boolean; talking: boolean }>();
  const touch = window.matchMedia('(pointer: coarse)').matches;
  let isPaused = false;
  let pausedMode: 'hidden' | 'throttled' = 'hidden';
  let tick: ReturnType<typeof setInterval> | undefined;
  const stopTicking = () => {
    clearInterval(tick);
    tick = undefined;
  };
  let destroyed = false;
  let data: OfficeSceneData = {
    ...options,
    dpr,
    touch,
    players: () => [...players.values()],
    desks: () => desks,
    taskCounts: () => taskCounts,
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
    // Test browsers render in software: e2e sets `window.__devpulseFps` to cap the frame rate.
    ...(fpsCap() ? { fps: { limit: fpsCap() } } : {}),
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
    setViewShift: (cssPx) => scene()?.setViewShift(cssPx),
    setPlayers(list) {
      for (const id of players.keys()) if (!list.some((p) => p.id === id)) this.removePlayer(id);
      list.forEach((p) => this.upsertPlayer(p));
    },
    upsertPlayer(p) {
      players.set(p.id, p);
      scene()?.upsertPlayer(p);
    },
    movePlayer(id, x, y, dir, moving, seated) {
      const p = players.get(id);
      if (!p) return;
      Object.assign(p, { x, y, dir, moving, seated: !!seated });
      scene()?.movePlayer(id, x, y, dir, moving, !!seated);
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
    showChat: (userId, text) => scene()?.showChat(userId, text),
    setTaskCounts(counts) {
      taskCounts = counts;
      scene()?.setTaskCounts(counts);
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
    teleportTo: (x, y) => scene()?.teleportTo(x, y),
    setPaused(paused, mode = 'hidden') {
      if (destroyed || !game) return;
      if (isPaused === paused && (!paused || pausedMode === mode)) return;
      isPaused = paused;
      stopTicking();
      if (paused) {
        pausedMode = mode;
        game.loop.sleep();
        // Not on the display's frame clock any more, but people keep moving, proximity (voice) and timers keep
        // running: a slow manual tick. `hidden` (a full-screen game covers the office) does not render at all,
        // `throttled` (the board covers most of it) renders ~15 times a second.
        let last = performance.now();
        tick = setInterval(() => {
          const now = performance.now();
          const s = scene();
          if (s) {
            s.sys.settings.visible = mode === 'throttled';
            s.setInputBlocked(mode === 'hidden');
          }
          game.step(now, Math.min(100, now - last));
          last = now;
        }, mode === 'hidden' ? 100 : 66);
      } else {
        const s = scene();
        if (s) {
          s.sys.settings.visible = true;
          s.setInputBlocked(false);
        }
        game.loop.wake();
        // Clear keyboard and joystick input so the avatar is not left stuck walking on resume
        s?.input?.keyboard?.resetKeys();
        s?.setJoystick(0, 0);
      }
    },
    destroy: () => {
      destroyed = true;
      stopTicking();
      observer.disconnect();
      game.destroy(true);
    },
  };
}

/** Desk owners with one person's new character (their desk follows their look after a layout reload). */
function withCharacter(desks: DeskOwner[], userId: string, character: string) {
  return desks.map((d) => (d.userId === userId ? { ...d, character } : d));
}
