import 'leaflet/dist/leaflet.css';
import { useEffect, useState } from 'react';
import { DivIcon } from 'leaflet';
import {
  Circle,
  CircleMarker,
  MapContainer,
  TileLayer,
  Marker,
  useMap,
} from 'react-leaflet';
import type { Category, Location } from '../lib/types';

function ZoomControl() {
  const map = useMap();
  return (
    <div style={zoomStyles.group}>
      <button
        aria-label="Zoom in"
        style={zoomStyles.btn}
        onClick={() => map.zoomIn()}
      >
        +
      </button>
      <button
        aria-label="Zoom out"
        style={{ ...zoomStyles.btn, borderTop: '1px solid #ccc' }}
        onClick={() => map.zoomOut()}
      >
        −
      </button>
    </div>
  );
}

type Fix = { lat: number; lng: number; accuracy: number };

const GEO_ERRORS: Record<number, string> = {
  1: 'Location permission denied',
  2: 'Location unavailable',
  3: 'Location request timed out',
};

// One-shot fix via the Geolocation API (needs HTTPS or localhost). Shows a dot
// plus accuracy radius; nothing is stored or sent anywhere.
function LocateControl() {
  const map = useMap();
  const [fix, setFix] = useState<Fix | null>(null);
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 4000);
    return () => clearTimeout(t);
  }, [message]);

  // MapView is ssr:false, so `navigator` is safe here.
  if (!('geolocation' in navigator)) return null;

  const locate = () => {
    setLocating(true);
    setMessage(null);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const next = {
          lat: coords.latitude,
          lng: coords.longitude,
          accuracy: coords.accuracy,
        };
        setFix(next);
        setLocating(false);
        map.flyTo([next.lat, next.lng], Math.max(map.getZoom(), 15));
      },
      (err) => {
        setMessage(GEO_ERRORS[err.code] ?? 'Could not get your location');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  };

  return (
    <>
      <div style={zoomStyles.group}>
        <button
          aria-label="Show my location"
          title="Show my location"
          aria-busy={locating}
          disabled={locating}
          style={{ ...zoomStyles.btn, opacity: locating ? 0.5 : 1 }}
          onClick={locate}
        >
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="7" />
            <circle cx="12" cy="12" r="2" fill="currentColor" />
            <path d="M12 1v4M12 19v4M1 12h4M19 12h4" />
          </svg>
        </button>
      </div>
      <p role="status" style={zoomStyles.status} hidden={!message}>
        {message}
      </p>
      {fix && (
        <>
          <Circle
            center={[fix.lat, fix.lng]}
            radius={fix.accuracy}
            interactive={false}
            pathOptions={{ color: '#1d4ed8', weight: 1, fillOpacity: 0.1 }}
          />
          <CircleMarker
            center={[fix.lat, fix.lng]}
            radius={7}
            interactive={false}
            pathOptions={{
              color: '#fff',
              weight: 2,
              fillColor: '#1d4ed8',
              fillOpacity: 1,
            }}
          />
        </>
      )}
    </>
  );
}

const zoomStyles: Record<string, React.CSSProperties> = {
  wrap: {
    position: 'absolute',
    top: 10,
    left: 10,
    zIndex: 1000,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 10,
  },
  group: {
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 1px 5px rgba(0,0,0,0.4)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  btn: {
    width: 30,
    height: 30,
    background: '#fff',
    border: 'none',
    fontSize: 18,
    fontWeight: 700,
    lineHeight: 1,
    cursor: 'pointer',
    color: '#333',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
  },
  status: {
    margin: 0,
    padding: '4px 8px',
    background: '#111',
    color: '#fff',
    fontSize: 13,
    borderRadius: 4,
    whiteSpace: 'nowrap',
  },
};

const CATEGORY_COLOR: Record<Category, string> = {
  garden: '#3a7d44',
  farm: '#c0392b',
  market: '#7b2d8b',
};

const CATEGORY_LABEL: Record<Category, string> = {
  garden: 'Community Garden',
  farm: 'Urban Farm',
  market: 'Farmers Market / Farm Stand',
};

function makePinIcon(category: Category): DivIcon {
  const color = CATEGORY_COLOR[category];
  const label = CATEGORY_LABEL[category];
  // Teardrop: circle body tapering to a downward point
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 32" width="24" height="32" role="img" aria-label="${label}">` +
    `<path d="M12 0C7.58 0 4 3.58 4 8c0 5.25 8 16 8 16s8-10.75 8-16c0-4.42-3.58-8-8-8z"` +
    ` fill="${color}" stroke="rgba(0,0,0,0.25)" stroke-width="1"/>` +
    `</svg>`;
  return new DivIcon({
    html: svg,
    className: '', // suppress default leaflet-div-icon white box
    iconSize: [24, 32],
    iconAnchor: [12, 32], // tip of the pin sits on the coordinate
  });
}

// Pre-built — one icon instance per category, not per marker
const PIN_ICONS: Record<Category, DivIcon> = {
  garden: makePinIcon('garden'),
  farm: makePinIcon('farm'),
  market: makePinIcon('market'),
};

const CLEVELAND: [number, number] = [41.482, -81.668];

interface Props {
  locations: Location[];
  activeCategories: Category[];
  onSelectLocation: (location: Location) => void;
}

export default function MapView({
  locations,
  activeCategories,
  onSelectLocation,
}: Props) {
  return (
    <MapContainer
      center={CLEVELAND}
      zoom={12}
      zoomControl={false}
      style={{ flex: 1, minHeight: 0, width: '100%' }}
      aria-label="Map of Cleveland food resources"
    >
      <div style={zoomStyles.wrap}>
        <ZoomControl />
        <LocateControl />
      </div>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      {locations
        .filter(
          (loc) =>
            loc.lat !== null &&
            loc.lng !== null &&
            activeCategories.includes(loc.category),
        )
        .map((loc) => (
          <Marker
            key={loc.id}
            position={[loc.lat as number, loc.lng as number]}
            icon={PIN_ICONS[loc.category]}
            title={loc.name}
            alt={`${CATEGORY_LABEL[loc.category]}: ${loc.name}`}
            eventHandlers={{ click: () => onSelectLocation(loc) }}
          />
        ))}
    </MapContainer>
  );
}
