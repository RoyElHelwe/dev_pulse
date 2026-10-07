import type { GameContext, GameInstance, GamePlayerRef } from '../game.types';
import { GameError } from '../game.types';
import {
  type Card,
  type Color,
  COLORS,
  type UnoPlayer,
  type UnoSpectator,
  type UnoView,
  buildDeck,
  getNextPlayerIndex,
  isNumberCard,
  isPlayable,
  shuffle,
} from './uno.rules';

export interface InternalUnoPlayer {
  ref: GamePlayerRef;
  hand: Card[];
  saidUno: boolean;
}

export interface InternalUnoSpectator {
  ref: GamePlayerRef;
}

export interface UnoTestHooks {
  initialDeck?: Card[];
}

export function createUnoGame(
  ctx: GameContext,
  rng: () => number = Math.random,
  testHooks?: UnoTestHooks,
): GameInstance {
  let phase: 'lobby' | 'playing' | 'ended' = 'lobby';
  let players: InternalUnoPlayer[] = [];
  let spectators: InternalUnoSpectator[] = [];
  let drawPile: Card[] = [];
  let discardPile: Card[] = [];
  let currentColor: Color | null = null;
  let direction: 1 | -1 = 1;
  let turnIndex: number = 0;
  let pendingDraw: number = 0;
  let pendingKind: 'draw2' | 'draw4' | null = null;
  let drewCardId: number | null = null;
  let vulnerableId: string | null = null;
  let winnerId: string | null = null;
  const log: string[] = [];

  function addLog(message: string) {
    log.push(message);
    if (log.length > 8) {
      log.splice(0, log.length - 8);
    }
  }

  function drawCards(count: number): Card[] {
    const drawn: Card[] = [];
    for (let i = 0; i < count; i++) {
      if (drawPile.length === 0) {
        if (discardPile.length > 1) {
          const top = discardPile.pop()!;
          const recycled = shuffle(discardPile, rng);
          discardPile.length = 0;
          discardPile.push(top);
          drawPile.push(...recycled);
        }
      }
      if (drawPile.length > 0) {
        drawn.push(drawPile.pop()!);
      } else {
        break;
      }
    }
    return drawn;
  }

  return {
    onJoin(p: GamePlayerRef, intent: unknown) {
      const existingPlayer = players.find((pl) => pl.ref.userId === p.userId);
      if (existingPlayer) {
        existingPlayer.ref = p;
        ctx.emitState();
        return;
      }

      const isWatch =
        typeof intent === 'object' && intent !== null && (intent as any).watch === true;

      const spectatorIdx = spectators.findIndex((sp) => sp.ref.userId === p.userId);
      if (spectatorIdx !== -1) {
        if (phase === 'lobby' && !isWatch && players.length < 6) {
          spectators.splice(spectatorIdx, 1);
          players.push({ ref: p, hand: [], saidUno: false });
        } else {
          spectators[spectatorIdx].ref = p;
        }
        ctx.emitState();
        return;
      }

      if (isWatch || phase !== 'lobby' || players.length >= 6) {
        spectators.push({ ref: p });
      } else {
        players.push({ ref: p, hand: [], saidUno: false });
      }
      ctx.emitState();
    },

    onLeave(userId: string, _reason: 'left' | 'far' | 'disconnected') {
      const spectatorIdx = spectators.findIndex((s) => s.ref.userId === userId);
      if (spectatorIdx !== -1) {
        spectators.splice(spectatorIdx, 1);
        ctx.emitState();
        return;
      }

      const playerIdx = players.findIndex((p) => p.ref.userId === userId);
      if (playerIdx === -1) {
        return;
      }

      const leavingPlayer = players[playerIdx];
      addLog(`${leavingPlayer.ref.name} left`);

      if (phase === 'lobby' || phase === 'ended') {
        players.splice(playerIdx, 1);
        ctx.emitState();
        return;
      }

      // phase === 'playing'
      drawPile.unshift(...leavingPlayer.hand);
      if (vulnerableId === userId) {
        vulnerableId = null;
      }

      const wasTheirTurn = turnIndex === playerIdx;
      players.splice(playerIdx, 1);

      if (players.length < 2) {
        if (players.length === 1) {
          const winner = players[0];
          phase = 'ended';
          winnerId = winner.ref.userId;
          turnIndex = 0;
          drewCardId = null;
          pendingDraw = 0;
          pendingKind = null;
          vulnerableId = null;
          addLog(`${winner.ref.name} won!`);
          ctx.record({
            winners: [winner.ref.userId],
            losers: [],
          }).catch(() => {});
          ctx.emitEvent('won', { userId: winner.ref.userId });
        } else {
          phase = 'ended';
          winnerId = null;
          turnIndex = 0;
          drewCardId = null;
          pendingDraw = 0;
          pendingKind = null;
          vulnerableId = null;
        }
        ctx.emitState();
        return;
      }

      if (wasTheirTurn) {
        drewCardId = null;
        if (direction === 1) {
          turnIndex = playerIdx % players.length;
        } else {
          turnIndex = (playerIdx - 1 + players.length) % players.length;
        }
        ctx.emitEvent('turn', { userId: players[turnIndex].ref.userId });
      } else if (playerIdx < turnIndex) {
        turnIndex--;
      }

      ctx.emitState();
    },

    onAction(userId: string, action: unknown) {
      if (!action || typeof action !== 'object' || typeof (action as any).type !== 'string') {
        throw new GameError('bad_action', 'Invalid action');
      }

      const act = action as { type: string; cardId?: number; color?: Color };

      switch (act.type) {
        case 'start': {
          if (phase === 'playing') {
            throw new GameError('bad_phase', 'Game already playing');
          }
          const hostId = players[0]?.ref.userId ?? null;
          if (userId !== hostId) {
            throw new GameError('not_host', 'Only host can start');
          }
          if (players.length < 2) {
            throw new GameError('need_players', 'Need at least 2 players to start');
          }
          if (players.length > 6) {
            throw new GameError('need_players', 'Maximum 6 players allowed');
          }

          drawPile = testHooks?.initialDeck
            ? [...testHooks.initialDeck]
            : shuffle(buildDeck(), rng);
          discardPile = [];

          for (const p of players) {
            p.hand = drawCards(7);
            p.saidUno = false;
          }

          let firstTop = drawCards(1)[0];
          while (!isNumberCard(firstTop)) {
            drawPile.unshift(firstTop);
            drawPile = shuffle(drawPile, rng);
            firstTop = drawCards(1)[0];
          }

          discardPile = [firstTop];
          currentColor = firstTop.color as Color;
          direction = 1;
          turnIndex = 0;
          pendingDraw = 0;
          pendingKind = null;
          drewCardId = null;
          vulnerableId = null;
          winnerId = null;
          phase = 'playing';

          addLog('Game started');
          ctx.emitEvent('turn', { userId: players[0].ref.userId });
          ctx.emitState();
          break;
        }

        case 'again': {
          if (phase !== 'ended') {
            throw new GameError('bad_phase', 'Game not ended');
          }
          const hostId = players[0]?.ref.userId ?? null;
          if (userId !== hostId) {
            throw new GameError('not_host', 'Only host can restart');
          }

          const allJoined = [...players.map((p) => p.ref), ...spectators.map((s) => s.ref)];
          players = allJoined.slice(0, 6).map((ref) => ({ ref, hand: [], saidUno: false }));
          spectators = allJoined.slice(6).map((ref) => ({ ref }));

          phase = 'lobby';
          drawPile = [];
          discardPile = [];
          currentColor = null;
          direction = 1;
          turnIndex = 0;
          pendingDraw = 0;
          pendingKind = null;
          drewCardId = null;
          vulnerableId = null;
          winnerId = null;

          addLog('Returned to lobby');
          ctx.emitState();
          break;
        }

        case 'play': {
          if (phase !== 'playing') {
            throw new GameError('bad_phase', 'Game is not playing');
          }
          if (userId !== players[turnIndex]?.ref.userId) {
            throw new GameError('not_your_turn', 'Not your turn');
          }
          if (typeof act.cardId !== 'number') {
            throw new GameError('bad_card', 'Invalid cardId');
          }

          const player = players[turnIndex];
          const cardIdx = player.hand.findIndex((c) => c.id === act.cardId);
          if (cardIdx === -1) {
            throw new GameError('bad_card', 'Card not in hand');
          }

          const card = player.hand[cardIdx];
          if (drewCardId !== null && card.id !== drewCardId) {
            throw new GameError('illegal_play', 'Can only play the drawn card');
          }

          const top = discardPile[discardPile.length - 1];
          if (!isPlayable(card, top, currentColor, pendingDraw, pendingKind)) {
            throw new GameError('illegal_play', 'Card cannot be played');
          }

          if (card.color === 'wild') {
            if (!act.color || !COLORS.includes(act.color)) {
              throw new GameError('need_color', 'Must specify color for wild card');
            }
          }

          // Taking turn action clears any previous vulnerability
          vulnerableId = null;

          player.hand.splice(cardIdx, 1);
          discardPile.push(card);

          if (card.color === 'wild') {
            currentColor = act.color!;
          } else {
            currentColor = card.color as Color;
          }

          if (card.value === 'draw2') {
            pendingDraw += 2;
            pendingKind = 'draw2';
          } else if (card.value === 'wild4') {
            pendingDraw += 4;
            pendingKind = 'draw4';
          }

          // Check win
          if (player.hand.length === 0) {
            phase = 'ended';
            winnerId = player.ref.userId;
            turnIndex = 0;
            drewCardId = null;
            pendingDraw = 0;
            pendingKind = null;
            vulnerableId = null;
            addLog(`${player.ref.name} won!`);
            ctx.record({
              winners: [winnerId],
              losers: players.filter((p) => p.ref.userId !== winnerId).map((p) => p.ref.userId),
            }).catch(() => {});
            ctx.emitEvent('won', { userId: winnerId });
            ctx.emitEvent('played', { userId, card });
            ctx.emitState();
            return;
          }

          if (player.hand.length === 1 && !player.saidUno) {
            vulnerableId = player.ref.userId;
          }

          drewCardId = null;

          if (card.value === 'skip') {
            turnIndex = getNextPlayerIndex(turnIndex, direction, players.length, 2);
          } else if (card.value === 'reverse') {
            direction = (direction === 1 ? -1 : 1) as 1 | -1;
            if (players.length === 2) {
              turnIndex = getNextPlayerIndex(turnIndex, direction, players.length, 2);
            } else {
              turnIndex = getNextPlayerIndex(turnIndex, direction, players.length, 1);
            }
          } else {
            turnIndex = getNextPlayerIndex(turnIndex, direction, players.length, 1);
          }

          addLog(`${player.ref.name} played ${card.color} ${card.value}`);
          ctx.emitEvent('played', { userId, card });
          ctx.emitEvent('turn', { userId: players[turnIndex].ref.userId });
          ctx.emitState();
          break;
        }

        case 'draw': {
          if (phase !== 'playing') {
            throw new GameError('bad_phase', 'Game is not playing');
          }
          if (userId !== players[turnIndex]?.ref.userId) {
            throw new GameError('not_your_turn', 'Not your turn');
          }

          vulnerableId = null;

          const player = players[turnIndex];

          if (pendingDraw > 0) {
            const penalty = pendingDraw;
            const drawn = drawCards(penalty);
            player.hand.push(...drawn);
            if (player.hand.length > 1) {
              player.saidUno = false;
            }
            pendingDraw = 0;
            pendingKind = null;
            drewCardId = null;
            turnIndex = getNextPlayerIndex(turnIndex, direction, players.length, 1);

            addLog(`${player.ref.name} drew ${penalty} cards`);
            ctx.emitEvent('drew', { userId, count: penalty });
            ctx.emitEvent('turn', { userId: players[turnIndex].ref.userId });
            ctx.emitState();
            return;
          }

          if (drewCardId !== null) {
            throw new GameError('already_drew', 'Already drew this turn');
          }

          const drawn = drawCards(1);
          if (drawn.length === 0) {
            turnIndex = getNextPlayerIndex(turnIndex, direction, players.length, 1);
            ctx.emitEvent('turn', { userId: players[turnIndex].ref.userId });
            ctx.emitState();
            return;
          }

          const drawnCard = drawn[0];
          player.hand.push(drawnCard);
          if (player.hand.length > 1) {
            player.saidUno = false;
          }

          const top = discardPile[discardPile.length - 1];
          const playable = isPlayable(drawnCard, top, currentColor, 0, null);

          addLog(`${player.ref.name} drew a card`);
          ctx.emitEvent('drew', { userId, count: 1 });

          if (playable) {
            drewCardId = drawnCard.id;
          } else {
            drewCardId = null;
            turnIndex = getNextPlayerIndex(turnIndex, direction, players.length, 1);
            ctx.emitEvent('turn', { userId: players[turnIndex].ref.userId });
          }

          ctx.emitState();
          break;
        }

        case 'pass': {
          if (phase !== 'playing') {
            throw new GameError('bad_phase', 'Game is not playing');
          }
          if (userId !== players[turnIndex]?.ref.userId) {
            throw new GameError('not_your_turn', 'Not your turn');
          }
          if (drewCardId === null) {
            throw new GameError('must_draw_first', 'Must draw before passing');
          }

          vulnerableId = null;
          const player = players[turnIndex];
          drewCardId = null;
          turnIndex = getNextPlayerIndex(turnIndex, direction, players.length, 1);

          addLog(`${player.ref.name} passed`);
          ctx.emitEvent('turn', { userId: players[turnIndex].ref.userId });
          ctx.emitState();
          break;
        }

        case 'uno': {
          if (phase !== 'playing') {
            throw new GameError('bad_phase', 'Game is not playing');
          }
          const player = players.find((p) => p.ref.userId === userId);
          if (!player) {
            throw new GameError('bad_action', 'Only seated players can call Uno');
          }

          if (player.hand.length === 2) {
            if (userId !== players[turnIndex]?.ref.userId) {
              throw new GameError('not_your_turn', 'Can only call Uno on your turn');
            }
            player.saidUno = true;
          } else if (player.hand.length === 1) {
            player.saidUno = true;
            if (vulnerableId === userId) {
              vulnerableId = null;
            }
          } else {
            throw new GameError('bad_action', 'Cannot call Uno with this hand size');
          }

          addLog(`${player.ref.name} called UNO!`);
          ctx.emitEvent('uno', { userId });
          ctx.emitState();
          break;
        }

        case 'catch': {
          if (phase !== 'playing') {
            throw new GameError('bad_phase', 'Game is not playing');
          }
          const caller = players.find((p) => p.ref.userId === userId);
          if (!caller) {
            throw new GameError('bad_action', 'Only seated players can catch');
          }
          if (!vulnerableId) {
            throw new GameError('bad_action', 'No player is vulnerable');
          }
          if (vulnerableId === userId) {
            throw new GameError('bad_action', 'Cannot catch yourself');
          }

          const victim = players.find((p) => p.ref.userId === vulnerableId);
          if (!victim) {
            vulnerableId = null;
            throw new GameError('bad_action', 'Vulnerable player not found');
          }

          const penalty = drawCards(2);
          victim.hand.push(...penalty);
          if (victim.hand.length > 1) {
            victim.saidUno = false;
          }
          const victimId = vulnerableId;
          vulnerableId = null;

          addLog(`${caller.ref.name} caught ${victim.ref.name}!`);
          ctx.emitEvent('caught', { userId, victimId });
          ctx.emitState();
          break;
        }

        default:
          throw new GameError('bad_action', `Unknown action: ${(action as any).type}`);
      }
    },

    view(userId: string): UnoView {
      const isPlayer = players.some((p) => p.ref.userId === userId);
      const myPlayer = players.find((p) => p.ref.userId === userId);
      const isMyTurn = phase === 'playing' && players[turnIndex]?.ref.userId === userId;

      let hand: Card[] = [];
      let drewCardIdForView: number | null = null;
      let playable: number[] = [];

      const topCard = discardPile.length > 0 ? discardPile[discardPile.length - 1] : null;

      if (isPlayer && myPlayer) {
        hand = myPlayer.hand;
        if (isMyTurn) {
          drewCardIdForView = drewCardId;
          if (drewCardId !== null) {
            const drawnCard = myPlayer.hand.find((c) => c.id === drewCardId);
            if (
              drawnCard &&
              isPlayable(drawnCard, topCard, currentColor, pendingDraw, pendingKind)
            ) {
              playable = [drawnCard.id];
            } else {
              playable = [];
            }
          } else {
            playable = myPlayer.hand
              .filter((c) => isPlayable(c, topCard, currentColor, pendingDraw, pendingKind))
              .map((c) => c.id);
          }
        }
      }

      return {
        phase,
        hostId: players[0]?.ref.userId ?? null,
        role: isPlayer ? 'player' : 'spectator',
        hand,
        players: players.map((p) => ({
          id: p.ref.userId,
          name: p.ref.name,
          character: p.ref.character,
          cards: p.hand.length,
          saidUno: p.saidUno,
        })),
        spectators: spectators.map((s) => ({
          id: s.ref.userId,
          name: s.ref.name,
        })),
        turnId: phase === 'playing' ? (players[turnIndex]?.ref.userId ?? null) : null,
        direction,
        top: topCard,
        currentColor,
        drawPile: drawPile.length,
        pendingDraw,
        pendingKind,
        drewCardId: drewCardIdForView,
        playable,
        vulnerableId,
        winnerId,
        log: [...log],
      };
    },

    dispose() {},
  };
}
