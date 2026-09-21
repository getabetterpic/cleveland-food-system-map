import { useEffect, useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import MapView from '../components/MapView';
import CategoryFilter from '../components/CategoryFilter';
import SearchBar from '../components/SearchBar';
import LocationPanel from '../components/LocationPanel';
import type { Category, Location } from '../lib/types';

const ALL_CATEGORIES: Category[] = ['garden', 'farm', 'market'];

export default function MapPage() {
  const locations = useQuery(api.locations.getLocations, {});
  // const { locations, loading } = useLocations();
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
    ? locations?.filter((l) => {
        const q = debouncedQuery.toLowerCase();
        return (
          l.name.toLowerCase().includes(q) ||
          (l.notes ?? '').toLowerCase().includes(q)
        );
      })
    : locations;

  const counts: Record<Category, number> = {
    garden: filtered?.filter((l) => l.category === 'garden').length ?? 0,
    farm: filtered?.filter((l) => l.category === 'farm').length ?? 0,
    market:
      filtered?.filter((l) => l.category.startsWith('market')).length ?? 0,
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
      {filtered?.length && (
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
