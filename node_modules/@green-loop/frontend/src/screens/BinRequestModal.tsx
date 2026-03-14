import React, { useEffect, useState } from 'react';
import { apiClient } from '../api/client';

interface Props {
  onClose: () => void;
}

export default function BinRequestModal({ onClose }: Props) {
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
      },
      () => setGpsError('Location unavailable. GPS is required to request a bin.'),
    );
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (lat === null || lng === null) {
      setError('Location required to submit a bin request');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await apiClient.post('/bin-requests', { lat, lng, description: description || undefined });
      setSuccess(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ fontWeight: 700 }}>🗑️ Request a Bin</h3>
          <button onClick={onClose} style={{ background: 'none', padding: 0, fontSize: '1.4rem', color: '#6b7280' }}>×</button>
        </div>

        {success ? (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>✅</div>
            <p style={{ fontWeight: 600 }}>Bin request submitted!</p>
            <p style={{ color: '#6b7280', fontSize: '0.85rem', marginTop: '0.25rem' }}>
              The district team will review your request.
            </p>
            <button className="btn-primary" style={{ marginTop: '1rem' }} onClick={onClose}>
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {gpsError ? (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '0.75rem', fontSize: '0.85rem', color: '#dc2626' }}>
                {gpsError}
              </div>
            ) : lat !== null ? (
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '0.5rem 0.75rem', fontSize: '0.8rem', color: '#15803d' }}>
                📍 Location captured ({lat.toFixed(4)}, {lng?.toFixed(4)})
              </div>
            ) : (
              <div style={{ color: '#6b7280', fontSize: '0.85rem' }}>Getting your location…</div>
            )}

            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.4rem', fontSize: '0.9rem' }}>
                Description (optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Where exactly should the bin go?"
                rows={3}
                style={{ resize: 'vertical' }}
              />
            </div>

            {error && <p className="error-text">{error}</p>}

            <button type="submit" className="btn-primary" disabled={submitting || lat === null}>
              {submitting ? 'Submitting…' : '📤 Submit Request'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
