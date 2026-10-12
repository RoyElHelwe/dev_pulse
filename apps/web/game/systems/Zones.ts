/**
 * Zone tracking system detecting player boundary transitions across derived zones.
 * Dispatches zone:enter and zone:leave events and notifies network listeners.
 */

import { officeEvents, type ZoneEvent } from '@/features/office/events';
import { TILE } from '../constants';
import { deriveZones } from '../layout/derive';
import type { OfficeLayout, Zone } from '../layout/types';

/** Converts an internal Zone layout representation into an office event payload. */
function toZoneEvent(zone: Zone): ZoneEvent {
  return { type: zone.type, id: zone.id, name: zone.name };
}

/** Dependencies and callbacks required by the Zones system. */
export interface ZonesOptions {
  layout: OfficeLayout;
  onZone: (zoneId: string | null) => void;
  onChanged?: () => void;
}

/**
 * Tracks player footprint inside derived zones and publishes boundary crossing events.
 */
export class Zones {
  /** All derived office zones computed from the current layout. */
  readonly zones: Zone[];

  private currentZone: Zone | null = null;
  private lastZoneX = NaN;
  private lastZoneY = NaN;
  private readonly onZone: (zoneId: string | null) => void;
  private readonly onChanged?: () => void;

  constructor(opts: ZonesOptions) {
    this.zones = deriveZones(opts.layout);
    this.onZone = opts.onZone;
    this.onChanged = opts.onChanged;
  }

  /** The zone currently occupied by the local player, or null if outside defined zones. */
  get current(): Zone | null {
    return this.currentZone;
  }

  /** The identifier of the currently occupied zone, or null. */
  get currentZoneId(): string | null {
    return this.currentZone?.id ?? null;
  }

  /**
   * Evaluates player feet coordinates and emits zone:leave / zone:enter events
   * if the player has entered or exited a zone boundary.
   */
  update(playerX: number, playerY: number): void {
    if (playerX === this.lastZoneX && playerY === this.lastZoneY) return;
    this.lastZoneX = playerX;
    this.lastZoneY = playerY;
    const px = playerX / TILE;
    const py = playerY / TILE;
    let zone: Zone | null = null;
    for (const z of this.zones) {
      if (px >= z.x && px < z.x + z.w && py >= z.y && py < z.y + z.h) {
        zone = z;
        break;
      }
    }
    if (zone?.id === this.currentZone?.id) return;
    if (this.currentZone) officeEvents.emit('zone:leave', toZoneEvent(this.currentZone));
    if (zone) officeEvents.emit('zone:enter', toZoneEvent(zone));
    this.currentZone = zone;
    this.onZone(zone?.id ?? null);
    this.onChanged?.();
  }

  /** Resets cached coordinates so the next update tick forces zone re-evaluation. */
  resetPosition(): void {
    this.lastZoneX = NaN;
    this.lastZoneY = NaN;
  }

  /** Cleans up zone state and dispatches zone:leave on scene shutdown. */
  destroy(): void {
    this.onZone(null);
    if (this.currentZone) {
      officeEvents.emit('zone:leave', toZoneEvent(this.currentZone));
      this.currentZone = null;
    }
  }
}
