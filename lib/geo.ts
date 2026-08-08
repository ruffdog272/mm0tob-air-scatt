// Great-circle geometry helpers. All angles in degrees unless noted.

import type { LatLon } from "./maidenhead"

export const EARTH_RADIUS_KM = 6371.0088
export const KM_PER_NM = 1.852

const toRad = (d: number) => (d * Math.PI) / 180
const toDeg = (r: number) => (r * 180) / Math.PI

/** Great-circle distance in kilometers (haversine). */
export function distanceKm(a: LatLon, b: LatLon): number {
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** Initial bearing (azimuth) from point a to point b, 0-360 degrees. */
export function bearing(a: LatLon, b: LatLon): number {
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const dLon = toRad(b.lon - a.lon)
  const y = Math.sin(dLon) * Math.cos(lat2)
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon)
  return (toDeg(Math.atan2(y, x)) + 360) % 360
}

/** Midpoint along the great circle between a and b. */
export function midpoint(a: LatLon, b: LatLon): LatLon {
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const dLon = toRad(b.lon - a.lon)
  const bx = Math.cos(lat2) * Math.cos(dLon)
  const by = Math.cos(lat2) * Math.sin(dLon)
  const lat3 = Math.atan2(
    Math.sin(lat1) + Math.sin(lat2),
    Math.sqrt((Math.cos(lat1) + bx) ** 2 + by ** 2),
  )
  const lon3 = toRad(a.lon) + Math.atan2(by, Math.cos(lat1) + bx)
  return { lat: toDeg(lat3), lon: ((toDeg(lon3) + 540) % 360) - 180 }
}

/**
 * Signed cross-track distance (km) of point p from the great-circle path
 * defined by start -> end. Sign indicates which side of the path.
 */
export function crossTrackKm(p: LatLon, start: LatLon, end: LatLon): number {
  const d13 = distanceKm(start, p) / EARTH_RADIUS_KM
  const brng13 = toRad(bearing(start, p))
  const brng12 = toRad(bearing(start, end))
  return Math.asin(Math.sin(d13) * Math.sin(brng13 - brng12)) * EARTH_RADIUS_KM
}

/**
 * Sample `n` points along the great circle between a and b for drawing a
 * smooth path (returns [lat, lon] tuples for Leaflet).
 */
export function greatCirclePoints(
  a: LatLon,
  b: LatLon,
  n = 64,
): [number, number][] {
  const lat1 = toRad(a.lat)
  const lon1 = toRad(a.lon)
  const lat2 = toRad(b.lat)
  const lon2 = toRad(b.lon)
  const d =
    2 *
    Math.asin(
      Math.sqrt(
        Math.sin((lat2 - lat1) / 2) ** 2 +
          Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2,
      ),
    )
  if (d === 0) return [[a.lat, a.lon]]
  const pts: [number, number][] = []
  for (let i = 0; i <= n; i++) {
    const f = i / n
    const A = Math.sin((1 - f) * d) / Math.sin(d)
    const B = Math.sin(f * d) / Math.sin(d)
    const x =
      A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2)
    const y =
      A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2)
    const z = A * Math.sin(lat1) + B * Math.sin(lat2)
    const lat = Math.atan2(z, Math.sqrt(x * x + y * y))
    const lon = Math.atan2(y, x)
    pts.push([toDeg(lat), toDeg(lon)])
  }
  return pts
}

/**
 * Take-off / elevation angle (degrees above the horizon) from a ground
 * station to a target at altitude `altKm`, given great-circle ground
 * distance `groundKm`. Accounts for Earth curvature. Clamped to >= 0.
 */
export function elevationAngleDeg(groundKm: number, altKm: number): number {
  const R = EARTH_RADIUS_KM
  const d = groundKm / R // central angle (rad)
  const num = Math.cos(d) - R / (R + altKm)
  const den = Math.sin(d)
  if (den <= 1e-9) return 90
  const el = toDeg(Math.atan2(num, den))
  return Math.max(0, el)
}

/**
 * Local East/North unit-ish displacement in km from origin to point,
 * using an equirectangular approximation (good for short ranges).
 */
export function localENU(
  origin: LatLon,
  point: LatLon,
): { east: number; north: number } {
  const meanLat = toRad((origin.lat + point.lat) / 2)
  const east = toRad(point.lon - origin.lon) * Math.cos(meanLat) * EARTH_RADIUS_KM
  const north = toRad(point.lat - origin.lat) * EARTH_RADIUS_KM
  return { east, north }
}
