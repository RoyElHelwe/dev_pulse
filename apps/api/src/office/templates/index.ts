import type { OfficeLayout } from '../layout/types';
import { campus } from './campus';
import { generatedOffice } from './generated';
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
  /** Only the generated office uses them: the team it's made for, and the seed of its look. */
  build(teamSize?: number, seed?: string): OfficeLayout;
}

/** Team size used when none is given (previews, the art lab). */
export const DEFAULT_TEAM = 12;

export const TEMPLATES: OfficeTemplate[] = [
  {
    id: 'generated',
    name: 'Made for your team',
    description: 'Desks for everyone with room to grow, meeting rooms and a lounge sized to your team.',
    minTeam: 1,
    maxTeam: 100,
    build: (teamSize = DEFAULT_TEAM, seed = 'office') => generatedOffice(teamSize, seed),
  },
  { id: 'loft', name: 'Loft', description: 'A cosy space for a small team: one meeting room, a kitchen and a lounge.', minTeam: 1, maxTeam: 8, build: loft },
  { id: 'studio', name: 'Studio', description: 'Two glass meeting rooms, a kitchen with a lounge and an open space.', minTeam: 6, maxTeam: 24, build: studio },
  { id: 'campus', name: 'Campus', description: 'A big floor: three meeting rooms, a large lounge and room for 48 desks.', minTeam: 20, maxTeam: 48, build: campus },
  { id: 'hq', name: 'Headquarters', description: 'A whole floor: four meeting rooms, a long lounge with two chill corners and 100 desks.', minTeam: 40, maxTeam: 100, build: hq },
];

export function findTemplate(id: string) {
  return TEMPLATES.find((t) => t.id === id);
}
