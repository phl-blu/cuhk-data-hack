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
    const e: typeof errors = {};
    const t = displayName.trim();
    if (!t || t.length > 50) e.displayName = 'Name must be 1–50 characters';
    if (!district) e.district = 'Please select a district';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validate()) return;
    createSession(displayName.trim(), district);
    navigate('/');
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: '#EEF5F0' }}>
      <div className="gov-banner">
        香港特別行政區政府 · The Government of the Hong Kong Special Administrative Region
      </div>

      {/* Hero */}
      <div style={{ background: '#1A7A4A', padding: '32px 20px 28px', color: '#fff', borderBottom: '3px solid #3DC478' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div style={{ width: 52, height: 52, borderRadius: 16, background: '#D9F3E5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>
            ♻️
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em' }}>iAM Green</div>
            <div style={{ fontSize: 12, opacity: 0.75, marginTop: 2 }}>Recycling Rewards Programme</div>
          </div>
        </div>
        <p style={{ fontSize: 13, opacity: 0.8, lineHeight: 1.6 }}>
          Earn points for recycling. Redeem Octopus Card credits. Help keep Hong Kong clean.
        </p>
      </div>

      {/* Form */}
      <div style={{ flex: 1, padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="card">
          <div className="card-label">Registration</div>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 13, color: '#4D7060' }}>
                Display Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. EcoHero88"
                maxLength={50}
                style={errors.displayName ? { borderColor: '#B91C1C' } : {}}
              />
              {errors.displayName && <p className="error-text">{errors.displayName}</p>}
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 13, color: '#4D7060' }}>
                District
              </label>
              <select
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                style={errors.district ? { borderColor: '#B91C1C' } : {}}
              >
                <option value="">Select your district…</option>
                {HK_DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
              {errors.district && <p className="error-text">{errors.district}</p>}
            </div>

            <button type="submit" className="btn-primary" style={{ marginTop: 4 }}>
              Get Started
            </button>
          </form>
        </div>

        <p style={{ fontSize: 11, color: '#8AAD96', textAlign: 'center', lineHeight: 1.7 }}>
          By continuing you agree to the Terms of Use of the iAM Smart+ platform.
          Personal data is collected in accordance with the Personal Data (Privacy) Ordinance.
        </p>
      </div>
    </div>
  );
}
