/** Wires the task board; imports OfficeModule to broadcast live task events and KitchenModule to pay for closed tasks. */
import { Module } from '@nestjs/common';
import { KitchenModule } from '../kitchen/kitchen.module';
import { OfficeModule } from '../office/office.module';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

/** Issue tracker / Kanban tasks of a workspace. */
@Module({
  imports: [OfficeModule, KitchenModule],
  controllers: [TasksController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
