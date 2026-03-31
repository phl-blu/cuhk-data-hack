import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const HK_DISTRICTS = [
  'Central and Western', 'Eastern', 'Southern', 'Wan Chai',
  'Kowloon City', 'Kwun Tong', 'Sham Shui Po', 'Wong Tai Sin', 'Yau Tsim Mong',
  'Islands', 'Kwai Tsing', 'North', 'Sai Kung', 'Sha Tin',
  'Tai Po', 'Tsuen Wan', 'Tuen Mun', 'Yuen Long',
];

export default function OnboardingScreen() {
  const { createSession } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState('');
  const [district, setDistrict] = useState('');
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
    createSession(displayName.trim(), district);
    navigate('/');
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: '#f4f6f9' }}>
      {/* Gov banner */}
      <div className="gov-banner">
        香港特別行政區政府 · The Government of the Hong Kong Special Administrative Region
      </div>

      {/* Header */}
      <div style={{
        background: '#2e7d32',
        padding: '2rem 1.5rem 1.5rem',
        color: '#fff',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '2rem' }}>♻️</span>
          <div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.01em' }}>iAM Green</div>
            <div style={{ fontSize: '0.78rem', opacity: 0.8, marginTop: '0.1rem' }}>
              Recycling Rewards Programme
            </div>
          </div>
        </div>
        <p style={{ fontSize: '0.85rem', opacity: 0.75, marginTop: '0.75rem', lineHeight: 1.5 }}>
          Earn points for recycling. Redeem rewards. Help keep Hong Kong clean.
        </p>
      </div>

      {/* Form */}
      <div style={{ flex: 1, padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div style={{
          background: '#fff',
          borderRadius: '8px',
          padding: '1.25rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.07)',
        }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#2e7d32', marginBottom: '1rem' }}>
            Registration
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.4rem', fontSize: '0.85rem', color: '#374151' }}>
                Display Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. EcoHero88"
                maxLength={50}
                style={errors.displayName ? { borderColor: '#b91c1c' } : {}}
              />
              {errors.displayName && <p className="error-text">{errors.displayName}</p>}
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.4rem', fontSize: '0.85rem', color: '#374151' }}>
                District
              </label>
              <select
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                style={errors.district ? { borderColor: '#b91c1c' } : {}}
              >
                <option value="">Select your district…</option>
                {HK_DISTRICTS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              {errors.district && <p className="error-text">{errors.district}</p>}
            </div>

            <button type="submit" className="btn-primary" style={{ marginTop: '0.25rem' }}>
              Get Started
            </button>
          </form>
        </div>

        <p style={{ fontSize: '0.72rem', color: '#9ca3af', textAlign: 'center', lineHeight: 1.6 }}>
          By continuing, you agree to the Terms of Use of the iAM Smart+ platform.
          Personal data collected will be used in accordance with the Personal Data (Privacy) Ordinance.
        </p>
      </div>
    </div>
  );
}
