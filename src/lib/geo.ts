export type LatLng = { lat: number; lng: number };

/** A Geolocation API fix; `accuracy` is a radius in meters. */
export type UserPosition = LatLng & { accuracy: number };

const EARTH_RADIUS_MI = 3958.8;
const rad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle (haversine) distance — straight line, not travel distance. */
export function distanceMiles(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_MI * Math.asin(Math.sqrt(h));
}

export function formatMiles(mi: number): string {
  if (mi < 0.1) return '< 0.1 mi';
  return `${mi < 10 ? mi.toFixed(1) : Math.round(mi)} mi`;
}
