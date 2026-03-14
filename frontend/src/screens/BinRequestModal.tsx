import React, { useEffect, useState } from 'react';
import { apiClient } from '../api/client';

interface Props {
  onClose: () => void;
  isOpen?: boolean;
}

export default function BinRequestModal({ onClose, isOpen = true }: Props) {
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [gpsLoading, setGpsLoading] = useState(true);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [binRequestId, setBinRequestId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setGpsLoading(true);
    setGpsError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        setGpsLoading(false);
      },
      () => {
        setGpsError('Location unavailable. GPS is required to request a bin.');
        setGpsLoading(false);
      },
      { timeout: 10000 },
    );
  }, [isOpen]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (lat === null || lng === null) {
      setError('Location required to submit a bin request.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiClient.post<{ data: { binRequestId: string; createdAt: string } }>(
        '/bin-requests',
        { lat, lng, description: description.trim() || undefined },
      );
      setBinRequestId(res.data.binRequestId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Request a Bin"
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        zIndex: 200,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: '#fff', borderRadius: '16px 16px 0 0',
        padding: '1.5rem', width: '100%', maxWidth: '480px',
        maxHeight: '80dvh', overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ fontWeight: 700 }}>🗑️ Request a Bin</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ background: 'none', padding: 0, fontSize: '1.4rem', color: '#6b7280' }}
          >
            ×
          </button>
        </div>

        {/* Success state */}
        {binRequestId ? (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>✅</div>
            <p style={{ fontWeight: 600 }}>Bin request submitted!</p>
            <p style={{ color: '#6b7280', fontSize: '0.85rem', marginTop: '0.25rem' }}>
              The district team will review your request.
            </p>
            <p style={{ color: '#9ca3af', fontSize: '0.75rem', marginTop: '0.25rem' }}>
              Reference: {binRequestId}
            </p>
            <button className="btn-primary" style={{ marginTop: '1rem' }} onClick={onClose}>
              Done
            </button>
          </div>
        ) : (
          /* Form state */
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* GPS status */}
            {gpsLoading ? (
              <div style={{ color: '#6b7280', fontSize: '0.85rem' }}>
                📡 Getting your location…
              </div>
            ) : gpsError ? (
              <div style={{
                background: '#fef2f2', border: '1px solid #fecaca',
                borderRadius: '8px', padding: '0.75rem',
                fontSize: '0.85rem', color: '#dc2626',
              }}>
                {gpsError}
              </div>
            ) : (
              <div style={{
                background: '#f0fdf4', border: '1px solid #bbf7d0',
                borderRadius: '8px', padding: '0.5rem 0.75rem',
                fontSize: '0.8rem', color: '#15803d',
              }}>
                📍 Location captured ({lat?.toFixed(4)}, {lng?.toFixed(4)})
              </div>
            )}

            {/* Description */}
            <div>
              <label
                htmlFor="bin-request-description"
                style={{ display: 'block', fontWeight: 600, marginBottom: '0.4rem', fontSize: '0.9rem' }}
              >
                Description <span style={{ fontWeight: 400, color: '#6b7280' }}>(optional)</span>
              </label>
              <textarea
                id="bin-request-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Where exactly should the bin go?"
                rows={3}
                style={{ resize: 'vertical' }}
              />
            </div>

            {error && <p className="error-text" role="alert">{error}</p>}

            <button
              type="submit"
              className="btn-primary"
              disabled={submitting || gpsLoading || lat === null}
            >
              {submitting ? 'Submitting…' : '📤 Submit Request'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
