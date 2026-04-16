import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { CORRELATION_ID_HEADER, REQUEST_ID_HEADER } from '@bos/common';

declare module 'express' {
  interface Request {
    correlationId?: string;
    requestId?: string;
  }
}

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const incomingCorrelationId =
      (req.headers[CORRELATION_ID_HEADER] as string | undefined) ??
      (req.headers[REQUEST_ID_HEADER] as string | undefined);

    const correlationId = incomingCorrelationId ?? randomUUID();
    const requestId = (req.headers[REQUEST_ID_HEADER] as string | undefined) ?? randomUUID();

    req.correlationId = correlationId;
    req.requestId = requestId;

    res.setHeader(CORRELATION_ID_HEADER, correlationId);
    res.setHeader(REQUEST_ID_HEADER, requestId);

    next();
  }
}
