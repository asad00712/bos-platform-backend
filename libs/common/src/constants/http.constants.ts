export const REQUEST_ID_HEADER = 'x-request-id';
export const CORRELATION_ID_HEADER = 'x-correlation-id';
export const TENANT_ID_HEADER = 'x-tenant-id';

export const REQUEST_CONTEXT_KEYS = {
  USER: 'user',
  TENANT_ID: 'tenantId',
  SESSION_ID: 'sessionId',
  CORRELATION_ID: 'correlationId',
  REQUEST_ID: 'requestId',
} as const;
