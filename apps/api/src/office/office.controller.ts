import { Controller, Get } from '@nestjs/common';
import { numberedDesks } from './layout/geometry';
import { TEMPLATES } from './templates';

@Controller('office')
export class OfficeController {
  /** The office templates offered when creating a workspace (with their layout, for the preview). */
  @Get('templates')
  templates() {
    return TEMPLATES.map((t) => {
      const layout = t.build();
      return {
        id: t.id,
        name: t.name,
        description: t.description,
        minTeam: t.minTeam,
        maxTeam: t.maxTeam,
        desks: numberedDesks(layout).length,
        meetingRooms: layout.rooms.filter((r) => r.kind === 'meeting').length,
        layout,
      };
    });
  }
}
