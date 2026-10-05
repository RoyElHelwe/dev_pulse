import type { OfficeLayout } from '../layout/types';
import { campus } from './campus';
import { hq } from './hq';
import { loft } from './loft';
import { studio } from './studio';

export interface OfficeTemplate {
  id: string;
  name: string;
  description: string;
  /** Recommended team size. */
  minTeam: number;
  maxTeam: number;
  build(): OfficeLayout;
}

export const TEMPLATES: OfficeTemplate[] = [
  { id: 'loft', name: 'Loft', description: 'A cosy space for a small team: one meeting room, a kitchen and a lounge.', minTeam: 1, maxTeam: 8, build: loft },
  { id: 'studio', name: 'Studio', description: 'Two glass meeting rooms, a kitchen with a lounge and an open space.', minTeam: 6, maxTeam: 24, build: studio },
  { id: 'campus', name: 'Campus', description: 'A big floor: three meeting rooms, a large lounge and room for 48 desks.', minTeam: 20, maxTeam: 48, build: campus },
  { id: 'hq', name: 'Headquarters', description: 'A whole floor: four meeting rooms, a long lounge with two chill corners and 100 desks.', minTeam: 40, maxTeam: 100, build: hq },
];

export function findTemplate(id: string) {
  return TEMPLATES.find((t) => t.id === id);
}
