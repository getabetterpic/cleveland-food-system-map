'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import useLocations from '@/src/hooks/useLocations';
import CategoryFilter from '@/src/components/CategoryFilter';
import SearchBar from '@/src/components/SearchBar';
import LocationPanel from '@/src/components/LocationPanel';
import type { Category, Location } from '@/src/lib/types';

// Leaflet touches `window` at import time — client-only.
const MapView = dynamic(() => import('@/src/components/MapView'), {
  ssr: false,
});

const ALL_CATEGORIES: Category[] = ['garden', 'farm', 'market'];

export default function MapPage() {
  const { locations, loading } = useLocations();
  const [activeCategories, setActiveCategories] =
    useState<Category[]>(ALL_CATEGORIES);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(
    null,
  );

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

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh',
        overflow: 'hidden',
      }}
    >
      <SearchBar value={query} onChange={setQuery} />
      <CategoryFilter
        activeCategories={activeCategories}
        counts={counts}
        onChange={setActiveCategories}
      />
      {!loading && (
        <MapView
          locations={filtered}
          activeCategories={activeCategories}
          onSelectLocation={setSelectedLocation}
        />
      )}
      <LocationPanel
        location={selectedLocation}
        onClose={() => setSelectedLocation(null)}
      />
    </div>
  );
}
