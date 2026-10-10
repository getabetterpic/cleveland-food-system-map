import { createBrowserClient } from '@supabase/ssr';
import type { Location, NewLocation } from './types';

interface Database {
  public: {
    Tables: {
      locations: {
        Row: Location;
        Insert: NewLocation;
        Update: Partial<NewLocation>;
      };
    };
  };
}

const supabase = createBrowserClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
);

export default supabase;
