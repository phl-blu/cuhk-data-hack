import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';
import BinRequestModal from './BinRequestModal';

interface ResidentProfile {
  displayName: string;
  district: string;
  totalPoints: number;
  districtRank: number;
  checkinCount: number;
  reportCount: number;
  residentialArea?: { name: string; totalBuildingPoints: number };
}

interface CollectionPoint {
  id: number;
  name: string;
  accessTier: 'basic' | 'premium';
  materials: string[];
  lat: number;
  lng: number;
  distanceMetres: number;
}

export default function DashboardTab() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ResidentProfile | null>(null);
  const [nearest, setNearest] = useState<CollectionPoint | null>(null);
  const [locationError, setLocationError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showBinModal, setShowBinModal] = useState(false);

  useEffect(() => {
    apiClient
      .get<{ data: ResidentProfile }>('/residents/me')
      .then((res) => setProfile(res.data))
      .catch(() => {/* handled by loading state */})
      .finally(() => setLoading(false));

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        apiClient
          .get<{ data: { collectionPoints: CollectionPoint[] } }>(
            `/collection-points/nearby?lat=${lat}&lng=${lng}&radius=2000`,
          )
          .then((res) => {
            const pts = res.data.collectionPoints;
            if (pts.length > 0) setNearest(pts[0] ?? null);
          })
          .catch(() => {/* ignore */});
      },
      () => setLocationError(true),
    );
  }, []);

  if (loading) {
    return (
      <div className="screen">
        <h2 style={{ fontWeight: 700, marginBottom: '1rem' }}>📊 Dashboard</h2>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="card">
            <div className="skeleton" style={{ width: '70%' }} />
            <div className="skeleton" style={{ width: '50%' }} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="screen">
      <h2 style={{ fontWeight: 700, marginBottom: '1rem' }}>📊 Dashboard</h2>

      {profile && (
        <div className="card">
          <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{profile.displayName}</div>
          <div style={{ color: '#6b7280', fontSize: '0.85rem', marginBottom: '0.75rem' }}>{profile.district}</div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: '1.5rem', color: '#15803d' }}>{profile.totalPoints}</div>
              <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>Points</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: '1.5rem', color: '#1d4ed8' }}>#{profile.districtRank}</div>
              <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>District Rank</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: '1.5rem' }}>{profile.checkinCount}</div>
              <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>Check-ins</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: '1.5rem' }}>{profile.reportCount}</div>
              <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>Reports</div>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>📍 Nearest Collection Point</div>
        {locationError ? (
          <p style={{ color: '#6b7280', fontSize: '0.85rem' }}>Enable location for nearest collection point</p>
        ) : nearest ? (
          <div>
            <div style={{ fontWeight: 700 }}>{nearest.name}</div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.25rem' }}>
              <span className={`badge badge-${nearest.accessTier}`}>{nearest.accessTier}</span>
              <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>{Math.round(nearest.distanceMetres)} m away</span>
            </div>
          </div>
        ) : (
          <p style={{ color: '#6b7280', fontSize: '0.85rem' }}>Looking for nearby points…</p>
        )}
      </div>

      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <button className="btn-primary" onClick={() => navigate('/map')} style={{ flex: 1 }}>
          🗺️ Go to Map
        </button>
        <button className="btn-secondary" onClick={() => setShowBinModal(true)} style={{ flex: 1 }}>
          🗑️ Request Bin
        </button>
      </div>

      {showBinModal && <BinRequestModal onClose={() => setShowBinModal(false)} />}
    </div>
  );
}
