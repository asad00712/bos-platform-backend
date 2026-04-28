import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import * as crypto from 'node:crypto';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from '@bos/redis';
import { CorePrismaService } from '@bos/database';
import { LeadWebhookRepository } from '../repositories/lead-webhook.repository';
import type { CreateLeadWebhookDto, UpdateLeadWebhookDto, LeadWebhookResponseDto } from '../dto/lead-webhook.dto';

/** Redis key pattern for webhook token → "tenantId|schemaName" lookup */
const webhookRedisKey = (token: string) => `bos:webhook_token:${token}`;

@Injectable()
export class LeadWebhookService {
  constructor(
    private readonly repository: LeadWebhookRepository,
    private readonly corePrisma: CorePrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async listWebhooks(tenantId: string, branchId?: string): Promise<LeadWebhookResponseDto[]> {
    const schemaName = await this.getSchemaName(tenantId);
    return this.repository.findAll(schemaName, branchId);
  }

  async createWebhook(tenantId: string, dto: CreateLeadWebhookDto): Promise<LeadWebhookResponseDto> {
    const schemaName = await this.getSchemaName(tenantId);
    const token = crypto.randomBytes(32).toString('hex');
    const webhook = await this.repository.create(schemaName, dto, token);
    // Cache token → lookup value in Redis (no TTL — webhooks are long-lived)
    await this.redis.set(webhookRedisKey(token), `${tenantId}|${schemaName}`);
    return webhook;
  }

  async updateWebhook(tenantId: string, id: string, dto: UpdateLeadWebhookDto): Promise<LeadWebhookResponseDto> {
    const schemaName = await this.getSchemaName(tenantId);
    const existing = await this.repository.findById(schemaName, id);
    if (!existing) throw new NotFoundException('Webhook not found');
    return this.repository.update(schemaName, id, dto);
  }

  async deleteWebhook(tenantId: string, id: string): Promise<void> {
    const schemaName = await this.getSchemaName(tenantId);
    const existing = await this.repository.findById(schemaName, id);
    if (!existing) throw new NotFoundException('Webhook not found');
    await this.repository.delete(schemaName, id);
    await this.redis.del(webhookRedisKey(existing.token));
  }

  async regenerateToken(tenantId: string, id: string): Promise<LeadWebhookResponseDto> {
    const schemaName = await this.getSchemaName(tenantId);
    const existing = await this.repository.findById(schemaName, id);
    if (!existing) throw new NotFoundException('Webhook not found');

    const newToken = crypto.randomBytes(32).toString('hex');
    const updated = await this.repository.updateToken(schemaName, id, newToken);

    // Atomically swap Redis keys
    await Promise.all([
      this.redis.del(webhookRedisKey(existing.token)),
      this.redis.set(webhookRedisKey(newToken), `${tenantId}|${schemaName}`),
    ]);

    return updated;
  }

  /**
   * Resolves a webhook token to its tenant context.
   * Used by the public ingestion endpoint.
   * Returns null if the token is unknown or inactive.
   */
  async resolveToken(token: string): Promise<{
    tenantId: string;
    schemaName: string;
    webhook: LeadWebhookResponseDto;
  } | null> {
    // 1. Fast Redis lookup — avoids scanning all tenant schemas
    const cached = await this.redis.get(webhookRedisKey(token));
    if (!cached) return null;

    const [tenantId, schemaName] = cached.split('|');
    if (!tenantId || !schemaName) return null;

    // 2. Verify webhook is still active in DB
    const webhook = await this.repository.findByToken(schemaName, token);
    if (!webhook || !webhook.isActive) return null;

    return { tenantId, schemaName, webhook };
  }

  private async getSchemaName(tenantId: string): Promise<string> {
    const tenant = await this.corePrisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { schemaName: true },
    });
    return tenant.schemaName;
  }
}
