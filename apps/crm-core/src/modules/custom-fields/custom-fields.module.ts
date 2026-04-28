import { Module } from '@nestjs/common';
import { CustomFieldsController } from './custom-fields.controller';
import { CustomFieldService } from './services/custom-field.service';
import { CustomFieldRepository } from './repositories/custom-field.repository';

@Module({
  controllers: [CustomFieldsController],
  providers: [CustomFieldService, CustomFieldRepository],
  exports: [CustomFieldService],
})
export class CustomFieldsModule {}
