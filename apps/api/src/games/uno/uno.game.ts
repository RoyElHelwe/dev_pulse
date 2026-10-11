/**
 * Uno game session wiring: connects pure rules engine to room sockets, events, and persistence.
 * Dispatches player actions and broadcasts state updates to participants.
 */

import type { GameContext, GameInstance, GamePlayerRef } from '../game.types';
import { GameError } from '../game.types';
import {
  type Card,
  type Color,
  type UnoGameState,
  type UnoView,
  CATCH_PENALTY_CARDS_COUNT,
  MAX_PLAYERS,
  MIN_PLAYERS,
  UNO_CALL_HAND_SIZE,
  UNO_VULNERABLE_HAND_SIZE,
  appendGameLog,
  buildDeck,
  buildUnoView,
  canCallUno,
  computeNextTurn,
  computeTurnOnPlayerLeave,
  createInitialUnoState,
  dealStartingHands,
  drawCards,
  getNextPlayerIndex,
  isPlayable,
  resolveCardColor,
  shuffle,
  stackDrawPenalty,
} from './uno.rules';

/** Optional constructor argument that lets specs supply a fixed draw pile instead of a shuffled deck. */
export interface UnoTestHooks {
  initialDeck?: Card[];
}

/** Handles a player or spectator joining the Uno game table. */
function handleJoin(state: UnoGameState, ctx: GameContext, p: GamePlayerRef, intent: unknown): void {
  const existingPlayer = state.players.find((pl) => pl.ref.userId === p.userId);
  if (existingPlayer) {
    existingPlayer.ref = p;
    ctx.emitState();
    return;
  }

  const isWatch = typeof intent === 'object' && intent !== null && (intent as any).watch === true;
  const spectatorIdx = state.spectators.findIndex((sp) => sp.ref.userId === p.userId);
  if (spectatorIdx !== -1) {
    if (state.phase === 'lobby' && !isWatch && state.players.length < MAX_PLAYERS) {
      state.spectators.splice(spectatorIdx, 1);
      state.players.push({ ref: p, hand: [], saidUno: false });
    } else {
      state.spectators[spectatorIdx].ref = p;
    }
    ctx.emitState();
    return;
  }

  if (isWatch || state.phase !== 'lobby' || state.players.length >= MAX_PLAYERS) {
    state.spectators.push({ ref: p });
  } else {
    state.players.push({ ref: p, hand: [], saidUno: false });
  }
  ctx.emitState();
}

/** Handles a player or spectator leaving or disconnecting from the table. */
function handleLeave(state: UnoGameState, ctx: GameContext, userId: string): void {
  const spectatorIdx = state.spectators.findIndex((s) => s.ref.userId === userId);
  if (spectatorIdx !== -1) {
    state.spectators.splice(spectatorIdx, 1);
    ctx.emitState();
    return;
  }

  const playerIdx = state.players.findIndex((p) => p.ref.userId === userId);
  if (playerIdx === -1) return;

  const leavingPlayer = state.players[playerIdx];
  appendGameLog(state.log, `${leavingPlayer.ref.name} left`);

  if (state.phase === 'lobby' || state.phase === 'ended') {
    state.players.splice(playerIdx, 1);
    ctx.emitState();
    return;
  }

  state.drawPile.unshift(...leavingPlayer.hand);
  if (state.vulnerableId === userId) state.vulnerableId = null;

  const wasTheirTurn = state.turnIndex === playerIdx;
  state.players.splice(playerIdx, 1);

  if (state.players.length < MIN_PLAYERS) {
    state.phase = 'ended';
    state.winnerId = state.players.length === 1 ? state.players[0].ref.userId : null;
    state.turnIndex = 0;
    state.drewCardId = null;
    state.pendingDraw = 0;
    state.pendingKind = null;
    state.vulnerableId = null;
    if (state.winnerId) {
      appendGameLog(state.log, `${state.players[0].ref.name} won!`);
      ctx.record({ winners: [state.winnerId], losers: [userId] }).catch(() => {});
      ctx.emitEvent('won', { userId: state.winnerId });
    }
    ctx.emitState();
    return;
  }

  if (wasTheirTurn) {
    state.drewCardId = null;
    state.turnIndex = computeTurnOnPlayerLeave(playerIdx, playerIdx, state.direction, state.players.length);
    ctx.emitEvent('turn', { userId: state.players[state.turnIndex].ref.userId });
  } else if (playerIdx < state.turnIndex) {
    state.turnIndex--;
  }

  ctx.emitState();
}

/** Starts an Uno game round from the lobby phase. */
function handleStart(
  state: UnoGameState,
  ctx: GameContext,
  userId: string,
  rng: () => number,
  testHooks?: UnoTestHooks,
): void {
  if (state.phase === 'playing') throw new GameError('bad_phase', 'Game already playing');
  const hostId = state.players[0]?.ref.userId ?? null;
  if (userId !== hostId) throw new GameError('not_host', 'Only host can start');
  if (state.players.length < MIN_PLAYERS) throw new GameError('need_players', 'Need at least 2 players to start');
  if (state.players.length > MAX_PLAYERS) throw new GameError('need_players', 'Maximum 6 players allowed');

  state.drawPile = testHooks?.initialDeck ? [...testHooks.initialDeck] : shuffle(buildDeck(), rng);
  state.discardPile = [];
  state.currentColor = dealStartingHands(state.players, state.drawPile, state.discardPile, rng);
  Object.assign(state, {
    direction: 1, turnIndex: 0, pendingDraw: 0, pendingKind: null,
    drewCardId: null, vulnerableId: null, winnerId: null, phase: 'playing',
  });

  appendGameLog(state.log, 'Game started');
  ctx.emitEvent('turn', { userId: state.players[0].ref.userId });
  ctx.emitState();
}

/** Resets an ended Uno game back to lobby phase. */
function handleAgain(state: UnoGameState, ctx: GameContext, userId: string): void {
  if (state.phase !== 'ended') throw new GameError('bad_phase', 'Game not ended');
  const hostId = state.players[0]?.ref.userId ?? null;
  if (userId !== hostId) throw new GameError('not_host', 'Only host can restart');

  const allJoined = [...state.players.map((p) => p.ref), ...state.spectators.map((s) => s.ref)];
  Object.assign(state, createInitialUnoState(), {
    players: allJoined.slice(0, MAX_PLAYERS).map((ref) => ({ ref, hand: [], saidUno: false })),
    spectators: allJoined.slice(MAX_PLAYERS).map((ref) => ({ ref })),
    log: state.log,
  });

  appendGameLog(state.log, 'Returned to lobby');
  ctx.emitState();
}

/** Handles playing a card from hand to the discard pile. */
function handlePlay(
  state: UnoGameState,
  ctx: GameContext,
  userId: string,
  cardId?: number,
  color?: Color,
): void {
  if (state.phase !== 'playing') throw new GameError('bad_phase', 'Game is not playing');
  const player = state.players[state.turnIndex];
  if (userId !== player?.ref.userId) throw new GameError('not_your_turn', 'Not your turn');
  if (typeof cardId !== 'number') throw new GameError('bad_card', 'Invalid cardId');

  const cardIdx = player.hand.findIndex((c) => c.id === cardId);
  if (cardIdx === -1) throw new GameError('bad_card', 'Card not in hand');

  const card = player.hand[cardIdx];
  if (state.drewCardId !== null && card.id !== state.drewCardId) {
    throw new GameError('illegal_play', 'Can only play the drawn card');
  }

  const top = state.discardPile[state.discardPile.length - 1];
  if (!isPlayable(card, top, state.currentColor, state.pendingDraw, state.pendingKind)) {
    throw new GameError('illegal_play', 'Card cannot be played');
  }

  state.currentColor = resolveCardColor(card, color);
  state.vulnerableId = null;
  player.hand.splice(cardIdx, 1);
  state.discardPile.push(card);

  if (card.value === 'draw2' || card.value === 'wild4') {
    const penalty = stackDrawPenalty(state.pendingDraw, card.value);
    state.pendingDraw = penalty.pendingDraw;
    state.pendingKind = penalty.pendingKind;
  }

  if (player.hand.length === 0) {
    Object.assign(state, {
      phase: 'ended', winnerId: player.ref.userId, turnIndex: 0,
      drewCardId: null, pendingDraw: 0, pendingKind: null, vulnerableId: null,
    });
    appendGameLog(state.log, `${player.ref.name} won!`);
    ctx.record({
      winners: [state.winnerId!],
      losers: state.players.filter((p) => p.ref.userId !== state.winnerId).map((p) => p.ref.userId),
    }).catch(() => {});
    ctx.emitEvent('won', { userId: state.winnerId });
    ctx.emitEvent('played', { userId, card });
    ctx.emitState();
    return;
  }

  if (player.hand.length === 1 && !player.saidUno) state.vulnerableId = player.ref.userId;
  state.drewCardId = null;

  const next = computeNextTurn(state.turnIndex, state.direction, state.players.length, card.value);
  state.turnIndex = next.nextIndex;
  state.direction = next.nextDirection;

  appendGameLog(state.log, `${player.ref.name} played ${card.color} ${card.value}`);
  ctx.emitEvent('played', { userId, card });
  ctx.emitEvent('turn', { userId: state.players[state.turnIndex].ref.userId });
  ctx.emitState();
}

/** Handles drawing cards from the draw pile or taking pending penalty draws. */
function handleDraw(state: UnoGameState, ctx: GameContext, userId: string, rng: () => number): void {
  if (state.phase !== 'playing') throw new GameError('bad_phase', 'Game is not playing');
  const player = state.players[state.turnIndex];
  if (userId !== player?.ref.userId) throw new GameError('not_your_turn', 'Not your turn');
  state.vulnerableId = null;

  if (state.pendingDraw > 0) {
    const penalty = state.pendingDraw;
    const drawn = drawCards(state.drawPile, state.discardPile, penalty, rng);
    player.hand.push(...drawn);
    if (player.hand.length > 1) player.saidUno = false;
    Object.assign(state, { pendingDraw: 0, pendingKind: null, drewCardId: null });
    state.turnIndex = getNextPlayerIndex(state.turnIndex, state.direction, state.players.length, 1);
    appendGameLog(state.log, `${player.ref.name} drew ${penalty} cards`);
    ctx.emitEvent('drew', { userId, count: penalty });
    ctx.emitEvent('turn', { userId: state.players[state.turnIndex].ref.userId });
    ctx.emitState();
    return;
  }

  if (state.drewCardId !== null) throw new GameError('already_drew', 'Already drew this turn');

  const drawn = drawCards(state.drawPile, state.discardPile, 1, rng);
  if (drawn.length === 0) {
    state.turnIndex = getNextPlayerIndex(state.turnIndex, state.direction, state.players.length, 1);
    ctx.emitEvent('turn', { userId: state.players[state.turnIndex].ref.userId });
    ctx.emitState();
    return;
  }

  const drawnCard = drawn[0];
  player.hand.push(drawnCard);
  if (player.hand.length > 1) player.saidUno = false;

  const top = state.discardPile[state.discardPile.length - 1];
  const playable = isPlayable(drawnCard, top, state.currentColor, 0, null);
  appendGameLog(state.log, `${player.ref.name} drew a card`);
  ctx.emitEvent('drew', { userId, count: 1 });

  if (playable) {
    state.drewCardId = drawnCard.id;
  } else {
    state.drewCardId = null;
    state.turnIndex = getNextPlayerIndex(state.turnIndex, state.direction, state.players.length, 1);
    ctx.emitEvent('turn', { userId: state.players[state.turnIndex].ref.userId });
  }
  ctx.emitState();
}

/** Handles voluntary turn passing after a card has been drawn. */
function handlePass(state: UnoGameState, ctx: GameContext, userId: string): void {
  if (state.phase !== 'playing') throw new GameError('bad_phase', 'Game is not playing');
  const player = state.players[state.turnIndex];
  if (userId !== player?.ref.userId) throw new GameError('not_your_turn', 'Not your turn');
  if (state.drewCardId === null) throw new GameError('must_draw_first', 'Must draw before passing');

  state.vulnerableId = null;
  state.drewCardId = null;
  state.turnIndex = getNextPlayerIndex(state.turnIndex, state.direction, state.players.length, 1);
  appendGameLog(state.log, `${player.ref.name} passed`);
  ctx.emitEvent('turn', { userId: state.players[state.turnIndex].ref.userId });
  ctx.emitState();
}

/** Handles calling Uno to protect or clear single-card vulnerability. */
function handleUno(state: UnoGameState, ctx: GameContext, userId: string): void {
  if (state.phase !== 'playing') throw new GameError('bad_phase', 'Game is not playing');
  const player = state.players.find((p) => p.ref.userId === userId);
  if (!player) throw new GameError('bad_action', 'Only seated players can call Uno');

  const isCurrentTurn = userId === state.players[state.turnIndex]?.ref.userId;
  if (!canCallUno(player.hand.length, isCurrentTurn)) {
    if (player.hand.length === UNO_CALL_HAND_SIZE && !isCurrentTurn) {
      throw new GameError('not_your_turn', 'Can only call Uno on your turn');
    }
    throw new GameError('bad_action', 'Cannot call Uno with this hand size');
  }

  player.saidUno = true;
  if (player.hand.length === UNO_VULNERABLE_HAND_SIZE && state.vulnerableId === userId) {
    state.vulnerableId = null;
  }
  appendGameLog(state.log, `${player.ref.name} called UNO!`);
  ctx.emitEvent('uno', { userId });
  ctx.emitState();
}

/** Handles catching a vulnerable opponent who failed to call Uno. */
function handleCatch(state: UnoGameState, ctx: GameContext, userId: string, rng: () => number): void {
  if (state.phase !== 'playing') throw new GameError('bad_phase', 'Game is not playing');
  const caller = state.players.find((p) => p.ref.userId === userId);
  if (!caller) throw new GameError('bad_action', 'Only seated players can catch');
  if (!state.vulnerableId) throw new GameError('bad_action', 'No player is vulnerable');
  if (state.vulnerableId === userId) throw new GameError('bad_action', 'Cannot catch yourself');

  const victim = state.players.find((p) => p.ref.userId === state.vulnerableId);
  if (!victim) {
    state.vulnerableId = null;
    throw new GameError('bad_action', 'Vulnerable player not found');
  }

  const penalty = drawCards(state.drawPile, state.discardPile, CATCH_PENALTY_CARDS_COUNT, rng);
  victim.hand.push(...penalty);
  if (victim.hand.length > 1) victim.saidUno = false;
  const victimId = state.vulnerableId;
  state.vulnerableId = null;

  appendGameLog(state.log, `${caller.ref.name} caught ${victim.ref.name}!`);
  ctx.emitEvent('caught', { userId, victimId });
  ctx.emitState();
}

/** Creates an Uno game instance wired to room events and session lifecycle. */
export function createUnoGame(
  ctx: GameContext,
  rng: () => number = Math.random,
  testHooks?: UnoTestHooks,
): GameInstance {
  const state = createInitialUnoState();

  return {
    onJoin(p: GamePlayerRef, intent: unknown) { handleJoin(state, ctx, p, intent); },
    onLeave(userId: string) { handleLeave(state, ctx, userId); },
    onAction(userId: string, action: unknown) {
      if (!action || typeof action !== 'object' || typeof (action as any).type !== 'string') {
        throw new GameError('bad_action', 'Invalid action');
      }
      const act = action as { type: string; cardId?: number; color?: Color };
      switch (act.type) {
        case 'start': handleStart(state, ctx, userId, rng, testHooks); break;
        case 'again': handleAgain(state, ctx, userId); break;
        case 'play': handlePlay(state, ctx, userId, act.cardId, act.color); break;
        case 'draw': handleDraw(state, ctx, userId, rng); break;
        case 'pass': handlePass(state, ctx, userId); break;
        case 'uno': handleUno(state, ctx, userId); break;
        case 'catch': handleCatch(state, ctx, userId, rng); break;
        default: throw new GameError('bad_action', `Unknown action: ${act.type}`);
      }
    },
    view(userId: string): UnoView { return buildUnoView(state, userId); },
    dispose() {},
  };
}
