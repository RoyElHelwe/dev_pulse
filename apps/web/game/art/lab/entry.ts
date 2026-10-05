// Entry point of the art lab page (see lab.html for how to build it).
import { TEMPLATES } from '../../../../api/src/office/templates';
import type { OfficeLayout } from '../../layout/types';
import { mountLab } from './lab';

mountLab(TEMPLATES.map((t) => ({ id: t.id, name: t.name, layout: t.build() as OfficeLayout })));
