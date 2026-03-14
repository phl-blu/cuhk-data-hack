import { Response } from 'express';

export function sendSuccess(res: Response, data: unknown, status = 200): void {
  res.status(status).json({ data });
}

export function sendError(
  res: Response,
  status: number,
  message: string,
  field?: string,
  requestId?: string
): void {
  const error: { message: string; field?: string; requestId?: string } = { message };
  if (field !== undefined) error.field = field;
  if (requestId !== undefined) error.requestId = requestId;
  res.status(status).json({ error });
}
