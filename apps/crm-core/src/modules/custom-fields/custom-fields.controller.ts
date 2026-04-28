import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import {
  CurrentUser,
  RequirePermission,
  TenantScopeGuard,
  type TenantAuthenticatedUser,
} from '@bos/auth-client';
import { CustomFieldService } from './services/custom-field.service';
import { CreateCustomFieldDto } from './dto/create-custom-field.dto';
import { UpdateCustomFieldDto } from './dto/update-custom-field.dto';
import { ReorderCustomFieldsDto } from './dto/reorder-custom-fields.dto';
import type {
  CustomFieldDefinitionDto,
  CustomFieldListResponseDto,
} from './dto/custom-field.response.dto';

@ApiTags('Custom Fields')
@ApiBearerAuth('bearer')
@Controller('custom-fields')
@UseGuards(ThrottlerGuard, TenantScopeGuard)
export class CustomFieldsController {
  constructor(private readonly service: CustomFieldService) {}

  @Get()
  @HttpCode(200)
  @ApiOperation({ summary: 'List active custom field definitions' })
  @ApiQuery({ name: 'entityType', required: false, enum: ['CONTACT', 'DEAL'] })
  listDefinitions(
    @CurrentUser() user: TenantAuthenticatedUser,
    @Query('entityType') entityType?: string,
  ): Promise<CustomFieldListResponseDto> {
    return this.service.listDefinitions(user.tenantId, entityType);
  }

  @Post()
  @HttpCode(201)
  @RequirePermission('tenant:custom_fields:manage')
  @ApiOperation({ summary: 'Create a custom field definition' })
  createDefinition(
    @CurrentUser() user: TenantAuthenticatedUser,
    @Body() dto: CreateCustomFieldDto,
  ): Promise<CustomFieldDefinitionDto> {
    return this.service.createDefinition(user.tenantId, dto);
  }

  @Patch(':id')
  @HttpCode(200)
  @RequirePermission('tenant:custom_fields:manage')
  @ApiOperation({ summary: 'Update a custom field definition' })
  updateDefinition(
    @CurrentUser() user: TenantAuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCustomFieldDto,
  ): Promise<CustomFieldDefinitionDto> {
    return this.service.updateDefinition(user.tenantId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission('tenant:custom_fields:manage')
  @ApiOperation({ summary: 'Deactivate (soft-delete) a custom field definition' })
  async deactivateDefinition(
    @CurrentUser() user: TenantAuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.service.deactivateDefinition(user.tenantId, id);
  }

  @Put('reorder')
  @HttpCode(204)
  @RequirePermission('tenant:custom_fields:manage')
  @ApiOperation({ summary: 'Bulk update displayOrder for custom field definitions' })
  async reorderDefinitions(
    @CurrentUser() user: TenantAuthenticatedUser,
    @Body() dto: ReorderCustomFieldsDto,
  ): Promise<void> {
    await this.service.reorderDefinitions(user.tenantId, dto);
  }
}
