import { Request, Response, NextFunction } from 'express';
import { sendError } from '../lib/response.js';

export interface Resident {
  residentId: string;
  displayName: string;
  district: string;
}

// Augment express Request type
declare global {
  namespace Express {
    interface Request {
      requestId: string;
      resident?: Resident;
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const token = req.headers['x-session-token'];

  if (!token || typeof token !== 'string') {
    sendError(res, 401, 'Missing or invalid session token', undefined, req.requestId);
    return;
  }

  let decoded: string;
  try {
    decoded = Buffer.from(token, 'base64').toString('utf8');
  } catch {
    sendError(res, 401, 'Missing or invalid session token', undefined, req.requestId);
    return;
  }

  const colonIndex = decoded.indexOf(':');
  if (colonIndex === -1) {
    sendError(res, 401, 'Missing or invalid session token', undefined, req.requestId);
    return;
  }

  const displayName = decoded.slice(0, colonIndex);
  const district = decoded.slice(colonIndex + 1);

  if (!displayName || !district) {
    sendError(res, 401, 'Missing or invalid session token', undefined, req.requestId);
    return;
  }

  req.resident = { residentId: token, displayName, district };
  next();
}
