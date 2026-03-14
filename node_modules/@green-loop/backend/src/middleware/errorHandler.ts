import { Request, Response, NextFunction } from 'express';
import { sendError } from '../lib/response.js';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  console.error(JSON.stringify({
    level: 'error',
    message: err.message,
    stack: err.stack,
    requestId: req.requestId,
  }));

  sendError(res, 500, 'Internal server error', undefined, req.requestId);
}
