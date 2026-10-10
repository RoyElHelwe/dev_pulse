// Entry point of the art lab page (see lab.html for how to build it).
import { TEMPLATES } from '../../apps/api/src/office/templates';
import type { OfficeLayout } from '../../apps/web/game/layout/types';
import { mountLab } from './lab';

mountLab(TEMPLATES.map((t) => ({ id: t.id, name: t.name, layout: t.build() as OfficeLayout })));
