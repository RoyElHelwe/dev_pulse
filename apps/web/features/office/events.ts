import type { ZoneType } from '@/game/layout/types';

// Contract C3 (docs/PLAN.md): the game emits these, features listen to them.
// Proximity: game/systems/Proximity.ts. Interactions: game/systems/Interactions.ts.

export interface ZoneEvent {
  type: ZoneType;
  id: string;
  name: string;
}

export interface OfficeEventMap {
  'zone:enter': ZoneEvent;
  'zone:leave': ZoneEvent;
  'player:near': { userId: string; distance: number };
  'player:distance': { userId: string; distance: number };
  'player:far': { userId: string };
  /** E pressed next to something. Desks: `ownerId` = who sits there (null = free desk). */
  'object:interact': { type: 'desk' | 'board' | 'kanban'; id: string; name: string; ownerId?: string | null };
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

export const officeEvents = new TypedEmitter<OfficeEventMap>();
