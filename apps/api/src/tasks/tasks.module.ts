import { Module } from '@nestjs/common';
import { OfficeModule } from '../office/office.module';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

/** Issue tracker / Kanban tasks of a workspace. */
@Module({
  imports: [OfficeModule],
  controllers: [TasksController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
