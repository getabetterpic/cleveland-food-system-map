import { getPublishedLocations } from '@/lib/db/queries';
import MapClient from './MapClient';

export default async function MapPage() {
  return <MapClient locations={await getPublishedLocations()} />;
}
