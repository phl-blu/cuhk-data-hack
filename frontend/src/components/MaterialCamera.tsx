import { useEffect, useRef, useState, useCallback } from 'react';

export interface ClassificationResult {
  label: 'plastic' | 'paper' | 'metal' | 'glass' | 'organic' | 'unknown';
  confidence: number;
}

const WS_URL = (import.meta.env['VITE_SORTER_WS_URL'] as string | undefined)
  || 'ws://material-sorter-production.up.railway.app/ws/classify';

export default function MaterialCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptRef = useRef(0);
  const mountedRef = useRef(true);

  const [result, setResult] = useState<ClassificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [wsReady, setWsReady] = useState(false);

  // ---------------------------------------------------------------------------
  // captureFrame — draws current video frame to offscreen canvas, returns base64
  // ---------------------------------------------------------------------------
  const captureFrame = useCallback((): string | null => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return null;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 320;
    canvas.height = video.videoHeight || 240;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg');
    // Strip the data URI prefix before sending
    return dataUrl.replace('data:image/jpeg;base64,', '');
  }, []);

  // ---------------------------------------------------------------------------
  // sendFrame — captures and sends one frame over the open WS
  // ---------------------------------------------------------------------------
  const sendFrame = useCallback(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const frame = captureFrame();
    if (frame) ws.send(frame);
  }, [captureFrame]);

  // ---------------------------------------------------------------------------
  // connectWS — opens WS, wires handlers, handles exponential backoff on close
  // ---------------------------------------------------------------------------
  const connectWS = useCallback(() => {
    if (!mountedRef.current) return;
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) { ws.close(); return; }
      attemptRef.current = 0;
      setWsReady(true);
      sendFrame();
    };

    ws.onmessage = (event: MessageEvent) => {
      if (!mountedRef.current) return;
      try {
        const data = JSON.parse(event.data as string) as ClassificationResult;
        if (data && typeof data.label === 'string' && typeof data.confidence === 'number') {
          setResult(data);
        }
      } catch {
        console.warn('[MaterialCamera] Malformed WS message:', event.data);
      }
      // Always send next frame after receiving a response (request-response pacing)
      sendFrame();
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      setWsReady(false);
      const attempt = attemptRef.current;
      const delay = Math.min(500 * 2 ** attempt, 8000);
      attemptRef.current = attempt + 1;
      reconnectTimerRef.current = setTimeout(() => {
        if (mountedRef.current) connectWS();
      }, delay);
    };
  }, [sendFrame]);

  // ---------------------------------------------------------------------------
  // startCamera — requests camera access, attaches stream, then opens WS
  // ---------------------------------------------------------------------------
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
      });
      if (!mountedRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      connectWS();
    } catch {
      setError('Camera access denied. Please allow camera permissions and reload.');
    }
  }, [connectWS]);

  // ---------------------------------------------------------------------------
  // Mount / unmount
  // ---------------------------------------------------------------------------
  useEffect(() => {
    mountedRef.current = true;
    void startCamera();

    return () => {
      mountedRef.current = false;
      if (reconnectTimerRef.current != null) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      const ws = wsRef.current;
      if (ws) {
        ws.close();
      }
      wsRef.current = null;
      // Stop camera tracks
      const video = videoRef.current;
      if (video?.srcObject) {
        (video.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      }
    };
  }, [startCamera]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '1rem', color: '#dc2626', textAlign: 'center' }}>
        <span>{error}</span>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: '#000', overflow: 'hidden' }}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
      {result && (
        <div
          className={`material-camera-overlay${result.label === 'unknown' ? ' unknown' : ''}`}
          style={{
            position: 'absolute',
            bottom: '1.5rem',
            left: '50%',
            transform: 'translateX(-50%)',
            background: result.label === 'unknown' ? 'rgba(107,114,128,0.85)' : 'rgba(22,163,74,0.85)',
            color: '#fff',
            borderRadius: '10px',
            padding: '0.5rem 1.25rem',
            fontSize: '1.1rem',
            fontWeight: 700,
            letterSpacing: '0.02em',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          {result.label} {Math.round(result.confidence * 100)} %
        </div>
      )}
      {!wsReady && !result && (
        <div style={{
          position: 'absolute', top: '0.75rem', right: '0.75rem',
          background: 'rgba(0,0,0,0.5)', color: '#fbbf24',
          borderRadius: '6px', padding: '0.25rem 0.6rem', fontSize: '0.75rem',
        }}>
          connecting…
        </div>
      )}
    </div>
  );
}
