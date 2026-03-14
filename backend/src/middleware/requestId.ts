import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  req.requestId = uuidv4();

  const start = Date.now();

  res.on('finish', () => {
    const log = {
      level: 'info',
      method: req.method,
      path: req.path,
      status: res.statusCode,
      responseTimeMs: Date.now() - start,
      requestId: req.requestId,
    };
    console.log(JSON.stringify(log));
  });

  next();
}
