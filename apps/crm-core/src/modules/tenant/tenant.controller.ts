import {
  Body,
  Controller,
  Get,
  HttpCode,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { CurrentUser, TenantScopeGuard, type TenantAuthenticatedUser } from '@bos/auth-client';
import { TenantService } from './services/tenant.service';
import { SelectModulesDto } from './dto/select-modules.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ModuleSuggestionResponseDto } from './dto/module-suggestion.response.dto';
import { TenantConfigResponseDto } from './dto/tenant-config.response.dto';

@ApiTags('Tenant')
@ApiBearerAuth('bearer')
@Controller('tenant')
@UseGuards(ThrottlerGuard, TenantScopeGuard)
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Get('module-suggestions')
  @HttpCode(200)
  @ApiOperation({ summary: 'Get module suggestions for this tenant based on vertical' })
  getModuleSuggestions(
    @CurrentUser() user: TenantAuthenticatedUser,
  ): Promise<ModuleSuggestionResponseDto> {
    return this.tenantService.getModuleSuggestions(user.tenantId);
  }

  @Post('modules')
  @HttpCode(204)
  @ApiOperation({ summary: 'Save selected modules (onboarding or settings)' })
  async selectModules(
    @CurrentUser() user: TenantAuthenticatedUser,
    @Body() dto: SelectModulesDto,
  ): Promise<void> {
    await this.tenantService.selectModules(user.tenantId, dto, user.userId);
  }

  @Get('config')
  @HttpCode(200)
  @ApiOperation({ summary: 'Get tenant config — enabled modules + terminology' })
  getTenantConfig(
    @CurrentUser() user: TenantAuthenticatedUser,
  ): Promise<TenantConfigResponseDto> {
    return this.tenantService.getTenantConfig(user.tenantId);
  }

  @Patch('profile')
  @HttpCode(204)
  @ApiOperation({ summary: 'Update tenant business profile' })
  async updateProfile(
    @CurrentUser() user: TenantAuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<void> {
    await this.tenantService.updateProfile(user.tenantId, dto);
  }
}
