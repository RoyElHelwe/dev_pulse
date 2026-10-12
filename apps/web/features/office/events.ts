/**
 * Event bus for Phaser game events dispatched to React UI features.
 * Bridges room zones, proximity ranges, and furniture object interactions.
 */

import type { ZoneType } from '@/game/layout/types';

// Contract C3 (docs/PLAN.md): the game emits these, features listen to them.
// Proximity: game/systems/Proximity.ts. Interactions: game/systems/Interactions.ts.

/** Office zone boundary transition event describing the zone category, identifier, and display name. */
export interface ZoneEvent {
  type: ZoneType;
  id: string;
  name: string;
}

/** Type definitions for all Phaser game events dispatched to subscribing React components and hooks. */
export interface OfficeEventMap {
  'zone:enter': ZoneEvent;
  'zone:leave': ZoneEvent;
  'player:near': { userId: string; distance: number };
  'player:distance': { userId: string; distance: number };
  'player:far': { userId: string };
  /** E pressed next to something. Desks: `ownerId` = who sits there (null = free desk). */
  'object:interact': {
    type: 'desk' | 'board' | 'kanban' | 'foosball' | 'uno' | 'lego';
    id: string;
    name: string;
    ownerId?: string | null;
  };
}

type Listener<T> = (payload: T) => void;

class TypedEmitter<Events extends object> {
  private listeners = new Map<keyof Events, Set<Listener<never>>>();

  /** Subscribe; returns an unsubscribe function (handy in useEffect). */
  on<K extends keyof Events>(event: K, listener: Listener<Events[K]>) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(listener as Listener<never>);
    return () => this.off(event, listener);
  }

  off<K extends keyof Events>(event: K, listener: Listener<Events[K]>) {
    this.listeners.get(event)?.delete(listener as Listener<never>);
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]) {
    this.listeners.get(event)?.forEach((listener) => (listener as Listener<Events[K]>)(payload));
  }
}

/** Singleton typed event emitter for in-game office interactions and zone transitions. */
export const officeEvents = new TypedEmitter<OfficeEventMap>();
