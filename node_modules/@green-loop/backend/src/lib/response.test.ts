import { describe, it, expect } from 'vitest';
import type { Response } from 'express';
import { sendSuccess, sendError } from './response.js';

interface FakeRes {
  status: (s: number) => FakeRes;
  json: (body: unknown) => FakeRes;
  _captured: { status?: number; body?: unknown };
}

function makeRes(): FakeRes {
  const captured: { status?: number; body?: unknown } = {};
  const res: FakeRes = {
    _captured: captured,
    status(s: number) { captured.status = s; return res; },
    json(body: unknown) { captured.body = body; return res; },
  };
  return res;
}

describe('sendSuccess', () => {
  it('wraps data in { data } envelope with 200 by default', () => {
    const res = makeRes();
    sendSuccess(res as unknown as Response, { foo: 'bar' });
    expect(res._captured.status).toBe(200);
    expect(res._captured.body).toEqual({ data: { foo: 'bar' } });
  });

  it('uses provided status code', () => {
    const res = makeRes();
    sendSuccess(res as unknown as Response, { id: 1 }, 201);
    expect(res._captured.status).toBe(201);
    expect(res._captured.body).toEqual({ data: { id: 1 } });
  });

  it('response has data field but no error field', () => {
    const res = makeRes();
    sendSuccess(res as unknown as Response, { x: 1 });
    const body = res._captured.body as Record<string, unknown>;
    expect('data' in body).toBe(true);
    expect('error' in body).toBe(false);
  });
});

describe('sendError', () => {
  it('wraps error in { error } envelope', () => {
    const res = makeRes();
    sendError(res as unknown as Response, 400, 'Bad request');
    expect(res._captured.status).toBe(400);
    const body = res._captured.body as { error: { message: string } };
    expect(body.error.message).toBe('Bad request');
  });

  it('includes field when provided', () => {
    const res = makeRes();
    sendError(res as unknown as Response, 400, 'Invalid', 'lat');
    const body = res._captured.body as { error: { field?: string } };
    expect(body.error.field).toBe('lat');
  });

  it('includes requestId when provided', () => {
    const res = makeRes();
    sendError(res as unknown as Response, 500, 'Error', undefined, 'req-123');
    const body = res._captured.body as { error: { requestId?: string } };
    expect(body.error.requestId).toBe('req-123');
  });

  it('response has error field but no data field', () => {
    const res = makeRes();
    sendError(res as unknown as Response, 401, 'Unauthorized');
    const body = res._captured.body as Record<string, unknown>;
    expect('error' in body).toBe(true);
    expect('data' in body).toBe(false);
  });

  it('omits field when not provided', () => {
    const res = makeRes();
    sendError(res as unknown as Response, 404, 'Not found');
    const body = res._captured.body as { error: Record<string, unknown> };
    expect('field' in body.error).toBe(false);
  });
});
