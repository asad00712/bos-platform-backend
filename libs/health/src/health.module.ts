import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { BosHealthController } from './health.controller';

@Module({
  imports: [TerminusModule],
  controllers: [BosHealthController],
})
export class BosHealthModule {}
