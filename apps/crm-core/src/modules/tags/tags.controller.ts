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
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import {
  CurrentUser,
  RequirePermission,
  TenantScopeGuard,
  type TenantAuthenticatedUser,
} from '@bos/auth-client';
import { TagService } from './services/tag.service';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import type { TagDto, TagListResponseDto } from './dto/tag.response.dto';

@ApiTags('Tags')
@ApiBearerAuth('bearer')
@Controller('tags')
@UseGuards(ThrottlerGuard, TenantScopeGuard)
export class TagsController {
  constructor(private readonly service: TagService) {}

  @Get()
  @HttpCode(200)
  @ApiOperation({ summary: 'List all tags in the tenant' })
  @ApiQuery({ name: 'search', required: false })
  listTags(
    @CurrentUser() user: TenantAuthenticatedUser,
    @Query('search') search?: string,
  ): Promise<TagListResponseDto> {
    return this.service.listTags(user.tenantId, search);
  }

  @Post()
  @HttpCode(201)
  @RequirePermission('tenant:tags:manage')
  @ApiOperation({ summary: 'Create a new tag' })
  createTag(
    @CurrentUser() user: TenantAuthenticatedUser,
    @Body() dto: CreateTagDto,
  ): Promise<TagDto> {
    return this.service.createTag(user.tenantId, dto);
  }

  @Patch(':id')
  @HttpCode(200)
  @RequirePermission('tenant:tags:manage')
  @ApiOperation({ summary: 'Update a tag' })
  updateTag(
    @CurrentUser() user: TenantAuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTagDto,
  ): Promise<TagDto> {
    return this.service.updateTag(user.tenantId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission('tenant:tags:manage')
  @ApiOperation({ summary: 'Delete a tag (also removes it from all contacts and leads)' })
  async deleteTag(
    @CurrentUser() user: TenantAuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.service.deleteTag(user.tenantId, id);
  }
}
