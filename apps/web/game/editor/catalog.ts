import type { FurnitureKind } from '../layout/types';

/** What the organiser can add from the editor palette, with sensible default sizes (tiles). */
export interface CatalogItem {
  kind: FurnitureKind;
  label: string;
  w: number;
  h: number;
  group: 'Work' | 'Meetings' | 'Lounge' | 'Kitchen' | 'Plants' | 'Games';
  /** Colours offered for this piece (first = default). */
  colors?: number[];
}

const FABRIC = [0x5f7a6b, 0x3d5a80, 0xc9845f, 0x6b5b7a, 0x3f4a5a, 0xb8a48a];
const RUGS = [0xd9cdbb, 0xc8c2d6, 0xb9cbbf, 0xe3c9b6, 0x6b6f73];
const BEANBAGS = [0x4f6d8f, 0xd8b25c, 0xd1495b, 0x81b29a];

export const CATALOG: CatalogItem[] = [
  { kind: 'desk', label: 'Desk', w: 3, h: 1.5, group: 'Work' },
  { kind: 'chair', label: 'Office chair', w: 0.85, h: 0.85, group: 'Work' },
  { kind: 'divider', label: 'Divider', w: 3, h: 0.14, group: 'Work' },
  { kind: 'bookshelf', label: 'Bookshelf', w: 4, h: 0.8, group: 'Work' },
  { kind: 'board', label: 'Kanban board', w: 3, h: 0.5, group: 'Work' },
  { kind: 'meetingTable', label: 'Meeting table', w: 5, h: 2.4, group: 'Meetings' },
  { kind: 'tv', label: 'Screen', w: 3, h: 0.3, group: 'Meetings' },
  { kind: 'sofa', label: 'Sofa', w: 4.5, h: 1.5, group: 'Lounge', colors: FABRIC },
  { kind: 'armchair', label: 'Armchair', w: 1.5, h: 1.4, group: 'Lounge', colors: FABRIC },
  { kind: 'coffeeTable', label: 'Coffee table', w: 2.4, h: 1.2, group: 'Lounge' },
  { kind: 'beanbag', label: 'Beanbag', w: 1.3, h: 1.2, group: 'Lounge', colors: BEANBAGS },
  { kind: 'rug', label: 'Rug', w: 6, h: 4, group: 'Lounge', colors: RUGS },
  { kind: 'floorLamp', label: 'Floor lamp', w: 1, h: 1, group: 'Lounge' },
  { kind: 'counter', label: 'Kitchen counter', w: 6, h: 1.3, group: 'Kitchen' },
  { kind: 'fridge', label: 'Fridge', w: 1.5, h: 1.3, group: 'Kitchen' },
  { kind: 'barTable', label: 'High table', w: 5, h: 1.3, group: 'Kitchen' },
  { kind: 'stool', label: 'Stool', w: 0.7, h: 0.7, group: 'Kitchen' },
  { kind: 'plant', label: 'Plant', w: 1, h: 1, group: 'Plants' },
  { kind: 'plant', label: 'Big plant', w: 1.3, h: 1.3, group: 'Plants' },
  { kind: 'foosball', label: 'Baby foot', w: 3, h: 1.6, group: 'Games' },
  { kind: 'cardTable', label: 'Card table', w: 2.2, h: 2.2, group: 'Games' },
  { kind: 'legoBoard', label: 'Lego wall', w: 3, h: 0.5, group: 'Games' },
];

export function catalogEntry(kind: FurnitureKind) {
  return CATALOG.find((c) => c.kind === kind);
}

// First entry wins (a "plant" is a Plant, not a Big plant).
export const KIND_LABEL = Object.fromEntries(
  [...CATALOG].reverse().map((c) => [c.kind, c.label]),
) as Record<FurnitureKind, string>;
