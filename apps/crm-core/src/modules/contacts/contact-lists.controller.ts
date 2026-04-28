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
import { ContactListService } from './services/contact-list.service';
import { CreateContactListDto } from './dto/create-contact-list.dto';
import { UpdateContactListDto } from './dto/update-contact-list.dto';
import type { ContactListDto, ContactListListDto } from './dto/contact.response.dto';

@ApiTags('Contact Lists')
@ApiBearerAuth('bearer')
@Controller('contact-lists')
@UseGuards(ThrottlerGuard, TenantScopeGuard)
export class ContactListsController {
  constructor(private readonly service: ContactListService) {}

  @Get()
  @HttpCode(200)
  @RequirePermission('tenant:contacts:view_branch')
  @ApiOperation({ summary: 'List contact lists' })
  @ApiQuery({ name: 'branchId', required: false })
  listContactLists(
    @CurrentUser() user: TenantAuthenticatedUser,
    @Query('branchId') branchId?: string,
  ): Promise<ContactListListDto> {
    return this.service.listContactLists(user.tenantId, branchId);
  }

  @Post()
  @HttpCode(201)
  @RequirePermission('tenant:contact_lists:manage')
  @ApiOperation({ summary: 'Create a contact list' })
  createList(
    @CurrentUser() user: TenantAuthenticatedUser,
    @Body() dto: CreateContactListDto,
  ): Promise<ContactListDto> {
    return this.service.createList(user.tenantId, dto, user.userId);
  }

  @Patch(':id')
  @HttpCode(200)
  @RequirePermission('tenant:contact_lists:manage')
  @ApiOperation({ summary: 'Update a contact list' })
  updateList(
    @CurrentUser() user: TenantAuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateContactListDto,
  ): Promise<ContactListDto> {
    return this.service.updateList(user.tenantId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission('tenant:contact_lists:manage')
  @ApiOperation({ summary: 'Delete a contact list' })
  async deleteList(
    @CurrentUser() user: TenantAuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.service.deleteList(user.tenantId, id);
  }

  @Get(':id/members')
  @HttpCode(200)
  @RequirePermission('tenant:contacts:view_branch')
  @ApiOperation({ summary: 'List contacts in a list (paginated)' })
  @ApiQuery({ name: 'page', required: false }) @ApiQuery({ name: 'limit', required: false })
  listMembers(
    @CurrentUser() user: TenantAuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.service.listMembers(user.tenantId, id, parseInt(page), parseInt(limit));
  }

  @Post(':id/members/:contactId')
  @HttpCode(201)
  @RequirePermission('tenant:contact_lists:manage')
  @ApiOperation({ summary: 'Add a contact to a list' })
  async addMember(
    @CurrentUser() user: TenantAuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('contactId', ParseUUIDPipe) contactId: string,
  ): Promise<void> {
    await this.service.addMember(user.tenantId, id, contactId, user.userId);
  }

  @Delete(':id/members/:contactId')
  @HttpCode(204)
  @RequirePermission('tenant:contact_lists:manage')
  @ApiOperation({ summary: 'Remove a contact from a list' })
  async removeMember(
    @CurrentUser() user: TenantAuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('contactId', ParseUUIDPipe) contactId: string,
  ): Promise<void> {
    await this.service.removeMember(user.tenantId, id, contactId);
  }
}
