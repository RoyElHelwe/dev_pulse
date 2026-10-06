import { Controller, Get, Query } from '@nestjs/common';
import { numberedDesks } from './layout/geometry';
import { DEFAULT_TEAM, TEMPLATES } from './templates';

@Controller('office')
export class OfficeController {
  /**
   * The office templates offered when creating a workspace (with their layout, for the preview).
   * `team` and `seed` (the office name) shape the generated office, as it will be built.
   */
  @Get('templates')
  templates(@Query('team') team?: string, @Query('seed') seed?: string) {
    const teamSize = Math.min(100, Math.max(1, Math.round(Number(team)) || DEFAULT_TEAM));
    return TEMPLATES.map((t) => {
      const layout = t.build(teamSize, typeof seed === 'string' ? seed.slice(0, 40) : undefined);
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
