'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import CategoryFilter from '@/src/components/CategoryFilter';
import SearchBar from '@/src/components/SearchBar';
import LocationPanel from '@/src/components/LocationPanel';
import useIsDesktop from '@/src/hooks/useIsDesktop';
import { distanceMiles, formatMiles, type UserPosition } from '@/src/lib/geo';
import type { Category, EditorContacts, Location } from '@/src/lib/types';

// Leaflet touches `window` at import time — client-only.
const MapView = dynamic(() => import('@/src/components/MapView'), {
  ssr: false,
});

const ALL_CATEGORIES: Category[] = ['garden', 'farm', 'market'];

export default function MapClient({
  locations,
  contacts,
}: {
  locations: Location[];
  contacts: EditorContacts;
}) {
  const [activeCategories, setActiveCategories] =
    useState<Category[]>(ALL_CATEGORIES);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(
    null,
  );
  const [userPosition, setUserPosition] = useState<UserPosition | null>(null);
  const isDesktop = useIsDesktop();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 200);
    return () => clearTimeout(t);
  }, [query]);

  const filtered = debouncedQuery.trim()
    ? locations.filter((l) => {
        const q = debouncedQuery.toLowerCase();
        return (
          l.name.toLowerCase().includes(q) ||
          (l.notes ?? '').toLowerCase().includes(q)
        );
      })
    : locations;

  const counts: Record<Category, number> = {
    garden: filtered.filter((l) => l.category === 'garden').length,
    farm: filtered.filter((l) => l.category === 'farm').length,
    market: filtered.filter((l) => l.category === 'market').length,
  };

  // Closest of what's currently on the map (search + category filters).
  // ~100 rows — a linear scan in the browser beats any server round-trip, and
  // the user's position never leaves the device.
  let nearest: { location: Location; miles: number } | null = null;
  if (userPosition) {
    for (const l of filtered) {
      if (l.lat === null || l.lng === null) continue;
      if (!activeCategories.includes(l.category)) continue;
      const miles = distanceMiles(userPosition, { lat: l.lat, lng: l.lng });
      if (!nearest || miles < nearest.miles) nearest = { location: l, miles };
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
      }}
    >
      <SearchBar value={query} onChange={setQuery} />
      <CategoryFilter
        activeCategories={activeCategories}
        counts={counts}
        onChange={setActiveCategories}
      />
      {nearest && !isDesktop && (
        <button
          type="button"
          style={styles.nearest}
          onClick={() => setSelectedLocation(nearest.location)}
        >
          Nearest: <strong>{nearest.location.name}</strong> ·{' '}
          {formatMiles(nearest.miles)}
        </button>
      )}
      <div style={styles.mapArea}>
        {/* Desktop: a strip above a wide map is easy to miss — float a card
            over the map's top-right (zoom/locate controls sit top-left, the
            location panel opens on the left). */}
        {nearest && isDesktop && (
          <button
            type="button"
            style={styles.nearestCard}
            onClick={() => setSelectedLocation(nearest.location)}
          >
            <span style={styles.nearestLabel}>Nearest to you</span>
            <span style={styles.nearestName}>{nearest.location.name}</span>
            <span style={styles.nearestMeta}>
              {formatMiles(nearest.miles)} · straight line
            </span>
          </button>
        )}
        <MapView
          locations={filtered}
          activeCategories={activeCategories}
          selectedLocation={selectedLocation}
          onSelectLocation={setSelectedLocation}
          userPosition={userPosition}
          onLocate={setUserPosition}
        />
      </div>
      <LocationPanel
        location={selectedLocation}
        contacts={contacts}
        userPosition={userPosition}
        onClose={() => setSelectedLocation(null)}
      />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  mapArea: {
    position: 'relative',
    display: 'flex',
    flex: 1,
    minHeight: 0,
  },
  nearestCard: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 1000, // above Leaflet panes, below the location panel (1200)
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    maxWidth: 280,
    padding: '10px 14px',
    background: '#fff',
    border: 'none',
    borderLeft: '4px solid #3a7d44',
    borderRadius: 6,
    boxShadow: '0 2px 12px rgba(0,0,0,0.2)',
    textAlign: 'left',
    cursor: 'pointer',
  },
  nearestLabel: {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
    color: '#6b6375',
  },
  nearestName: {
    fontSize: 16,
    fontWeight: 600,
    color: '#08060d',
  },
  nearestMeta: {
    fontSize: 13,
    color: '#6b6375',
  },
  nearest: {
    display: 'block',
    width: '100%',
    padding: '8px 12px',
    background: '#f4f4f5',
    border: 'none',
    borderBottom: '1px solid #e5e4e7',
    textAlign: 'left',
    fontSize: 14,
    color: '#08060d',
    cursor: 'pointer',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
};
