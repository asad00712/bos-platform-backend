import { Module } from '@nestjs/common';
import { BosQueueModule, QUEUE_NAMES } from '@bos/queue';
import { TaskController } from './controllers/task.controller';
import { TaskService } from './services/task.service';
import { TaskRepository } from './repositories/task.repository';

@Module({
  imports:     [BosQueueModule.forFeature([{ name: QUEUE_NAMES.MAIL }])],
  controllers: [TaskController],
  providers:   [TaskService, TaskRepository],
  exports:     [TaskService],
})
export class TasksModule {}
