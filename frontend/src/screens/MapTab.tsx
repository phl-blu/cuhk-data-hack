import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import type { Feature, FeatureCollection, Point } from 'geojson';
import { apiClient, ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import BinRequestModal from './BinRequestModal';

// District centroids for fallback when geolocation is unavailable
const DISTRICT_CENTROIDS: Record<string, [number, number]> = {
  'Central and Western': [114.1549, 22.2855],
  'Eastern': [114.2262, 22.2830],
  'Southern': [114.1694, 22.2463],
  'Wan Chai': [114.1825, 22.2783],
  'Kowloon City': [114.1916, 22.3282],
  'Kwun Tong': [114.2262, 22.3130],
  'Sham Shui Po': [114.1618, 22.3302],
  'Wong Tai Sin': [114.1935, 22.3425],
  'Yau Tsim Mong': [114.1722, 22.3100],
  'Islands': [113.9494, 22.2611],
  'Kwai Tsing': [114.1288, 22.3547],
  'North': [114.1477, 22.4947],
  'Sai Kung': [114.2700, 22.3814],
  'Sha Tin': [114.1952, 22.3830],
  'Tai Po': [114.1694, 22.4500],
  'Tsuen Wan': [114.1077, 22.3714],
  'Tuen Mun': [113.9769, 22.3914],
  'Yuen Long': [114.0228, 22.4447],
};

// HK bounding box — prevents panning outside Hong Kong
const HK_BOUNDS: [[number, number], [number, number]] = [
  [113.7, 22.1], // SW
  [114.5, 22.6], // NE
];

const DEFAULT_CENTER: [number, number] = [114.1694, 22.3193]; // HK centre

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

// Debounce helper
function debounce<T extends (...args: Parameters<T>) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout>;
  return ((...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  }) as T;
}

export default function MapTab() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import('mapbox-gl').Map | null>(null);
  const markersRef = useRef<import('mapbox-gl').Marker[]>([]);
  const userMarkerRef = useRef<import('mapbox-gl').Marker | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const navState = location.state as { centerLat?: number; centerLng?: number } | null;
  const { session, clearSession } = useAuth();

  const [stats, setStats] = useState<MapStats | null>(null);
  const [popup, setPopup] = useState<PopupInfo | null>(null);
  const [checkinMsg, setCheckinMsg] = useState<string | null>(null);
  const [showBinModal, setShowBinModal] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [checkingIn, setCheckingIn] = useState(false);

  // Determine initial center: nav state > device location > district centroid > default
  function getInitialCenter(): Promise<[number, number]> {
    if (navState?.centerLng != null && navState?.centerLat != null) {
      return Promise.resolve([navState.centerLng, navState.centerLat]);
    }
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve([pos.coords.longitude, pos.coords.latitude]),
        () => {
          const district = session?.district;
          const centroid = district ? DISTRICT_CENTROIDS[district] : undefined;
          resolve(centroid ?? DEFAULT_CENTER);
        },
        { timeout: 5000, maximumAge: 60000 },
      );
    });
  }

  const fetchCollectionPoints = useCallback(async (
    map: import('mapbox-gl').Map,
    lat: number,
    lng: number,
  ) => {
    try {
      const mapboxgl = (await import('mapbox-gl')).default;
      const res = await apiClient.get<{ data: { points: CollectionPoint[] } }>(
        `/collection-points/nearby?lat=${lat}&lng=${lng}&radius=5000`,
      );
      const points: CollectionPoint[] = res.data.points ?? [];

      // Remove old CP markers
      markersRef.current = markersRef.current.filter((m) => {
        const el = m.getElement();
        if (el.classList.contains('cp-marker')) { m.remove(); return false; }
        return true;
      });

      for (const pt of points) {
        const el = document.createElement('div');
        el.className = 'cp-marker';
        el.style.cssText = `
          width: 14px; height: 14px; border-radius: 50%;
          background: ${pt.accessTier === 'premium' ? '#16a34a' : '#2563eb'};
          border: 2px solid #fff; cursor: pointer;
          box-shadow: 0 1px 4px rgba(0,0,0,0.35);
        `;
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          setPopup({ point: pt });
        });
        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat([pt.lng, pt.lat])
          .addTo(map);
        markersRef.current.push(marker);
      }
    } catch {
      // ignore — map still usable
    }
  }, []);

  const fetchGarbageReports = useCallback(async (
    map: import('mapbox-gl').Map,
    bounds: import('mapbox-gl').LngLatBounds,
  ) => {
    try {
      const mapboxgl = (await import('mapbox-gl')).default;
      const sw = bounds.getSouthWest();
      const ne = bounds.getNorthEast();
      const res = await apiClient.get<{
        data: { reports?: Array<{ id: number; lat: number; lng: number; createdAt: string }> }
      }>(`/garbage-reports?minLat=${sw.lat}&minLng=${sw.lng}&maxLat=${ne.lat}&maxLng=${ne.lng}`);
      const reports = res.data.reports ?? [];

      // Remove old GR markers
      markersRef.current = markersRef.current.filter((m) => {
        const el = m.getElement();
        if (el.classList.contains('gr-marker')) { m.remove(); return false; }
        return true;
      });

      for (const r of reports) {
        const el = document.createElement('div');
        el.className = 'gr-marker';
        el.title = new Date(r.createdAt).toLocaleString();
        el.style.cssText = `
          width: 12px; height: 12px; border-radius: 50%;
          background: #dc2626; border: 2px solid #fff; cursor: pointer;
          box-shadow: 0 1px 4px rgba(0,0,0,0.35);
        `;
        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat([r.lng, r.lat])
          .addTo(map);
        markersRef.current.push(marker);
      }
    } catch {
      // ignore
    }
  }, []);

  const fetchStats = useCallback(async (bounds: import('mapbox-gl').LngLatBounds | null) => {
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
  }, []);

  const fetchUnderservedAreas = useCallback(async (map: import('mapbox-gl').Map) => {
    try {
      const res = await apiClient.get<{ data: { underserved: Array<{ districtName: string; density: number }> } }>(
        '/collection-points/underserved',
      );
      const areas = res.data.underserved ?? [];
      if (areas.length === 0) return;

      // Render underserved district centroids as a distinct shaded circle layer
      const features = areas
        .map((a) => {
          const centroid = DISTRICT_CENTROIDS[a.districtName];
          if (!centroid) return null;
          const f: Feature<Point> = {
            type: 'Feature',
            properties: { districtName: a.districtName, density: a.density },
            geometry: { type: 'Point', coordinates: centroid },
          };
          return f;
        })
        .filter((f): f is Feature<Point> => f !== null);

      if (map.getSource('underserved-source')) {
        (map.getSource('underserved-source') as import('mapbox-gl').GeoJSONSource).setData({
          type: 'FeatureCollection',
          features,
        } as FeatureCollection);
      } else {
        map.addSource('underserved-source', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features } as FeatureCollection,
        });

        // Distinct fill/halo layer for underserved areas
        map.addLayer({
          id: 'underserved-halo',
          type: 'circle',
          source: 'underserved-source',
          paint: {
            'circle-radius': 40,
            'circle-color': '#f97316',
            'circle-opacity': 0.18,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#f97316',
            'circle-stroke-opacity': 0.5,
          },
        });
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    let map: import('mapbox-gl').Map | null = null;
    let destroyed = false;

    async function initMap() {
      try {
        const mapboxgl = (await import('mapbox-gl')).default;
        await import('mapbox-gl/dist/mapbox-gl.css');

        mapboxgl.accessToken = (import.meta.env['VITE_MAPBOX_TOKEN'] as string)
          || localStorage.getItem('mapbox_token')
          || '';

        if (!mapContainerRef.current || destroyed) return;

        const center = await getInitialCenter();
        if (destroyed) return;

        map = new mapboxgl.Map({
          container: mapContainerRef.current,
          style: 'mapbox://styles/mapbox/streets-v12',
          center,
          zoom: navState?.centerLat != null ? 15 : 12,
          pitch: 45,
          bearing: -17.6,
          maxBounds: HK_BOUNDS,
        });

        mapRef.current = map;

        // User location marker (blue dot with red border)
        const userEl = document.createElement('div');
        userEl.style.cssText = `
          width: 16px; height: 16px; border-radius: 50%;
          background: #ef4444; border: 3px solid #fff;
          box-shadow: 0 0 0 3px rgba(239,68,68,0.35);
        `;
        userMarkerRef.current = new mapboxgl.Marker({ element: userEl })
          .setLngLat(center)
          .addTo(map);

        // Watch position and update marker
        const watchId = navigator.geolocation.watchPosition(
          (pos) => {
            const lngLat: [number, number] = [pos.coords.longitude, pos.coords.latitude];
            userMarkerRef.current?.setLngLat(lngLat);
          },
          () => { /* ignore — marker stays at initial center */ },
          { maximumAge: 30000, timeout: 10000 },
        );

        map.on('load', () => {
          if (!map || destroyed) return;

          // 3D buildings — fall back silently if WebGL or layer unavailable
          try {
            const layers = map.getStyle().layers ?? [];
            let labelLayerId: string | undefined;
            for (const layer of layers) {
              if (
                layer.type === 'symbol' &&
                'layout' in layer &&
                (layer.layout as Record<string, unknown>)['text-field']
              ) {
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
            // 2D fallback — no action needed
          }

          const mapCenter = map.getCenter();
          void fetchCollectionPoints(map, mapCenter.lat, mapCenter.lng);

          const bounds = map.getBounds();
          if (bounds) {
            void fetchGarbageReports(map, bounds);
            void fetchStats(bounds);
          }

          void fetchUnderservedAreas(map);
        });

        // Debounced handler for pan/zoom — only refetch if moved >300m
        let lastFetchCenter = map.getCenter();
        const onMoveEnd = debounce(() => {
          if (!map || destroyed) return;
          const center = map.getCenter();
          const dLat = Math.abs(center.lat - lastFetchCenter.lat);
          const dLng = Math.abs(center.lng - lastFetchCenter.lng);
          // ~0.003 degrees ≈ 300m — skip if barely moved
          if (dLat < 0.003 && dLng < 0.003) return;
          lastFetchCenter = center;
          const bounds = map.getBounds();
          void fetchCollectionPoints(map, center.lat, center.lng);
          if (bounds) {
            void fetchGarbageReports(map, bounds);
            void fetchStats(bounds);
          }
        }, 800);

        map.on('moveend', onMoveEnd);

        // Store watchId for cleanup
        (map as unknown as { _watchId?: number })._watchId = watchId;
      } catch {
        if (!destroyed) setMapError('Map failed to load');
      }
    }

    void initMap();

    return () => {
      destroyed = true;
      const watchId = (map as unknown as { _watchId?: number })?._watchId;
      if (watchId != null) navigator.geolocation.clearWatch(watchId);
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map?.remove();
      mapRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCheckIn(point: CollectionPoint) {
    if (checkingIn) return;
    setCheckinMsg(null);
    setCheckingIn(true);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await apiClient.post<{
            data: { pointsAwarded: number; buildingPointsAwarded: number; totalPoints: number };
          }>('/checkins', {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            collectionPointId: point.id,
          });
          setCheckinMsg(
            `✅ +${res.data.pointsAwarded} pts earned! Building: +${res.data.buildingPointsAwarded} pts credited.`,
          );
          setPopup(null);
        } catch (e) {
          if (e instanceof ApiError) {
            if (e.status === 409) {
              // retryAfterSeconds comes from the error body (default 3600 = 60 min)
              const retryAfterSeconds = typeof e.data['retryAfterSeconds'] === 'number'
                ? e.data['retryAfterSeconds']
                : 3600;
              const retryMins = Math.ceil(retryAfterSeconds / 60);
              setCheckinMsg(`⏳ Already checked in here recently. Try again in ${retryMins} min.`);
            } else if (e.status === 422) {
              setCheckinMsg(`📍 You're too far from this location to check in.`);
            } else if (e.status === 401) {
              clearSession();
              navigate('/onboarding');
            } else {
              setCheckinMsg(`Something went wrong. Please try again.`);
            }
          }
        } finally {
          setCheckingIn(false);
        }
      },
      () => {
        setCheckinMsg('📍 Location unavailable. Enable GPS to check in.');
        setCheckingIn(false);
      },
      { timeout: 8000, maximumAge: 30000 },
    );
  }

  return (
    <div style={{ position: 'relative', height: '100dvh', display: 'flex', flexDirection: 'column' }}>
      {mapError ? (
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#6b7280', flexDirection: 'column', gap: '0.5rem',
        }}>
          <span style={{ fontSize: '2rem' }}>🗺️</span>
          <span>{mapError}</span>
        </div>
      ) : (
        <div ref={mapContainerRef} style={{ flex: 1 }} />
      )}

      {/* Live stats overlay */}
      {stats && (
        <div style={{
          position: 'absolute', bottom: '5.5rem', left: '0.75rem',
          background: 'rgba(255,255,255,0.93)', borderRadius: '10px',
          padding: '0.5rem 0.75rem', fontSize: '0.75rem',
          boxShadow: '0 1px 6px rgba(0,0,0,0.15)', lineHeight: 1.6,
          pointerEvents: 'none',
        }}>
          <div>✅ {stats.totalCheckins} check-ins</div>
          <div>🌿 {stats.totalPoints} pts</div>
          <div>🗑️ {stats.totalGarbageReports} reports</div>
        </div>
      )}

      {/* Request Bin button — always visible */}
      <button
        onClick={() => setShowBinModal(true)}
        style={{
          position: 'absolute', top: '1rem', right: '1rem',
          background: '#fff', color: '#374151', borderRadius: '8px',
          padding: '0.5rem 0.75rem', fontSize: '0.8rem', fontWeight: 600,
          boxShadow: '0 1px 6px rgba(0,0,0,0.2)', zIndex: 10,
        }}
      >
        🗑️ Request Bin
      </button>

      {/* Check-in / error message toast */}
      {checkinMsg && (
        <div style={{
          position: 'absolute', top: '1rem', left: '1rem', right: '7rem',
          background: '#fff', borderRadius: '8px', padding: '0.5rem 0.75rem',
          fontSize: '0.82rem', boxShadow: '0 1px 6px rgba(0,0,0,0.2)', zIndex: 10,
        }}>
          {checkinMsg}
          <button
            onClick={() => setCheckinMsg(null)}
            style={{
              float: 'right', background: 'none', padding: 0,
              fontSize: '1rem', color: '#6b7280', lineHeight: 1,
            }}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {/* Collection point bottom sheet */}
      {popup && (
        <div style={{
          position: 'absolute', bottom: '5rem', left: '0.75rem', right: '0.75rem',
          background: '#fff', borderRadius: '14px', padding: '1rem',
          boxShadow: '0 4px 20px rgba(0,0,0,0.18)', zIndex: 10,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.3rem' }}>
                {popup.point.name}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <span className={`badge badge-${popup.point.accessTier}`}>
                  {popup.point.accessTier}
                </span>
                <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                  {Math.round(popup.point.distanceMetres)} m away
                </span>
              </div>
              {popup.point.materials.length > 0 && (
                <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.3rem' }}>
                  {popup.point.materials.join(' · ')}
                </div>
              )}
            </div>
            <button
              onClick={() => setPopup(null)}
              style={{ background: 'none', padding: '0 0 0 0.5rem', fontSize: '1.3rem', color: '#9ca3af' }}
              aria-label="Close"
            >
              ×
            </button>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.85rem' }}>
            <button
              className="btn-primary"
              style={{ flex: 1 }}
              disabled={checkingIn}
              onClick={() => void handleCheckIn(popup.point)}
            >
              {checkingIn ? '…' : '✅ Check In'}
            </button>
            <button
              className="btn-secondary"
              style={{ flex: 1 }}
              onClick={() =>
                window.open(
                  `https://maps.google.com/?q=${popup.point.lat},${popup.point.lng}`,
                  '_blank',
                  'noopener,noreferrer',
                )
              }
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
