import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const HK_DISTRICTS = [
  'Central and Western',
  'Eastern',
  'Southern',
  'Wan Chai',
  'Kowloon City',
  'Kwun Tong',
  'Sham Shui Po',
  'Wong Tai Sin',
  'Yau Tsim Mong',
  'Islands',
  'Kwai Tsing',
  'North',
  'Sai Kung',
  'Sha Tin',
  'Tai Po',
  'Tsuen Wan',
  'Tuen Mun',
  'Yuen Long',
];

const MAPBOX_LS_KEY = 'mapbox_token';

export default function OnboardingScreen() {
  const { createSession } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState('');
  const [district, setDistrict] = useState('');
  const [mapboxToken, setMapboxToken] = useState(() => localStorage.getItem(MAPBOX_LS_KEY) ?? '');
  const [errors, setErrors] = useState<{ displayName?: string; district?: string }>({});

  function validate(): boolean {
    const newErrors: { displayName?: string; district?: string } = {};
    const trimmed = displayName.trim();
    if (!trimmed || trimmed.length < 1 || trimmed.length > 50) {
      newErrors.displayName = 'Name must be 1–50 characters';
    }
    if (!district) {
      newErrors.district = 'Please select a district';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    const token = mapboxToken.trim();
    if (token) localStorage.setItem(MAPBOX_LS_KEY, token);
    createSession(displayName.trim(), district);
    navigate('/');
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '2rem 1.5rem', background: '#f0fdf4' }}>
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>♻️</div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#15803d' }}>Green Loop</h1>
        <p style={{ color: '#6b7280', marginTop: '0.5rem' }}>Recycle. Earn. Make HK greener.</p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.4rem', fontSize: '0.9rem' }}>
            Display Name
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. EcoHero88"
            maxLength={50}
            style={errors.displayName ? { borderColor: '#dc2626' } : {}}
          />
          {errors.displayName && <p className="error-text">{errors.displayName}</p>}
        </div>

        <div>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.4rem', fontSize: '0.9rem' }}>
            District
          </label>
          <select
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            style={errors.district ? { borderColor: '#dc2626' } : {}}
          >
            <option value="">Select your district…</option>
            {HK_DISTRICTS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          {errors.district && <p className="error-text">{errors.district}</p>}
        </div>

        <div>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.4rem', fontSize: '0.9rem' }}>
            Mapbox Token <span style={{ fontWeight: 400, color: '#6b7280' }}>(optional — needed for the map)</span>
          </label>
          <input
            type="text"
            value={mapboxToken}
            onChange={(e) => setMapboxToken(e.target.value)}
            placeholder="pk.eyJ1..."
          />
          <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.3rem' }}>
            Free at <a href="https://account.mapbox.com/auth/signup" target="_blank" rel="noopener noreferrer" style={{ color: '#15803d' }}>mapbox.com</a>
          </p>
        </div>

        <button type="submit" className="btn-primary" style={{ marginTop: '0.5rem' }}>
          Get Started
        </button>
      </form>
    </div>
  );
}
