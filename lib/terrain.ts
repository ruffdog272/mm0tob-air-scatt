// Radio horizon / take-off angle analysis over a great-circle terrain profile.
//
// NOTE ON PHYSICS: aircraft scatter does NOT rely on a direct line of sight
// between the two ground stations. Both stations beam UP toward a common
// reflection point in the sky (an aircraft's skin at altitude), so a hill on
// the ground between them does not "block" the contact. What matters instead
// is the LOCAL horizon at each station: the minimum antenna take-off (elevation)
// angle needed to clear nearby hills and get the beam into the sky.

import { EARTH_RADIUS_KM } from "./geo"
import type { LatLon } from "./maidenhead"

export interface TerrainProfile {
  /** cumulative distance from HOME along the path (km), length 20 */
  distances: number[]
  /** ground elevation above sea level at each sample (m), length 20 */
  elevations: number[]
  points: LatLon[]
  totalKm: number
}

export interface ClearanceResult {
  /** HOME antenna height above sea level (m) = ground + AGL */
  homeAsl: number
  /** DX antenna height above sea level (m) = ground + AGL */
  dxAsl: number
  homeGround: number
  dxGround: number
  /** straight direct-path height (m ASL) at each sample — reference only */
  losLine: number[]
  /** terrain height plus Earth-curvature bulge (m ASL) at each sample */
  effectiveTerrain: number[]
  /** minimum take-off angle (deg) HOME needs to clear its local terrain */
  homeTakeoffDeg: number
  /** minimum take-off angle (deg) DX needs to clear its local terrain */
  dxTakeoffDeg: number
  /** distance (km) from HOME to its limiting obstruction */
  homeObstructionKm: number
  /** distance (km) from DX to its limiting obstruction */
  dxObstructionKm: number
  /** sample index of HOME's limiting obstruction */
  homeObstructionIndex: number
  /** sample index of DX's limiting obstruction */
  dxObstructionIndex: number
}

/**
 * Compute the horizon clearance for both stations given antenna heights above
 * ground level (meters) and optional manual ground-elevation overrides.
 *
 * For each station we scan the terrain along the beam path and find the largest
 * elevation angle any hill subtends above the antenna. That angle is the minimum
 * take-off angle required to clear the local terrain and reach the sky.
 */
export function analyzeClearance(
  profile: TerrainProfile,
  homeAglM: number,
  dxAglM: number,
  homeGroundOverride?: number | null,
  dxGroundOverride?: number | null,
): ClearanceResult {
  const { distances, elevations, totalKm } = profile
  const n = elevations.length

  const homeGround =
    homeGroundOverride != null && Number.isFinite(homeGroundOverride)
      ? homeGroundOverride
      : elevations[0] ?? 0
  const dxGround =
    dxGroundOverride != null && Number.isFinite(dxGroundOverride)
      ? dxGroundOverride
      : elevations[n - 1] ?? 0
  const homeAsl = homeGround + homeAglM
  const dxAsl = dxGround + dxAglM

  const R = EARTH_RADIUS_KM * 1000 // meters

  const losLine: number[] = []
  const effectiveTerrain: number[] = []

  for (let i = 0; i < n; i++) {
    const f = totalKm > 0 ? distances[i] / totalKm : 0
    // Straight interpolated line between the antenna tops (reference display).
    losLine.push(homeAsl + (dxAsl - homeAsl) * f)
    // Earth-curvature bulge (m) at this sample: d1*d2 / (2R).
    const d1 = distances[i] * 1000
    const d2 = (totalKm - distances[i]) * 1000
    const bulge = (d1 * d2) / (2 * R)
    effectiveTerrain.push(elevations[i] + bulge)
  }

  // HOME take-off angle: largest angle any forward hill subtends above HOME.
  let homeTakeoffDeg = 0
  let homeObstructionIndex = 0
  for (let i = 1; i < n; i++) {
    const horiz = distances[i] * 1000
    if (horiz <= 0) continue
    const angle = (Math.atan2(effectiveTerrain[i] - homeAsl, horiz) * 180) / Math.PI
    if (angle > homeTakeoffDeg) {
      homeTakeoffDeg = angle
      homeObstructionIndex = i
    }
  }

  // DX take-off angle: same scan from the DX end (distance measured from DX).
  let dxTakeoffDeg = 0
  let dxObstructionIndex = n - 1
  for (let i = n - 2; i >= 0; i--) {
    const horiz = (totalKm - distances[i]) * 1000
    if (horiz <= 0) continue
    const angle = (Math.atan2(effectiveTerrain[i] - dxAsl, horiz) * 180) / Math.PI
    if (angle > dxTakeoffDeg) {
      dxTakeoffDeg = angle
      dxObstructionIndex = i
    }
  }

  return {
    homeAsl,
    dxAsl,
    homeGround,
    dxGround,
    losLine,
    effectiveTerrain,
    homeTakeoffDeg: Math.max(0, homeTakeoffDeg),
    dxTakeoffDeg: Math.max(0, dxTakeoffDeg),
    homeObstructionKm: distances[homeObstructionIndex] ?? 0,
    dxObstructionKm: totalKm - (distances[dxObstructionIndex] ?? 0),
    homeObstructionIndex,
    dxObstructionIndex,
  }
}
