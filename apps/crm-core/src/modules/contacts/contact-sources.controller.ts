import {
  Body, Controller, Delete, Get, HttpCode, Param,
  ParseUUIDPipe, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import {
  CurrentUser, RequirePermission, TenantScopeGuard,
  type TenantAuthenticatedUser,
} from '@bos/auth-client';
import { ContactSourceService } from './services/contact-source.service';
import { CreateContactSourceDto } from './dto/create-contact-source.dto';
import { UpdateContactSourceDto } from './dto/update-contact-source.dto';
import type { ContactSourceDto, ContactSourceListDto } from './dto/contact.response.dto';

@ApiTags('Contact Sources')
@ApiBearerAuth('bearer')
@Controller('contact-sources')
@UseGuards(ThrottlerGuard, TenantScopeGuard)
export class ContactSourcesController {
  constructor(private readonly service: ContactSourceService) {}

  @Get()
  @HttpCode(200)
  @ApiOperation({ summary: 'List contact sources (also used by leads)' })
  @ApiQuery({ name: 'branchId', required: false })
  listSources(
    @CurrentUser() user: TenantAuthenticatedUser,
    @Query('branchId') branchId?: string,
  ): Promise<ContactSourceListDto> {
    return this.service.listSources(user.tenantId, branchId);
  }

  @Post()
  @HttpCode(201)
  @RequirePermission('tenant:sources:manage')
  @ApiOperation({ summary: 'Create a new contact source' })
  createSource(
    @CurrentUser() user: TenantAuthenticatedUser,
    @Body() dto: CreateContactSourceDto,
  ): Promise<ContactSourceDto> {
    return this.service.createSource(user.tenantId, dto);
  }

  @Patch(':id')
  @HttpCode(200)
  @RequirePermission('tenant:sources:manage')
  @ApiOperation({ summary: 'Update a contact source' })
  updateSource(
    @CurrentUser() user: TenantAuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateContactSourceDto,
  ): Promise<ContactSourceDto> {
    return this.service.updateSource(user.tenantId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission('tenant:sources:manage')
  @ApiOperation({ summary: 'Delete a contact source (sets sourceId to null on linked contacts/leads)' })
  async deleteSource(
    @CurrentUser() user: TenantAuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.service.deleteSource(user.tenantId, id);
  }
}
