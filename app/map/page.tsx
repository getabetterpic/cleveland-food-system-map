import {
  getEditorContacts,
  getPublishedLocations,
  isEditor,
} from '@/lib/db/queries';
import MapClient from './MapClient';

export default async function MapPage() {
  return (
    <MapClient
      locations={await getPublishedLocations()}
      // Not awaited: the cached map renders immediately and contacts stream in
      // for editors only (read with use() inside LocationPanel).
      contacts={getEditorContacts()}
      canEdit={isEditor()}
    />
  );
}
