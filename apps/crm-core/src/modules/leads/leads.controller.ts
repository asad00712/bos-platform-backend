import {
  Body, Controller, Delete, Get, HttpCode, Param,
  ParseUUIDPipe, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import {
  CurrentUser, RequirePermission, TenantScopeGuard,
  type TenantAuthenticatedUser,
} from '@bos/auth-client';
import { LeadService } from './services/lead.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { LeadFilterDto } from './dto/lead-filter.dto';
import { ConvertLeadDto } from './dto/convert-lead.dto';
import type { LeadDto, LeadListResponseDto } from './dto/lead.response.dto';

@ApiTags('Leads')
@ApiBearerAuth('bearer')
@Controller('leads')
@UseGuards(ThrottlerGuard, TenantScopeGuard)
export class LeadsController {
  constructor(private readonly service: LeadService) {}

  @Get()
  @HttpCode(200)
  @RequirePermission('tenant:leads:view_branch')
  @ApiOperation({ summary: 'List leads (paginated)' })
  listLeads(
    @CurrentUser() user: TenantAuthenticatedUser,
    @Query() filter: LeadFilterDto,
  ): Promise<LeadListResponseDto> {
    return this.service.listLeads(user.tenantId, filter);
  }

  @Get(':id')
  @HttpCode(200)
  @RequirePermission('tenant:leads:view_branch')
  @ApiOperation({ summary: 'Get a lead by ID' })
  getLead(
    @CurrentUser() user: TenantAuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<LeadDto> {
    return this.service.getLead(user.tenantId, id);
  }

  @Post()
  @HttpCode(201)
  @RequirePermission('tenant:leads:create')
  @ApiOperation({ summary: 'Create a new lead' })
  createLead(
    @CurrentUser() user: TenantAuthenticatedUser,
    @Body() dto: CreateLeadDto,
  ): Promise<LeadDto> {
    return this.service.createLead(user.tenantId, dto, user.userId);
  }

  @Patch(':id')
  @HttpCode(200)
  @RequirePermission('tenant:leads:update')
  @ApiOperation({ summary: 'Update a lead' })
  updateLead(
    @CurrentUser() user: TenantAuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLeadDto,
  ): Promise<LeadDto> {
    return this.service.updateLead(user.tenantId, id, dto, user.userId);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission('tenant:leads:delete')
  @ApiOperation({ summary: 'Soft-delete a lead' })
  async deleteLead(
    @CurrentUser() user: TenantAuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.service.deleteLead(user.tenantId, id);
  }

  @Post(':id/convert')
  @HttpCode(200)
  @RequirePermission('tenant:leads:convert')
  @ApiOperation({
    summary: 'Convert lead to contact',
    description: 'If contactId is omitted, a new contact is auto-created from lead data.',
  })
  convertLead(
    @CurrentUser() user: TenantAuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConvertLeadDto,
  ): Promise<LeadDto> {
    return this.service.convertLead(user.tenantId, id, dto, user.userId);
  }

  // ── Tags ─────────────────────────────────────────────────────────────────

  @Get(':id/tags')
  @HttpCode(200)
  @RequirePermission('tenant:leads:view_branch')
  @ApiOperation({ summary: 'List tags on a lead' })
  getLeadTags(
    @CurrentUser() user: TenantAuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.getLeadTags(user.tenantId, id);
  }

  @Post(':id/tags/:tagId')
  @HttpCode(201)
  @RequirePermission('tenant:leads:update')
  @ApiOperation({ summary: 'Add a tag to a lead' })
  async addTag(
    @CurrentUser() user: TenantAuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('tagId', ParseUUIDPipe) tagId: string,
  ): Promise<void> {
    await this.service.addTag(user.tenantId, id, tagId);
  }

  @Delete(':id/tags/:tagId')
  @HttpCode(204)
  @RequirePermission('tenant:leads:update')
  @ApiOperation({ summary: 'Remove a tag from a lead' })
  async removeTag(
    @CurrentUser() user: TenantAuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('tagId', ParseUUIDPipe) tagId: string,
  ): Promise<void> {
    await this.service.removeTag(user.tenantId, id, tagId);
  }
}
