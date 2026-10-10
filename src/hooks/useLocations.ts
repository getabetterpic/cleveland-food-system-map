import { useEffect, useState } from 'react';
import supabase from '../lib/supabase';
import type { Location } from '../lib/types';

interface UseLocationsResult {
  locations: Location[];
  loading: boolean;
  error: string | null;
}

export default function useLocations(): UseLocationsResult {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    supabase
      .from('locations')
      .select('*')
      .eq('status', 'published')
      .then(({ data, error: sbError }) => {
        if (cancelled) return;
        if (sbError) {
          setError(sbError.message);
        } else {
          setLocations(data ?? []);
        }
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { locations, loading, error };
}
