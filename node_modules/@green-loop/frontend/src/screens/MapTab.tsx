import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { apiClient, ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import BinRequestModal from './BinRequestModal';

interface CollectionPoint {
  id: number;
  name: string;
  accessTier: 'basic' | 'premium';
  materials: string[];
  lat: number;
  lng: number;
  distanceMetres: number;
}

interface MapStats {
  totalCheckins: number;
  totalPoints: number;
  totalGarbageReports: number;
}

interface PopupInfo {
  point: CollectionPoint;
}

export default function MapTab() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const navState = location.state as { centerLat?: number; centerLng?: number } | null;
  const { clearSession } = useAuth();
  const [stats, setStats] = useState<MapStats | null>(null);
  const [popup, setPopup] = useState<PopupInfo | null>(null);
  const [checkinMsg, setCheckinMsg] = useState<string | null>(null);
  const [showBinModal, setShowBinModal] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  useEffect(() => {
    let map: import('mapbox-gl').Map | null = null;

    async function initMap() {
      try {
        const mapboxgl = (await import('mapbox-gl')).default;
        await import('mapbox-gl/dist/mapbox-gl.css');

        mapboxgl.accessToken = import.meta.env['VITE_MAPBOX_TOKEN'] as string ?? '';

        if (!mapContainerRef.current) return;

        map = new mapboxgl.Map({
          container: mapContainerRef.current,
          style: 'mapbox://styles/mapbox/streets-v12',
          center: navState?.centerLng != null && navState?.centerLat != null
            ? [navState.centerLng, navState.centerLat]
            : [114.1694, 22.3193],
          zoom: navState?.centerLat != null ? 15 : 11,
          pitch: 45,
          bearing: -17.6,
        });

        (mapRef as React.MutableRefObject<unknown>).current = map;

        map.on('load', () => {
          if (!map) return;

          // Try 3D buildings
          try {
            const layers = map.getStyle().layers ?? [];
            let labelLayerId: string | undefined;
            for (const layer of layers) {
              if (layer.type === 'symbol' && 'layout' in layer && (layer.layout as Record<string, unknown>)['text-field']) {
                labelLayerId = layer.id;
                break;
              }
            }
            map.addLayer(
              {
                id: '3d-buildings',
                source: 'composite',
                'source-layer': 'building',
                filter: ['==', 'extrude', 'true'],
                type: 'fill-extrusion',
                minzoom: 15,
                paint: {
                  'fill-extrusion-color': '#aaa',
                  'fill-extrusion-height': ['get', 'height'],
                  'fill-extrusion-base': ['get', 'min_height'],
                  'fill-extrusion-opacity': 0.6,
                },
              },
              labelLayerId,
            );
          } catch {
            // fall back to 2D silently
          }

          // Fetch collection points
          const center = map.getCenter();
          fetchCollectionPoints(map, center.lat, center.lng);

          // Fetch garbage reports
          const bounds = map.getBounds();
          if (bounds) fetchGarbageReports(map, bounds);
          fetchStats(bounds);
        });

        map.on('moveend', () => {
          if (!map) return;
          const bounds = map.getBounds();
          if (bounds) {
            fetchGarbageReports(map, bounds);
            fetchStats(bounds);
          }
          const center = map.getCenter();
          fetchCollectionPoints(map, center.lat, center.lng);
        });
      } catch {
        setMapError('Map failed to load');
      }
    }

    void initMap();

    return () => {
      map?.remove();
    };
  }, []);

  async function fetchCollectionPoints(map: import('mapbox-gl').Map, lat: number, lng: number) {
    try {
      const mapboxgl = (await import('mapbox-gl')).default;
      const res = await apiClient.get<{ data: { collectionPoints: CollectionPoint[] } }>(
        `/collection-points/nearby?lat=${lat}&lng=${lng}&radius=5000`,
      );
      const points = res.data.collectionPoints;

      // Remove existing markers (simple approach: re-add)
      document.querySelectorAll('.cp-marker').forEach((el) => el.remove());

      for (const pt of points) {
        const el = document.createElement('div');
        el.className = 'cp-marker';
        el.style.cssText = `
          width: 14px; height: 14px; border-radius: 50%;
          background: ${pt.accessTier === 'premium' ? '#16a34a' : '#2563eb'};
          border: 2px solid #fff; cursor: pointer;
          box-shadow: 0 1px 3px rgba(0,0,0,0.3);
        `;
        el.addEventListener('click', () => setPopup({ point: pt }));
        new mapboxgl.Marker({ element: el }).setLngLat([pt.lng, pt.lat]).addTo(map);
      }
    } catch {
      // ignore
    }
  }

  async function fetchGarbageReports(
    map: import('mapbox-gl').Map,
    bounds: import('mapbox-gl').LngLatBounds,
  ) {
    try {
      const mapboxgl = (await import('mapbox-gl')).default;
      const sw = bounds.getSouthWest();
      const ne = bounds.getNorthEast();
      const res = await apiClient.get<{ data: { reports: Array<{ id: number; lat: number; lng: number; createdAt: string }> } }>(
        `/garbage-reports?minLat=${sw.lat}&minLng=${sw.lng}&maxLat=${ne.lat}&maxLng=${ne.lng}`,
      );
      const reports = res.data.reports ?? [];

      document.querySelectorAll('.gr-marker').forEach((el) => el.remove());

      for (const r of reports) {
        const el = document.createElement('div');
        el.className = 'gr-marker';
        el.style.cssText = `
          width: 12px; height: 12px; border-radius: 50%;
          background: #dc2626; border: 2px solid #fff; cursor: pointer;
          box-shadow: 0 1px 3px rgba(0,0,0,0.3);
        `;
        el.title = new Date(r.createdAt).toLocaleString();
        new mapboxgl.Marker({ element: el }).setLngLat([r.lng, r.lat]).addTo(map);
      }
    } catch {
      // ignore
    }
  }

  async function fetchStats(bounds: import('mapbox-gl').LngLatBounds | null) {
    if (!bounds) return;
    try {
      const sw = bounds.getSouthWest();
      const ne = bounds.getNorthEast();
      const res = await apiClient.get<{ data: MapStats }>(
        `/map/stats?minLat=${sw.lat}&minLng=${sw.lng}&maxLat=${ne.lat}&maxLng=${ne.lng}`,
      );
      setStats(res.data);
    } catch {
      // ignore
    }
  }

  async function handleCheckIn(point: CollectionPoint) {
    setCheckinMsg(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await apiClient.post<{ data: { pointsAwarded: number; buildingPointsAwarded: number } }>(
            '/checkins',
            { lat: pos.coords.latitude, lng: pos.coords.longitude, collectionPointId: point.id },
          );
          setCheckinMsg(`✅ +${res.data.pointsAwarded} pts! Building: +${res.data.buildingPointsAwarded} pts`);
          setPopup(null);
        } catch (e) {
          if (e instanceof ApiError) {
            if (e.status === 409) {
              setCheckinMsg(`⏳ Already checked in here recently. Try again later.`);
            } else if (e.status === 422) {
              setCheckinMsg(`📍 You're too far from this location to check in.`);
            } else if (e.status === 401) {
              clearSession();
              navigate('/onboarding');
            } else {
              setCheckinMsg(`Error: ${e.message}`);
            }
          }
        }
      },
      () => setCheckinMsg('Location unavailable for check-in'),
    );
  }

  return (
    <div style={{ position: 'relative', height: '100dvh', display: 'flex', flexDirection: 'column' }}>
      {mapError ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}>
          {mapError}
        </div>
      ) : (
        <div ref={mapContainerRef} style={{ flex: 1 }} />
      )}

      {/* Stats overlay */}
      {stats && (
        <div style={{
          position: 'absolute', bottom: '5rem', left: '0.75rem',
          background: 'rgba(255,255,255,0.92)', borderRadius: '10px',
          padding: '0.5rem 0.75rem', fontSize: '0.75rem', boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
        }}>
          <div>✅ {stats.totalCheckins} check-ins</div>
          <div>🌿 {stats.totalPoints} pts</div>
          <div>🗑️ {stats.totalGarbageReports} reports</div>
        </div>
      )}

      {/* Request Bin button */}
      <button
        onClick={() => setShowBinModal(true)}
        style={{
          position: 'absolute', top: '1rem', right: '1rem',
          background: '#fff', color: '#374151', borderRadius: '8px',
          padding: '0.5rem 0.75rem', fontSize: '0.8rem', fontWeight: 600,
          boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
        }}
      >
        🗑️ Request Bin
      </button>

      {/* Check-in message */}
      {checkinMsg && (
        <div style={{
          position: 'absolute', top: '1rem', left: '1rem', right: '4.5rem',
          background: '#fff', borderRadius: '8px', padding: '0.5rem 0.75rem',
          fontSize: '0.85rem', boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
        }}>
          {checkinMsg}
          <button
            onClick={() => setCheckinMsg(null)}
            style={{ float: 'right', background: 'none', padding: 0, fontSize: '1rem', color: '#6b7280' }}
          >
            ×
          </button>
        </div>
      )}

      {/* Collection point popup */}
      {popup && (
        <div style={{
          position: 'absolute', bottom: '5rem', left: '0.75rem', right: '0.75rem',
          background: '#fff', borderRadius: '12px', padding: '1rem',
          boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1rem' }}>{popup.point.name}</div>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem', alignItems: 'center' }}>
                <span className={`badge badge-${popup.point.accessTier}`}>{popup.point.accessTier}</span>
                <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>{Math.round(popup.point.distanceMetres)} m</span>
              </div>
              {popup.point.materials.length > 0 && (
                <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                  {popup.point.materials.join(', ')}
                </div>
              )}
            </div>
            <button onClick={() => setPopup(null)} style={{ background: 'none', padding: 0, fontSize: '1.2rem', color: '#6b7280' }}>×</button>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
            <button className="btn-primary" style={{ flex: 1 }} onClick={() => handleCheckIn(popup.point)}>
              ✅ Check In
            </button>
            <button
              className="btn-secondary"
              style={{ flex: 1 }}
              onClick={() => window.open(`https://maps.google.com/?q=${popup.point.lat},${popup.point.lng}`, '_blank')}
            >
              🗺️ Directions
            </button>
          </div>
        </div>
      )}

      {showBinModal && <BinRequestModal onClose={() => setShowBinModal(false)} />}
    </div>
  );
}
