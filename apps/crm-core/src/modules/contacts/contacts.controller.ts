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
import { ContactService } from './services/contact.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { ContactFilterDto } from './dto/contact-filter.dto';
import type { ContactDto, ContactListResponseDto } from './dto/contact.response.dto';

@ApiTags('Contacts')
@ApiBearerAuth('bearer')
@Controller('contacts')
@UseGuards(ThrottlerGuard, TenantScopeGuard)
export class ContactsController {
  constructor(private readonly service: ContactService) {}

  @Get()
  @HttpCode(200)
  @RequirePermission('tenant:contacts:view_branch')
  @ApiOperation({ summary: 'List contacts (paginated)' })
  listContacts(
    @CurrentUser() user: TenantAuthenticatedUser,
    @Query() filter: ContactFilterDto,
  ): Promise<ContactListResponseDto> {
    return this.service.listContacts(user.tenantId, filter);
  }

  @Get(':id')
  @HttpCode(200)
  @RequirePermission('tenant:contacts:view_branch')
  @ApiOperation({ summary: 'Get a contact by ID' })
  getContact(
    @CurrentUser() user: TenantAuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ContactDto> {
    return this.service.getContact(user.tenantId, id);
  }

  @Post()
  @HttpCode(201)
  @RequirePermission('tenant:contacts:create')
  @ApiOperation({ summary: 'Create a new contact' })
  createContact(
    @CurrentUser() user: TenantAuthenticatedUser,
    @Body() dto: CreateContactDto,
  ): Promise<ContactDto> {
    return this.service.createContact(user.tenantId, dto, user.userId);
  }

  @Patch(':id')
  @HttpCode(200)
  @RequirePermission('tenant:contacts:update')
  @ApiOperation({ summary: 'Update a contact' })
  updateContact(
    @CurrentUser() user: TenantAuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateContactDto,
  ): Promise<ContactDto> {
    return this.service.updateContact(user.tenantId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission('tenant:contacts:delete')
  @ApiOperation({ summary: 'Soft-delete a contact' })
  async deleteContact(
    @CurrentUser() user: TenantAuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.service.deleteContact(user.tenantId, id);
  }

  // ── Tags ─────────────────────────────────────────────────────────────────

  @Get(':id/tags')
  @HttpCode(200)
  @RequirePermission('tenant:contacts:view_branch')
  @ApiOperation({ summary: 'List tags on a contact' })
  getContactTags(
    @CurrentUser() user: TenantAuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.getContactTags(user.tenantId, id);
  }

  @Post(':id/tags/:tagId')
  @HttpCode(201)
  @RequirePermission('tenant:contacts:update')
  @ApiOperation({ summary: 'Add a tag to a contact' })
  async addTag(
    @CurrentUser() user: TenantAuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('tagId', ParseUUIDPipe) tagId: string,
  ): Promise<void> {
    await this.service.addTag(user.tenantId, id, tagId);
  }

  @Delete(':id/tags/:tagId')
  @HttpCode(204)
  @RequirePermission('tenant:contacts:update')
  @ApiOperation({ summary: 'Remove a tag from a contact' })
  async removeTag(
    @CurrentUser() user: TenantAuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('tagId', ParseUUIDPipe) tagId: string,
  ): Promise<void> {
    await this.service.removeTag(user.tenantId, id, tagId);
  }
}
