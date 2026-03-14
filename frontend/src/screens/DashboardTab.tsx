import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import BinRequestModal from './BinRequestModal';

// Approximate centroids for HK's 18 districts (fallback when geolocation unavailable)
const DISTRICT_CENTROIDS: Record<string, [number, number]> = {
  'Central and Western': [114.1549, 22.2855],
  'Eastern': [114.2262, 22.2830],
  'Southern': [114.1694, 22.2463],
  'Wan Chai': [114.1825, 22.2783],
  'Kowloon City': [114.1916, 22.3282],
  'Kwun Tong': [114.2262, 22.3130],
  'Sham Shui Po': [114.1618, 22.3302],
  'Wong Tai Sin': [114.1935, 22.3419],
  'Yau Tsim Mong': [114.1722, 22.3100],
  'Islands': [113.9494, 22.2611],
  'Kwai Tsing': [114.1288, 22.3547],
  'North': [114.1477, 22.4975],
  'Sai Kung': [114.2700, 22.3814],
  'Sha Tin': [114.1952, 22.3830],
  'Tai Po': [114.1694, 22.4500],
  'Tsuen Wan': [114.1077, 22.3714],
  'Tuen Mun': [113.9769, 22.3914],
  'Yuen Long': [114.0228, 22.4455],
};

interface ResidentProfile {
  displayName: string;
  district: string;
  totalPoints: number;
  districtRank: number | null;
  checkinCount: number;
  reportCount: number;
  monthlyCheckinCount: number;
  monthlyReportCount: number;
  residentialAreaName?: string | null;
  residentialAreaBuildingPoints?: number;
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

interface NearbyReport {
  id: number;
  lat: number;
  lng: number;
  districtName: string | null;
  createdAt: string;
}

async function fetchNearestPoint(lat: number, lng: number): Promise<CollectionPoint | null> {
  const res = await apiClient.get<{ data: { points: CollectionPoint[] } }>(
    `/collection-points/nearby?lat=${lat}&lng=${lng}&radius=10000`,
  );
  return res.data.points[0] ?? null;
}

export default function DashboardTab() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [profile, setProfile] = useState<ResidentProfile | null>(null);
  const [nearest, setNearest] = useState<CollectionPoint | null>(null);
  const [nearbyReports, setNearbyReports] = useState<NearbyReport[]>([]);
  const [usingCentroid, setUsingCentroid] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Reset stale data on mount
    setProfile(null);
    setNearest(null);
    setUsingCentroid(false);
    setLoading(true);

    apiClient
      .get<{ data: ResidentProfile }>('/residents/me')
      .then((res) => setProfile(res.data))
      .catch(() => {/* handled by loading state */})
      .finally(() => setLoading(false));

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        fetchNearestPoint(lat, lng)
          .then((pt) => setNearest(pt))
          .catch(() => {/* ignore */});
        // Fetch reports within ~2km bounding box (~0.018 degrees)
        const delta = 0.018;
        apiClient.get<{ data: { reports: NearbyReport[] } }>(
          `/garbage-reports?minLat=${lat - delta}&minLng=${lng - delta}&maxLat=${lat + delta}&maxLng=${lng + delta}`
        ).then((r) => setNearbyReports(r.data.reports ?? [])).catch(() => {});
      },
      () => {
        // Geolocation unavailable — fall back to district centroid
        const district = session?.district ?? '';
        const centroid = DISTRICT_CENTROIDS[district];
        if (centroid) {
          setUsingCentroid(true);
          fetchNearestPoint(centroid[1], centroid[0])
            .then((pt) => setNearest(pt))
            .catch(() => {/* ignore */});
          const delta = 0.018;
          apiClient.get<{ data: { reports: NearbyReport[] } }>(
            `/garbage-reports?minLat=${centroid[1] - delta}&minLng=${centroid[0] - delta}&maxLat=${centroid[1] + delta}&maxLng=${centroid[0] + delta}`
          ).then((r) => setNearbyReports(r.data.reports ?? [])).catch(() => {});
        }
      },
    );
  }, [session?.district]);

  function goToMap() {
    if (nearest) {
      navigate('/map', { state: { centerLat: nearest.lat, centerLng: nearest.lng } });
    } else {
      navigate('/map');
    }
  }

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
        <>
          {/* Profile summary */}
          <div className="card">
            <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{profile.displayName}</div>
            <div style={{ color: '#6b7280', fontSize: '0.85rem', marginBottom: '0.75rem' }}>{profile.district}</div>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 800, fontSize: '1.5rem', color: '#15803d' }}>
                  {profile.totalPoints.toLocaleString()}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>Total Points</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 800, fontSize: '1.5rem', color: '#1d4ed8' }}>
                  {profile.districtRank != null ? `#${profile.districtRank}` : '—'}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>District Rank</div>
              </div>
            </div>
          </div>

          {/* Monthly activity */}
          <div className="card">
            <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>📅 This Month</div>
            <div style={{ display: 'flex', gap: '1.5rem' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 800, fontSize: '1.4rem' }}>{profile.monthlyCheckinCount}</div>
                <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>Check-ins</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 800, fontSize: '1.4rem' }}>{profile.monthlyReportCount}</div>
                <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>Reports</div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Nearest collection point */}
      <div className="card">
        <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>
          📍 Nearest Collection Point
          {usingCentroid && (
            <span style={{ fontSize: '0.7rem', color: '#6b7280', fontWeight: 400, marginLeft: '0.4rem' }}>
              (based on district)
            </span>
          )}
        </div>
        {nearest ? (
          <div>
            <div style={{ fontWeight: 700 }}>{nearest.name}</div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.25rem' }}>
              <span className={`badge badge-${nearest.accessTier}`}>{nearest.accessTier}</span>
              <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                {Math.round(nearest.distanceMetres)} m away
              </span>
            </div>
          </div>
        ) : (
          <p style={{ color: '#6b7280', fontSize: '0.85rem' }}>
            {usingCentroid ? 'No collection points found nearby.' : 'Looking for nearby points…'}
          </p>
        )}
      </div>

      {/* Nearby garbage reports */}
      <div className="card">
        <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>🗑️ Nearby Reports</div>
        {nearbyReports.length === 0 ? (
          <p style={{ color: '#6b7280', fontSize: '0.85rem' }}>No reports in your area yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {nearbyReports.slice(0, 5).map((r) => (
              <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', borderBottom: '1px solid #f3f4f6', paddingBottom: '0.4rem' }}>
                <span style={{ color: '#374151' }}>
                  📍 {r.districtName ?? `${r.lat.toFixed(3)}, ${r.lng.toFixed(3)}`}
                </span>
                <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>
                  {new Date(r.createdAt).toLocaleDateString()}
                </span>
              </div>
            ))}
            {nearbyReports.length > 5 && (
              <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: 0 }}>
                +{nearbyReports.length - 5} more — view on map
              </p>
            )}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <button className="btn-primary" onClick={goToMap} style={{ flex: 1 }}>
          🗺️ Go to Map
        </button>
        <BinRequestButton />
      </div>
    </div>
  );
}

function BinRequestButton() {
  const [showModal, setShowModal] = useState(false);
  return (
    <>
      <button className="btn-secondary" onClick={() => setShowModal(true)} style={{ flex: 1 }}>
        🗑️ Request Bin
      </button>
      {showModal && <BinRequestModal onClose={() => setShowModal(false)} />}
    </>
  );
}
