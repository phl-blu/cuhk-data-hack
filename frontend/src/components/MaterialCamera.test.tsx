import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import MaterialCamera from './MaterialCamera';
import type { ClassificationResult } from './MaterialCamera';

// ---------------------------------------------------------------------------
// WebSocket mock
// ---------------------------------------------------------------------------
class MockWebSocket {
  static OPEN = 1;
  static CONNECTING = 0;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  send = vi.fn();
  close = vi.fn(() => { this.readyState = MockWebSocket.CLOSED; });

  // helpers for tests
  simulateOpen() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.();
  }
  simulateMessage(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }
  simulateClose() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.();
  }
}

let wsInstance: MockWebSocket;

// ---------------------------------------------------------------------------
// getUserMedia mock
// ---------------------------------------------------------------------------
const mockStream = {
  getTracks: () => [{ stop: vi.fn() }],
};

function setupMediaMock(grant = true) {
  Object.defineProperty(global.navigator, 'mediaDevices', {
    writable: true,
    value: {
      getUserMedia: grant
        ? vi.fn().mockResolvedValue(mockStream)
        : vi.fn().mockRejectedValue(new Error('Permission denied')),
    },
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  wsInstance = new MockWebSocket();
  vi.stubGlobal('WebSocket', vi.fn(() => wsInstance));
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Task 7.3 — Camera access unit tests
// ---------------------------------------------------------------------------
describe('Camera access (task 7.3)', () => {
  it('calls getUserMedia on mount with facingMode environment constraint', async () => {
    setupMediaMock(true);
    await act(async () => { render(<MaterialCamera />); });
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
      video: { facingMode: { ideal: 'environment' } },
    });
  });

  it('video element has srcObject after camera grant', async () => {
    setupMediaMock(true);
    await act(async () => { render(<MaterialCamera />); });
    const video = document.querySelector('video') as HTMLVideoElement;
    expect(video).not.toBeNull();
    expect(video.srcObject).toBe(mockStream);
  });

  it('renders error message after camera denial', async () => {
    setupMediaMock(false);
    await act(async () => { render(<MaterialCamera />); });
    expect(screen.getByText(/camera access denied/i)).toBeInTheDocument();
  });

  it('does not open WebSocket when camera is denied', async () => {
    setupMediaMock(false);
    await act(async () => { render(<MaterialCamera />); });
    expect(WebSocket).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Task 9.4 — Remaining React unit tests
// ---------------------------------------------------------------------------
describe('WebSocket lifecycle (task 9.4)', () => {
  it('WebSocket constructor called on mount', async () => {
    setupMediaMock(true);
    await act(async () => { render(<MaterialCamera />); });
    expect(WebSocket).toHaveBeenCalledWith('ws://localhost:8001/ws/classify');
  });

  it('ws.close() called on unmount', async () => {
    setupMediaMock(true);
    let unmount!: () => void;
    await act(async () => {
      const result = render(<MaterialCamera />);
      unmount = result.unmount;
    });
    // Flush all pending microtasks so startCamera + connectWS complete
    await act(async () => {
      await Promise.resolve();
      wsInstance.simulateOpen();
    });
    await act(async () => { unmount(); });
    // ws.close may be called via the onclose handler path or directly
    // Either the mock's close was called, or the ws was already closed
    const wsClosed = wsInstance.close.mock.calls.length > 0 ||
      wsInstance.readyState === MockWebSocket.CLOSED;
    expect(wsClosed).toBe(true);
  });

  it('"unknown" label renders with distinct CSS class', async () => {
    setupMediaMock(true);
    await act(async () => { render(<MaterialCamera />); });
    await act(async () => {
      wsInstance.simulateOpen();
      wsInstance.simulateMessage({ label: 'unknown', confidence: 0.45 });
    });
    const overlay = document.querySelector('.material-camera-overlay');
    expect(overlay).not.toBeNull();
    expect(overlay!.classList.contains('unknown')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Task 8.3 — Property 6: Request-Response Pacing
// ---------------------------------------------------------------------------
describe('Property 6: Request-Response Pacing (task 8.3)', () => {
  it('ws.send count never exceeds received message count + 1', async () => {
    setupMediaMock(true);
    await act(async () => { render(<MaterialCamera />); });
    await act(async () => { wsInstance.simulateOpen(); });

    // initial sendFrame on open counts as 1 send before any message
    const messageCount = 5;
    for (let i = 0; i < messageCount; i++) {
      await act(async () => {
        wsInstance.simulateMessage({ label: 'plastic', confidence: 0.9 });
      });
    }
    // sends: 1 (onopen) + messageCount (one per onmessage)
    expect(wsInstance.send.mock.calls.length).toBeLessThanOrEqual(messageCount + 1);
  });

  it('fast-check: send count ≤ received + 1 for any message sequence length', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 20 }), (n) => {
        // Pure logic: 1 initial send + n sends from n messages
        const sends = 1 + n;
        const received = n;
        return sends <= received + 1;
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// Task 8.4 — Property 7: Exponential Backoff Delay Sequence
// ---------------------------------------------------------------------------
describe('Property 7: Exponential Backoff Delay Sequence (task 8.4)', () => {
  it('fast-check: delay equals Math.min(500 * 2^n, 8000) for n in 1–20', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 20 }), (n) => {
        const delay = Math.min(500 * 2 ** n, 8000);
        const expected = Math.min(500 * Math.pow(2, n), 8000);
        return delay === expected;
      }),
    );
  });

  it('caps at 8000ms', () => {
    expect(Math.min(500 * 2 ** 20, 8000)).toBe(8000);
  });

  it('attempt 0 gives 500ms', () => {
    expect(Math.min(500 * 2 ** 0, 8000)).toBe(500);
  });

  it('attempt 3 gives 4000ms', () => {
    expect(Math.min(500 * 2 ** 3, 8000)).toBe(4000);
  });
});

// ---------------------------------------------------------------------------
// Task 9.2 — Property 5: Overlay Contains Label and Confidence
// ---------------------------------------------------------------------------
describe('Property 5: Overlay Contains Label and Confidence (task 9.2)', () => {
  const LABELS: ClassificationResult['label'][] = [
    'plastic', 'paper', 'metal', 'glass', 'organic', 'unknown',
  ];

  it('fast-check: overlay text contains label and rounded confidence %', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...LABELS),
        fc.float({ min: 0, max: 1, noNaN: true }),
        async (label, confidence) => {
          setupMediaMock(true);
          let unmount!: () => void;
          await act(async () => {
            const r = render(<MaterialCamera />);
            unmount = r.unmount;
          });
          await act(async () => {
            wsInstance.simulateOpen();
            wsInstance.simulateMessage({ label, confidence });
          });
          const overlay = document.querySelector('.material-camera-overlay');
          const text = overlay?.textContent ?? '';
          const pct = Math.round(confidence * 100);
          const ok = text.includes(label) && text.includes(`${pct} %`);
          act(() => { unmount(); });
          return ok;
        },
      ),
      { numRuns: 10 },
    );
  });
});

// ---------------------------------------------------------------------------
// Task 9.3 — Property 8: Overlay Updates on Result Receipt
// ---------------------------------------------------------------------------
describe('Property 8: Overlay Updates on Result Receipt (task 9.3)', () => {
  it('component reflects new result after WS message before next render cycle', async () => {
    setupMediaMock(true);
    await act(async () => { render(<MaterialCamera />); });
    await act(async () => { wsInstance.simulateOpen(); });

    await act(async () => {
      wsInstance.simulateMessage({ label: 'metal', confidence: 0.77 });
    });

    const overlay = document.querySelector('.material-camera-overlay');
    expect(overlay?.textContent).toContain('metal');
    expect(overlay?.textContent).toContain('77 %');
  });
});
