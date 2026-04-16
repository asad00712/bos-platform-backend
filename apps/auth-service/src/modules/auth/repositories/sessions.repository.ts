import { Injectable } from '@nestjs/common';
import type { Prisma, Session } from '@bos-prisma/core';
import { CorePrismaService } from '@bos/database';
import type { SessionEndReason } from '@bos/common';

@Injectable()
export class SessionsRepository {
  constructor(private readonly prisma: CorePrismaService) {}

  async create(data: Prisma.SessionCreateInput): Promise<Session> {
    return this.prisma.session.create({ data });
  }

  async findById(id: string): Promise<Session | null> {
    return this.prisma.session.findUnique({ where: { id } });
  }

  async touch(id: string): Promise<void> {
    await this.prisma.session.update({
      where: { id },
      data: { lastActiveAt: new Date() },
    });
  }

  async end(id: string, reason: SessionEndReason): Promise<void> {
    await this.prisma.session.update({
      where: { id },
      data: { endedAt: new Date(), endReason: reason },
    });
  }

  async endAllForUser(userId: string, reason: SessionEndReason): Promise<void> {
    await this.prisma.session.updateMany({
      where: { userId, endedAt: null },
      data: { endedAt: new Date(), endReason: reason },
    });
  }
}
