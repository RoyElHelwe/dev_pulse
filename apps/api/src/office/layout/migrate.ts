import { isWallMounted, mountWall, snapToWall } from './mount';
import type { Furniture, OfficeLayout } from './types';

export function migrateWallMounted(layout: OfficeLayout): {
  layout: OfficeLayout;
  changed: boolean;
  dropped: string[];
} {
  let changed = false;
  const dropped: string[] = [];
  const nextFurniture: Furniture[] = [];

  for (const item of layout.furniture) {
    if (!isWallMounted(item.kind)) {
      nextFurniture.push(item);
      continue;
    }

    if (mountWall(item, layout.walls) !== null) {
      nextFurniture.push(item);
      continue;
    }

    const snapped = snapToWall(item, layout.walls, 8);
    if (snapped !== null) {
      nextFurniture.push(snapped);
      changed = true;
    } else {
      dropped.push(item.id);
      changed = true;
    }
  }

  return {
    layout: changed ? { ...layout, furniture: nextFurniture } : layout,
    changed,
    dropped,
  };
}
