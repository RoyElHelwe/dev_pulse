/**
 * Factory creating and bootstrapping the Phaser game instance and OfficeScene.
 * Manages resizing, pause/sleep throttling modes, and exports the imperative OfficeController API.
 */

import * as Phaser from 'phaser';
import { devFpsCap } from '@/features/dev/devHooks';
import type { LayoutEditor } from './editor/LayoutEditor';
import type { OfficeLayout } from './layout/types';
import type { DeskOwner } from './objects/DeskPlates';
import type { RoomBooking } from './objects/RoomBadges';
import { OfficeScene, type OfficeSceneData, type OfficeSnapshot, type PlayerState } from './scenes/OfficeScene';

/** Desk assignment associating a desk index with an occupant user ID and character appearance. */
export type { DeskOwner };

/** Minimap snapshot containing player positions, local player coords, and office bounds. */
export type { OfficeSnapshot };

/** Serialized network state of a player in the office (position, direction, movement, character, status). */
export type { PlayerState };

/**
 * Zoom multiplier applied per zoom step.
 * WHY: Provides 20% incremental zoom in / zoom out steps for comfortable camera scaling.
 */
const ZOOM_FACTOR = 1.2;

/**
 * Maximum device pixel ratio to cap canvas scaling.
 * WHY: Prevents excessive GPU fill rate overhead on high-density retina displays (>2x).
 */
const MAX_DPR = 2;

/**
 * Canvas background color matching the office floor tone.
 */
const OFFICE_BACKGROUND_COLOR = '#e4e0da';

/**
 * Cap on manual step delta in milliseconds.
 * WHY: Prevents physics explosions or giant leaps when the tab wakes from being frozen or backgrounded.
 */
const MAX_STEP_DELTA_MS = 100;

/**
 * Step interval in milliseconds (~10 Hz) when hidden under a full-screen panel.
 * WHY: Sleep stops Phaser rendering and input completely to save CPU/GPU, but a 10 Hz manual step
 * keeps remote players moving, voice proximity alive, and internal timers ticking.
 */
const HIDDEN_STEP_INTERVAL_MS = 100;

/**
 * Step interval in milliseconds (~15 Hz) when throttled behind the task board drawer.
 * WHY: Renders at ~15 fps to drastically reduce Phaser draw overhead while keeping underlying animations
 * visually smooth behind the drawer UI.
 */
const THROTTLED_STEP_INTERVAL_MS = 66;

/**
 * Imperative controller handle returned by createGame to manipulate the office scene,
 * players, view, camera, and lifecycle from React components.
 */
export interface OfficeController {
  /** Zoom in the camera view by ZOOM_FACTOR. */
  zoomIn(): void;
  /** Zoom out the camera view by ZOOM_FACTOR. */
  zoomOut(): void;
  /** Reset camera zoom and pan back to the default tracking of the local player. */
  resetView(): void;
  /** Keep the player this many CSS px right of the view centre (negative: left), e.g. while the task board is open. */
  setViewShift(cssPx: number): void;
  /** The whole list of other people (on connect / reconnect). */
  setPlayers(players: PlayerState[]): void;
  /** Insert or update state for a single remote player. */
  upsertPlayer(player: PlayerState): void;
  /** Update position, facing direction, walking state, and seated state for a player. */
  movePlayer(id: string, x: number, y: number, dir: number, moving: boolean, seated?: boolean): void;
  /** Remove a disconnected remote player from the office. */
  removePlayer(id: string): void;
  /** Update sprite character asset key for a specific player. */
  setPlayerCharacter(id: string, character: string): void;
  /** Update sprite character asset key for the local player. */
  setOwnCharacter(character: string): void;
  /** Update the active zone ID where a remote player is standing. */
  setPlayerZone(id: string, zone: string | null): void;
  /** Update status bubble text for a remote player. */
  setPlayerStatus(id: string, status: string | null): void;
  /** Kitchen: someone (us included) holds a bought item for `ms`. */
  setHolding(id: string, item: string | null, ms: number): void;
  /** Update status bubble text for the local player. */
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
  /** Tear down the Phaser game instance, cancel step timers, and disconnect observers. */
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

interface GameRuntimeState {
  game: Phaser.Game;
  observer: ResizeObserver;
  options: GameOptions;
  players: Map<string, PlayerState>;
  desks: DeskOwner[];
  taskCounts: ReadonlyMap<string, number>;
  locked: string[];
  bookings: RoomBooking[];
  voice: Map<string, { inCall: boolean; talking: boolean }>;
  data: OfficeSceneData;
  isPaused: boolean;
  pausedMode: 'hidden' | 'throttled';
  tick?: ReturnType<typeof setInterval>;
  destroyed: boolean;
}

/** Builds Phaser game configuration including canvas sizing, scale mode, and dev FPS caps. */
function buildPhaserConfig(
  parent: HTMLElement,
  dpr: number,
  size: () => { width: number; height: number },
): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent,
    banner: false,
    audio: { noAudio: true },
    backgroundColor: OFFICE_BACKGROUND_COLOR,
    scale: { mode: Phaser.Scale.NONE, ...size(), zoom: 1 / dpr },
    // Variable step: Arcade's default fixed 60 Hz step moves the body only every 2nd-3rd frame on
    // 120/144 Hz screens (judder). Movement is velocity based and the delta is capped (MAX_STEP_DELTA_MS).
    physics: { default: 'arcade', arcade: { debug: false, fixedStep: false } },
    render: { antialias: true },
    // Test browsers render in software: e2e sets `window.__devpulseFps` to cap the frame rate.
    ...(devFpsCap() ? { fps: { limit: devFpsCap() } } : {}),
  };
}

/** Observes container element size changes and updates Phaser game scale accordingly. */
function wireResizeObserver(
  parent: HTMLElement,
  game: Phaser.Game,
  size: () => { width: number; height: number },
): ResizeObserver {
  const observer = new ResizeObserver(() => {
    const { width, height } = size();
    game.scale.resize(width, height);
  });
  observer.observe(parent);
  return observer;
}

/**
 * Starts a manual step loop when Phaser rendering is sleeping.
 * Keeps physics, remote player syncing, and voice proximity alive at a reduced rate.
 */
function startStepLoop(
  game: Phaser.Game,
  getScene: () => OfficeScene | null,
  mode: 'hidden' | 'throttled',
): ReturnType<typeof setInterval> {
  // Not on the display's frame clock any more, but people keep moving, proximity (voice) and timers keep
  // running: a slow manual tick. `hidden` (a full-screen game covers the office) does not render at all,
  // `throttled` (the board covers most of it) renders ~15 times a second.
  let last = performance.now();
  return setInterval(() => {
    const now = performance.now();
    const s = getScene();
    if (s) {
      s.sys.settings.visible = mode === 'throttled';
      s.setInputBlocked(mode === 'hidden');
    }
    game.step(now, Math.min(MAX_STEP_DELTA_MS, now - last));
    last = now;
  }, mode === 'hidden' ? HIDDEN_STEP_INTERVAL_MS : THROTTLED_STEP_INTERVAL_MS);
}

/** Clears any active background step interval. */
function stopStepLoop(state: GameRuntimeState): void {
  if (state.tick !== undefined) {
    clearInterval(state.tick);
    state.tick = undefined;
  }
}

/** Constructs the external OfficeController interface over scene and runtime state. */
function buildController(
  state: GameRuntimeState,
  getScene: () => OfficeScene | null,
): OfficeController {
  const controller: OfficeController = {
    zoomIn: () => getScene()?.zoomBy(ZOOM_FACTOR),
    zoomOut: () => getScene()?.zoomBy(1 / ZOOM_FACTOR),
    resetView: () => getScene()?.resetView(),
    setViewShift: (cssPx) => getScene()?.setViewShift(cssPx),
    setPlayers(list) {
      for (const id of state.players.keys()) if (!list.some((p) => p.id === id)) this.removePlayer(id);
      list.forEach((p) => this.upsertPlayer(p));
    },
    upsertPlayer(p) {
      state.players.set(p.id, p);
      getScene()?.upsertPlayer(p);
    },
    movePlayer(id, x, y, dir, moving, seated) {
      const p = state.players.get(id);
      if (!p) return;
      Object.assign(p, { x, y, dir, moving, seated: !!seated });
      getScene()?.movePlayer(id, x, y, dir, moving, !!seated);
    },
    removePlayer(id) {
      state.players.delete(id);
      getScene()?.removePlayer(id);
    },
    setPlayerCharacter(id, character) {
      const p = state.players.get(id);
      if (p) p.character = character;
      state.desks = withCharacter(state.desks, id, character);
      getScene()?.setPlayerCharacter(id, character);
    },
    setOwnCharacter(character) {
      state.data = { ...state.data, character };
      state.desks = withCharacter(state.desks, state.options.myId, character);
      getScene()?.setOwnLook(character);
    },
    setPlayerZone(id, zone) {
      const p = state.players.get(id);
      if (p) p.zone = zone;
      getScene()?.setPlayerZone(id, zone);
    },
    setPlayerStatus(id, status) {
      const p = state.players.get(id);
      if (p) p.status = status;
      getScene()?.setPlayerStatus(id, status);
    },
    setHolding(id, item, ms) {
      const p = state.players.get(id);
      if (p) p.holding = item ? { item, ms } : null;
      getScene()?.setHolding(id, item, ms);
    },
    setVoice(id, inCall, talking) {
      if (inCall) state.voice.set(id, { inCall, talking });
      else state.voice.delete(id);
      getScene()?.setVoice(id, inCall, talking);
    },
    setOwnStatus(status) {
      state.data = { ...state.data, status };
      getScene()?.setOwnStatus(status);
    },
    setDesks(list) {
      state.desks = list;
      getScene()?.setDesks(list);
    },
    showChat: (userId, text) => getScene()?.showChat(userId, text),
    setTaskCounts(counts) {
      state.taskCounts = counts;
      getScene()?.setTaskCounts(counts);
    },
    setJoystick: (x, y) => getScene()?.setJoystick(x, y),
    setLockedRooms(ids) {
      state.locked = ids;
      return getScene()?.setLockedRooms(ids) ?? null;
    },
    setRoomBookings(list) {
      state.bookings = list;
      getScene()?.setRoomBookings(list);
    },
    snapshot: () => getScene()?.snapshot() ?? null,
    setLayout(layout) {
      const s = getScene();
      state.data = { ...state.data, layout, startAt: s?.localPosition() };
      s?.scene.restart(state.data);
    },
    startEditing: (editor, onProblem) => getScene()?.startEditing(editor, onProblem),
    localPosition: () => getScene()?.localPosition() ?? null,
    teleportTo: (x, y) => getScene()?.teleportTo(x, y),
    setPaused(paused, mode = 'hidden') {
      if (state.destroyed || !state.game) return;
      if (state.isPaused === paused && (!paused || state.pausedMode === mode)) return;
      state.isPaused = paused;
      stopStepLoop(state);
      if (paused) {
        state.pausedMode = mode;
        state.game.loop.sleep();
        state.tick = startStepLoop(state.game, getScene, mode);
      } else {
        const s = getScene();
        if (s) {
          s.sys.settings.visible = true;
          s.setInputBlocked(false);
        }
        state.game.loop.wake();
        // Clear keyboard and joystick input so the avatar is not left stuck walking on resume
        s?.input?.keyboard?.resetKeys();
        s?.setJoystick(0, 0);
      }
    },
    destroy: () => {
      state.destroyed = true;
      stopStepLoop(state);
      state.observer.disconnect();
      state.game.destroy(true);
    },
  };
  return controller;
}

/** Desk owners with one person's new character (their desk follows their look after a layout reload). */
function withCharacter(desks: DeskOwner[], userId: string, character: string) {
  return desks.map((d) => (d.userId === userId ? { ...d, character } : d));
}

/**
 * Starts the office inside `parent`. The canvas is rendered at the device
 * pixel ratio and scaled down with CSS, so everything stays sharp on retina
 * screens. Import this file dynamically: Phaser only runs in the browser.
 */
export function createGame(parent: HTMLElement, options: GameOptions): OfficeController {
  const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
  const size = () => ({
    width: Math.max(1, Math.round(parent.clientWidth * dpr)),
    height: Math.max(1, Math.round(parent.clientHeight * dpr)),
  });

  const touch = window.matchMedia('(pointer: coarse)').matches;
  const players = new Map(options.players.map((p) => [p.id, p]));
  const voice = new Map<string, { inCall: boolean; talking: boolean }>();

  const state: GameRuntimeState = {
    game: null as unknown as Phaser.Game,
    observer: null as unknown as ResizeObserver,
    options,
    players,
    desks: options.desks,
    taskCounts: new Map(),
    locked: [],
    bookings: [],
    voice,
    data: {
      ...options,
      dpr,
      touch,
      players: () => [...state.players.values()],
      desks: () => state.desks,
      taskCounts: () => state.taskCounts,
      locked: () => state.locked,
      bookings: () => state.bookings,
      voice: () => state.voice,
    },
    isPaused: false,
    pausedMode: 'hidden',
    destroyed: false,
  };

  const config = buildPhaserConfig(parent, dpr, size);
  const game = new Phaser.Game(config);
  state.game = game;
  game.scene.add('office', OfficeScene, true, state.data);

  state.observer = wireResizeObserver(parent, game, size);

  const getScene = (): OfficeScene | null => {
    const s = game.scene.getScene('office') as unknown as OfficeScene | null;
    return s && s.sys.isActive() ? s : null;
  };

  return buildController(state, getScene);
}
