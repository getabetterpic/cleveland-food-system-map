import 'leaflet/dist/leaflet.css';
import { DivIcon } from 'leaflet';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import type { Category, Location } from '../lib/types';

function ZoomControl() {
  const map = useMap();
  return (
    <div style={zoomStyles.wrap}>
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

const zoomStyles: Record<string, React.CSSProperties> = {
  wrap: {
    position: 'absolute',
    top: 10,
    left: 10,
    zIndex: 1000,
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
  locations?: Location[];
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
      style={{ height: 'calc(100vh - 56px)', width: '100%' }}
      aria-label="Map of Cleveland food resources"
    >
      <ZoomControl />
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
            key={loc.name + loc.lat + loc.lng}
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
