// Maidenhead locator <-> latitude/longitude conversion helpers.

export interface LatLon {
  lat: number
  lon: number
}

const LOCATOR_RE = /^[A-R]{2}[0-9]{2}([A-X]{2})?$/i

/**
 * Validate a 4 or 6 character Maidenhead grid locator.
 */
export function isValidLocator(grid: string): boolean {
  return LOCATOR_RE.test(grid.trim())
}

/**
 * Convert a Maidenhead grid locator (4 or 6 chars) to the lat/lon of the
 * center of the referenced square/subsquare.
 */
export function gridToLatLon(grid: string): LatLon | null {
  const g = grid.trim().toUpperCase()
  if (!isValidLocator(g)) return null

  const A = "A".charCodeAt(0)
  const zero = "0".charCodeAt(0)

  // Field (20° lon x 10° lat)
  let lon = (g.charCodeAt(0) - A) * 20 - 180
  let lat = (g.charCodeAt(1) - A) * 10 - 90

  // Square (2° lon x 1° lat)
  lon += (g.charCodeAt(2) - zero) * 2
  lat += (g.charCodeAt(3) - zero) * 1

  if (g.length === 6) {
    // Subsquare (5' lon x 2.5' lat)
    lon += (g.charCodeAt(4) - A) * (5 / 60)
    lat += (g.charCodeAt(5) - A) * (2.5 / 60)
    // Center of the subsquare
    lon += 2.5 / 60
    lat += 1.25 / 60
  } else {
    // Center of the square
    lon += 1
    lat += 0.5
  }

  return { lat, lon }
}
