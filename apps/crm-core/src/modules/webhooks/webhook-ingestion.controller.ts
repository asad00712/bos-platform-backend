import {
  Body, Controller, HttpCode, NotFoundException, Param, Post, UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Public } from '@bos/auth-client';
import { LeadWebhookService } from './services/lead-webhook.service';
import { LeadService } from '../leads/services/lead.service';
import type { LeadDto } from '../leads/dto/lead.response.dto';

/**
 * Public lead ingestion endpoint — no JWT required.
 * Callers authenticate via a per-webhook token embedded in the URL.
 *
 * Phase 1: fixed field mapping (firstName/lastName/email/phone/company/notes).
 * Phase 2: configurable JSON field mapping per webhook.
 *
 * Common field aliases are tried in order so payloads from Facebook Lead Ads,
 * Typeform, and generic HTML forms all work out of the box without configuration.
 */
@ApiTags('Webhooks (Public)')
@Controller('webhooks')
@UseGuards(ThrottlerGuard)
export class WebhookIngestionController {
  constructor(
    private readonly webhookService: LeadWebhookService,
    private readonly leadService: LeadService,
  ) {}

  @Post('leads/:token')
  @HttpCode(201)
  @Public()
  @ApiOperation({
    summary: 'Ingest a lead from an external source (web form, Zapier, etc.)',
    description: 'Token in URL identifies the tenant + branch + source. No JWT required.',
  })
  async ingestLead(
    @Param('token') token: string,
    @Body() payload: Record<string, unknown>,
  ): Promise<LeadDto> {
    // 1. Resolve token → tenant context
    const context = await this.webhookService.resolveToken(token);
    if (!context) throw new NotFoundException('Webhook not found or inactive');

    const { tenantId, webhook } = context;

    // 2. Map payload to CreateLeadDto — try common field name variants
    const firstName = this.pick(payload, ['firstName', 'first_name', 'name', 'full_name']) ?? 'Unknown';
    const lastName  = this.pick(payload, ['lastName', 'last_name']);
    const email     = this.pick(payload, ['email', 'email_address', 'e_mail']);
    const phone     = this.pick(payload, ['phone', 'phone_number', 'mobile', 'mobile_number', 'tel']);
    const company   = this.pick(payload, ['company', 'company_name', 'organization', 'business']);
    const notes     = this.pick(payload, ['notes', 'message', 'comments', 'description', 'note']);

    return this.leadService.createLead(
      tenantId,
      {
        branchId:  webhook.branchId,
        firstName,
        lastName:  lastName  ?? undefined,
        email:     email     ?? undefined,
        phone:     phone     ?? undefined,
        company:   company   ?? undefined,
        sourceId:  webhook.sourceId ?? undefined,
        notes:     notes     ?? undefined,
      },
      'webhook', // system actor — no real userId
    );
  }

  /** Tries each key in order, returns first string value found. */
  private pick(payload: Record<string, unknown>, keys: string[]): string | null {
    for (const key of keys) {
      const val = payload[key];
      if (typeof val === 'string' && val.trim().length > 0) return val.trim();
    }
    return null;
  }
}
