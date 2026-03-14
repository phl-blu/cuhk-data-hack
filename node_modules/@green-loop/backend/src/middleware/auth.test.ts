import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { authMiddleware } from './auth.js';

function makeReq(token?: string): Partial<Request> {
  return {
    headers: token ? { 'x-session-token': token } : {},
    requestId: 'test-req-id',
  };
}

function makeRes() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
}

function makeNext() {
  return vi.fn() as unknown as NextFunction;
}

describe('authMiddleware', () => {
  it('calls next() for a valid token', () => {
    const token = Buffer.from('Alice:Sha Tin').toString('base64');
    const req = makeReq(token) as Request;
    const res = makeRes() as unknown as Response;
    const next = makeNext();

    authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.resident).toEqual({
      residentId: token,
      displayName: 'Alice',
      district: 'Sha Tin',
    });
  });

  it('returns 401 when token is missing', () => {
    const req = makeReq() as Request;
    const res = makeRes() as unknown as Response;
    const next = makeNext();

    authMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 401 for a token without colon separator', () => {
    const token = Buffer.from('nodistrict').toString('base64');
    const req = makeReq(token) as Request;
    const res = makeRes() as unknown as Response;
    const next = makeNext();

    authMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 401 when displayName is empty', () => {
    const token = Buffer.from(':Sha Tin').toString('base64');
    const req = makeReq(token) as Request;
    const res = makeRes() as unknown as Response;
    const next = makeNext();

    authMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 401 when district is empty', () => {
    const token = Buffer.from('Alice:').toString('base64');
    const req = makeReq(token) as Request;
    const res = makeRes() as unknown as Response;
    const next = makeNext();

    authMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('handles display names with colons (uses first colon as separator)', () => {
    // displayName = "Bob", district = "Extra:Kowloon City"
    const token = Buffer.from('Bob:Extra:Kowloon City').toString('base64');
    const req = makeReq(token) as Request;
    const res = makeRes() as unknown as Response;
    const next = makeNext();

    authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.resident?.displayName).toBe('Bob');
    expect(req.resident?.district).toBe('Extra:Kowloon City');
  });
});
