import type { ISO8601 } from '../types/timestamp.types';
import type { TenantId, UUIDv7, UserId } from '../types/id.types';

export interface BosEvent<TData = unknown> {
  id: UUIDv7;
  type: string;
  source: string;
  specVersion: '1.0';
  time: ISO8601;
  tenantId: TenantId | null;
  actorUserId: UserId | null;
  actorIp: string | null;
  correlationId: UUIDv7;
  causationId: UUIDv7 | null;
  data: TData;
  dataVersion: number;
}
