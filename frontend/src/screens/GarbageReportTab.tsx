import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient, ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';

export default function GarbageReportTab() {
  const navigate = useNavigate();
  const { clearSession } = useAuth();

  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [errors, setErrors] = useState<{ photo?: string; gps?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{ pointsAwarded: number } | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
      },
      () => setGpsError('Location unavailable. Please enable GPS to submit a report.'),
    );
  }, []);

  function validate(): boolean {
    const newErrors: { photo?: string; gps?: string } = {};
    if (!photo) newErrors.photo = 'Please attach a photo';
    if (lat === null || lng === null) newErrors.gps = 'Location required to submit a report';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    if (!photo || lat === null || lng === null) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      let photoUrl: string;

      try {
        // 1. Get presigned upload URL
        const uploadRes = await apiClient.post<{ data: { uploadUrl: string; photoUrl: string } }>('/upload-url');
        const { uploadUrl, photoUrl: s3Url } = uploadRes.data;
        // 2. PUT photo directly to S3
        await fetch(uploadUrl, { method: 'PUT', body: photo });
        photoUrl = s3Url;
      } catch {
        // S3 not configured — use a placeholder so the report can still be submitted
        photoUrl = `local://${photo!.name}`;
      }

      // 3. Submit garbage report
      const reportRes = await apiClient.post<{ data: { reportId: number; pointsAwarded: number; totalPoints: number } }>(
        '/garbage-reports',
        { lat, lng, photoUrl },
      );

      setSuccess({ pointsAwarded: reportRes.data.pointsAwarded });
      setPhoto(null);
      if (fileRef.current) fileRef.current.value = '';
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.status === 401) {
          clearSession();
          navigate('/onboarding');
          return;
        }
        if (e.status === 400) {
          const field = typeof e.data['field'] === 'string' ? e.data['field'] : undefined;
          setSubmitError(field ? `${field}: ${e.message}` : e.message);
        } else {
          setSubmitError('Something went wrong. Please try again.');
        }
      } else {
        setSubmitError('Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="screen" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎉</div>
        <h3 style={{ fontWeight: 700 }}>Report submitted!</h3>
        <p style={{ color: '#15803d', fontWeight: 700, fontSize: '1.2rem', margin: '0.5rem 0' }}>
          +{success.pointsAwarded} points earned
        </p>
        <button className="btn-primary" style={{ marginTop: '1rem', maxWidth: '200px' }} onClick={() => setSuccess(null)}>
          Submit Another
        </button>
      </div>
    );
  }

  return (
    <div className="screen">
      <h2 style={{ fontWeight: 700, marginBottom: '1rem' }}>📷 Report Garbage</h2>

      {gpsError && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '0.75rem', marginBottom: '1rem', fontSize: '0.85rem', color: '#dc2626' }}>
          {gpsError}
        </div>
      )}

      {lat !== null && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '0.5rem 0.75rem', marginBottom: '1rem', fontSize: '0.8rem', color: '#15803d' }}>
          📍 Location captured ({lat.toFixed(4)}, {lng?.toFixed(4)})
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.4rem', fontSize: '0.9rem' }}>
            Photo <span style={{ color: '#dc2626' }}>*</span>
          </label>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
            style={errors.photo ? { borderColor: '#dc2626' } : {}}
          />
          {errors.photo && <p className="error-text">{errors.photo}</p>}
          {photo && (
            <p style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.25rem' }}>
              Selected: {photo.name}
            </p>
          )}
        </div>

        {errors.gps && <p className="error-text">{errors.gps}</p>}
        {submitError && <p className="error-text">{submitError}</p>}

        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? 'Submitting…' : '📤 Submit Report'}
        </button>
      </form>
    </div>
  );
}
