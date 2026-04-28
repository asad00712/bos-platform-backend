import { Module } from '@nestjs/common';
import { TagsController } from './tags.controller';
import { TagService } from './services/tag.service';
import { TagRepository } from './repositories/tag.repository';

@Module({
  controllers: [TagsController],
  providers: [TagService, TagRepository],
  exports: [TagService, TagRepository],
})
export class TagsModule {}
