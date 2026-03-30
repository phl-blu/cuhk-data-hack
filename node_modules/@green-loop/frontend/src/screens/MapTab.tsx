import { useEffect, useRef, useState, useCallback } from 'react';
import 'mapbox-gl/dist/mapbox-gl.css';
import MaterialCamera from '../components/MaterialCamera';
import { useNavigate, useLocation } from 'react-router-dom';
import type { Feature, FeatureCollection, Point } from 'geojson';
import { apiClient, ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import BinRequestModal from './BinRequestModal';

export function getMockFillLevel(id: number): number {
  return (id * 37) % 101;
}

export function getFillCategory(pct: number): { label: string; color: string } {
  if (pct <= 20) return { label: 'Empty',  color: '#16a34a' };
  if (pct <= 40) return { label: 'Low',    color: '#16a34a' };
  if (pct <= 60) return { label: 'Medium', color: '#d97706' };
  if (pct <= 80) return { label: 'High',   color: '#dc2626' };
  return           { label: 'Full',   color: '#dc2626' };
}

// Haversine distance in metres between two lat/lng points
function haversineMetres(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Fallback collection points — shown when DB is empty or API unreachable
const FALLBACK_POINTS: CollectionPoint[] = [
  { id: 1,  name: 'Wan Chai Recycling Station',       accessTier: 'basic',   materials: ['Paper','Plastic','Metal'], lat: 22.2783, lng: 114.1825, distanceMetres: 200 },
  { id: 2,  name: 'Causeway Bay Green Corner',         accessTier: 'basic',   materials: ['Paper','Glass'],           lat: 22.2800, lng: 114.1840, distanceMetres: 350 },
  { id: 3,  name: 'Mong Kok Eco Point',                accessTier: 'premium', materials: ['E-Waste','Clothing'],      lat: 22.3193, lng: 114.1694, distanceMetres: 500 },
  { id: 4,  name: 'Tsim Sha Tsui Collection Hub',      accessTier: 'basic',   materials: ['Paper','Plastic'],         lat: 22.2988, lng: 114.1722, distanceMetres: 600 },
  { id: 5,  name: 'Sha Tin Recycling Centre',          accessTier: 'premium', materials: ['Metal','Glass','E-Waste'], lat: 22.3830, lng: 114.1952, distanceMetres: 800 },
  { id: 6,  name: 'Kwun Tong Green Station',           accessTier: 'basic',   materials: ['Paper','Plastic','Metal'], lat: 22.3130, lng: 114.2262, distanceMetres: 900 },
  { id: 7,  name: 'Sham Shui Po Eco Corner',           accessTier: 'basic',   materials: ['Clothing','Paper'],        lat: 22.3302, lng: 114.1618, distanceMetres: 1100 },
  { id: 8,  name: 'Central Recycling Drop-off',        accessTier: 'premium', materials: ['Paper','Glass','Plastic'], lat: 22.2855, lng: 114.1549, distanceMetres: 1200 },
  { id: 9,  name: 'Tuen Mun Green Point',              accessTier: 'basic',   materials: ['Plastic','Metal'],         lat: 22.3914, lng: 113.9769, distanceMetres: 1500 },
  { id: 10, name: 'Yuen Long Eco Station',             accessTier: 'basic',   materials: ['Paper','Plastic'],         lat: 22.4447, lng: 114.0228, distanceMetres: 1800 },
];

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

// Debounce helper — prevents panning outside Hong Kong
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

interface GarbageReport {
  id: number;
  lat: number;
  lng: number;
  districtName?: string | null;
  photoUrl?: string;
  createdAt: string;
}

interface PopupInfo {
  point: CollectionPoint;
}

interface ReportPopupInfo {
  report: GarbageReport;
}
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
  const [reportPopup, setReportPopup] = useState<ReportPopupInfo | null>(null);
  const [checkinMsg, setCheckinMsg] = useState<string | null>(null);
  const [showBinModal, setShowBinModal] = useState(false);
  const [showSortModal, setShowSortModal] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [checkingIn, setCheckingIn] = useState(false);
  const userPosRef = useRef<{ lat: number; lng: number } | null>(null);

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
      let points: CollectionPoint[] = [];
      try {
        const res = await apiClient.get<{ data: { points: CollectionPoint[] } }>(
          `/collection-points/nearby?lat=${lat}&lng=${lng}&radius=5000`,
        );
        points = res.data.points ?? [];
      } catch {
        // API unreachable — fall through to fallback
      }

      // Use fallback if DB is empty or API failed
      if (points.length === 0) {
        points = FALLBACK_POINTS;
      }

      // Recalculate real distance using user's actual GPS position (not map center)
      const userLat = userPosRef.current?.lat ?? lat;
      const userLng = userPosRef.current?.lng ?? lng;
      points = points.map((pt) => ({
        ...pt,
        distanceMetres: haversineMetres(userLat, userLng, pt.lat, pt.lng),
      }));
      // Sort nearest first
      points.sort((a, b) => a.distanceMetres - b.distanceMetres);

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
          background: #2563eb;
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
        data: { reports?: GarbageReport[] }
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
        el.style.cssText = `
          width: 14px; height: 14px; border-radius: 50%;
          background: #f97316; border: 2px solid #fff; cursor: pointer;
          box-shadow: 0 1px 4px rgba(0,0,0,0.35);
        `;
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          setReportPopup({ report: r });
        });
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
        // CSS is imported statically at the top of this module

        mapboxgl.accessToken = (import.meta.env['VITE_MAPBOX_TOKEN'] as string)
          || localStorage.getItem('mapbox_token')
          || '';

        if (!mapContainerRef.current || destroyed) return;

        const center = await getInitialCenter();
        if (destroyed) return;
        userPosRef.current = { lat: center[1], lng: center[0] };

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

        // User location marker — red pin
        const userEl = document.createElement('div');
        userEl.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="42" viewBox="0 0 32 42">
            <path d="M16 0C7.163 0 0 7.163 0 16c0 10.5 16 26 16 26S32 26.5 32 16C32 7.163 24.837 0 16 0z"
              fill="#ef4444" stroke="#fff" stroke-width="2"/>
            <circle cx="16" cy="16" r="6" fill="#fff"/>
          </svg>`;
        userEl.style.cssText = 'cursor: default; transform: translate(-50%, -100%);';
        userMarkerRef.current = new mapboxgl.Marker({ element: userEl, anchor: 'bottom' })
          .setLngLat(center)
          .addTo(map);

        // Watch position and update marker
        const watchId = navigator.geolocation.watchPosition(
          (pos) => {
            const lngLat: [number, number] = [pos.coords.longitude, pos.coords.latitude];
            userPosRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
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
          // ~0.008 degrees ≈ 800m — skip if barely moved
          if (dLat < 0.008 && dLng < 0.008) return;
          lastFetchCenter = center;
          const bounds = map.getBounds();
          void fetchCollectionPoints(map, center.lat, center.lng);
          if (bounds) {
            void fetchGarbageReports(map, bounds);
            void fetchStats(bounds);
          }
        }, 1500);

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

      {/* Sort Item button — top left */}
      <button
        onClick={() => setShowSortModal(true)}
        style={{
          position: 'absolute', top: '1rem', left: '1rem',
          background: '#fff', color: '#374151', borderRadius: '8px',
          padding: '0.5rem 0.75rem', fontSize: '0.8rem', fontWeight: 600,
          boxShadow: '0 1px 6px rgba(0,0,0,0.2)', zIndex: 10,
        }}
      >
        ♻️ Sort Item
      </button>

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

      {/* Sort Item modal */}
      {showSortModal && (
        <div
          onClick={() => setShowSortModal(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: '16px', padding: '1.25rem',
              width: '100%', maxWidth: '480px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <div style={{ fontWeight: 700, fontSize: '1rem' }}>♻️ How to Sort Items</div>
              <button
                onClick={() => setShowSortModal(false)}
                style={{ background: 'none', fontSize: '1.4rem', color: '#9ca3af', padding: 0, lineHeight: 1 }}
                aria-label="Close"
              >×</button>
            </div>
            <div style={{ width: '100%', height: '320px', borderRadius: '10px', overflow: 'hidden' }}>
              <MaterialCamera />
            </div>
          </div>
        </div>
      )}

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

      {/* Garbage report bottom sheet */}
      {reportPopup && (
        <div style={{
          position: 'absolute', bottom: '5rem', left: '0.75rem', right: '0.75rem',
          background: '#fff', borderRadius: '14px', padding: '1rem',
          boxShadow: '0 4px 20px rgba(0,0,0,0.18)', zIndex: 10,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1rem' }}>🗑️ Garbage Report</div>
              <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.2rem' }}>
                {reportPopup.report.districtName ?? `${reportPopup.report.lat.toFixed(4)}, ${reportPopup.report.lng.toFixed(4)}`}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.1rem' }}>
                {new Date(reportPopup.report.createdAt).toLocaleString()}
              </div>
            </div>
            <button
              onClick={() => setReportPopup(null)}
              style={{ background: 'none', padding: '0 0 0 0.5rem', fontSize: '1.3rem', color: '#9ca3af' }}
              aria-label="Close"
            >×</button>
          </div>
          {reportPopup.report.photoUrl && !reportPopup.report.photoUrl.startsWith('local://') ? (
            <img
              src={reportPopup.report.photoUrl}
              alt="Garbage report"
              style={{ width: '100%', borderRadius: '8px', maxHeight: '200px', objectFit: 'cover' }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <div style={{ background: '#f3f4f6', borderRadius: '8px', padding: '1.5rem', textAlign: 'center', color: '#9ca3af', fontSize: '0.85rem' }}>
              📷 No photo available
            </div>
          )}
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

          {(() => {
            const pct = getMockFillLevel(popup.point.id);
            const { label, color } = getFillCategory(pct);
            return (
              <div style={{ marginTop: '0.5rem' }}>
                {/* Progress bar */}
                <div style={{ background: '#e5e7eb', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, background: color, height: '100%', borderRadius: '4px' }} />
                </div>
                {/* Label row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                  <span style={{ color: '#6b7280' }}>Fill level</span>
                  <span style={{ color, fontWeight: 600 }}>{pct}% · {label}</span>
                </div>
              </div>
            );
          })()}

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
