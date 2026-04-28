import { Inject, Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from '@bos/redis';
import { TenantPrismaService } from '@bos/database';
import {
  QUEUE_NAMES,
  WORKFLOW_JOB_NAMES,
  type LeadCreatedJobPayload,
  type LeadAssignedJobPayload,
} from '@bos/queue';
import { LeadAssignmentConfigRepository } from '../repositories/lead-assignment-config.repository';

@Processor(QUEUE_NAMES.WORKFLOW)
export class LeadAssignmentProcessor extends WorkerHost {
  private readonly logger = new Logger(LeadAssignmentProcessor.name);

  constructor(
    private readonly configRepository: LeadAssignmentConfigRepository,
    private readonly tenantPrisma: TenantPrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @InjectQueue(QUEUE_NAMES.WORKFLOW) private readonly workflowQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<unknown>): Promise<unknown> {
    if (job.name === WORKFLOW_JOB_NAMES.LEAD_CREATED) {
      return this.handleLeadCreated(job as Job<LeadCreatedJobPayload>);
    }
    // Other workflow jobs handled by their own processors in future modules
    return undefined;
  }

  private async handleLeadCreated(job: Job<LeadCreatedJobPayload>): Promise<void> {
    const { tenantId, schemaName, leadId, contactId, branchId } = job.data;

    // 1. Get assignment config for this branch
    const config = await this.configRepository.findByBranch(schemaName, branchId);
    if (!config || !config.isActive || config.assignmentMode !== 'ROUND_ROBIN') {
      return; // Auto-assignment not configured or disabled for this branch
    }

    // 2. Get eligible agents (role in eligibleRoleIds + roundRobinAvailable=true)
    const agents = await this.configRepository.findEligibleAgents(
      schemaName,
      branchId,
      config.eligibleRoleIds,
    );
    if (agents.length === 0) {
      this.logger.warn(`No eligible agents for round-robin in branch ${branchId}`);
      return;
    }

    // 3. Atomic round-robin via Redis INCR — O(1), no race conditions
    const redisKey = `bos:rr:leads:${tenantId}:${branchId}`;
    const counter = await this.redis.incr(redisKey);
    const assignedUserId = agents[(counter - 1) % agents.length];

    // 4. Update lead.ownedByUserId
    const prisma = this.tenantPrisma.forSchema(schemaName);
    await prisma.lead.update({
      where: { id: leadId },
      data: { ownedByUserId: assignedUserId },
    });

    // 5. Emit crm.lead.assigned — Automation module will handle notifications
    await this.workflowQueue.add(
      WORKFLOW_JOB_NAMES.LEAD_ASSIGNED,
      {
        tenantId,
        schemaName,
        leadId,
        contactId,
        branchId,
        assignedUserId,
      } satisfies LeadAssignedJobPayload,
    );

    this.logger.log(`Lead ${leadId} assigned to agent ${assignedUserId} (counter: ${counter})`);
  }
}
