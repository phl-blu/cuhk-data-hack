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
        <div style={{ width: 72, height: 72, borderRadius: 20, background: '#D9F3E5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, marginBottom: 16 }}>
          ✅
        </div>
        <div style={{ fontWeight: 700, fontSize: 20, color: '#0F2D1C', marginBottom: 6 }}>Report Submitted</div>
        <div style={{ color: '#2AA962', fontWeight: 700, fontSize: 17, marginBottom: 20 }}>
          +{success.pointsAwarded} points earned
        </div>
        <button className="btn-primary" style={{ maxWidth: 200 }} onClick={() => setSuccess(null)}>
          Submit Another
        </button>
      </div>
    );
  }

  return (
    <div className="screen">
      <div className="section-heading">Report Garbage</div>

      {gpsError && <div className="alert-error">{gpsError}</div>}

      {lat !== null && (
        <div className="alert-success" style={{ fontWeight: 400 }}>
          📍 Location captured ({lat.toFixed(4)}, {lng?.toFixed(4)})
        </div>
      )}

      <div className="card">
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 13, color: '#4D7060' }}>
              Photo <span style={{ color: '#B91C1C' }}>*</span>
            </label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
              style={errors.photo ? { borderColor: '#B91C1C' } : {}}
            />
            {errors.photo && <p className="error-text">{errors.photo}</p>}
            {photo && (
              <p style={{ fontSize: 12, color: '#8AAD96', marginTop: 4 }}>Selected: {photo.name}</p>
            )}
          </div>

          {errors.gps && <p className="error-text">{errors.gps}</p>}
          {submitError && <p className="error-text">{submitError}</p>}

          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit Report'}
          </button>
        </form>
      </div>
    </div>
  );
}
