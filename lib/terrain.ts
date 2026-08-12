// Radio horizon / take-off angle analysis over a great-circle terrain profile.
//
// NOTE ON PHYSICS: aircraft scatter does NOT rely on a direct line of sight
// between the two ground stations. Both stations beam UP toward a common
// reflection point in the sky (an aircraft's skin at altitude), so a hill on
// the ground between them does not "block" the contact. What matters instead
// is the LOCAL horizon at each station: the minimum antenna take-off (elevation)
// angle needed to clear nearby hills and get the beam into the sky.

import type { LatLon } from "./maidenhead"

// 4/3 Effective Earth Radius model (standard atmospheric refraction). Using the
// effective radius makes hills beyond the true horizon "curve away", so radio
// line-of-sight reaches slightly farther than optical.
export const EFFECTIVE_EARTH_RADIUS_KM = 8504
export const EFFECTIVE_EARTH_RADIUS_M = EFFECTIVE_EARTH_RADIUS_KM * 1000

/**
 * Curvature drop (meters) of a point at ground distance `dKm` from a station,
 * relative to the station's local horizontal tangent plane:  drop = d² / (2·R).
 * This is what makes distant terrain and aircraft appear lower than their true
 * height when computing true radio line-of-sight.
 */
export function curvatureDropMeters(dKm: number): number {
  const d = dKm * 1000
  return (d * d) / (2 * EFFECTIVE_EARTH_RADIUS_M)
}

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
  /** terrain height minus 4/3-earth curvature drop (m) at each sample — display */
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

  const losLine: number[] = []
  const effectiveTerrain: number[] = []

  for (let i = 0; i < n; i++) {
    const f = totalKm > 0 ? distances[i] / totalKm : 0
    // Straight interpolated line between the antenna tops (reference display).
    losLine.push(homeAsl + (dxAsl - homeAsl) * f)
    // Displayed terrain uses the curvature drop from the NEAREST station, so
    // each station's local hills stay at true height while the mid-path terrain
    // sinks below both tangents — the radio horizon "curving away".
    const dNearKm = Math.min(distances[i], totalKm - distances[i])
    effectiveTerrain.push(elevations[i] - curvatureDropMeters(dNearKm))
  }

  // HOME take-off angle: largest elevation angle any forward hill subtends above
  // the HOME antenna, AFTER dropping each hill for earth curvature (drop grows
  // with distance from HOME, so faraway terrain rarely limits the horizon).
  let homeTakeoffDeg = 0
  let homeObstructionIndex = 0
  for (let i = 1; i < n; i++) {
    const horiz = distances[i] * 1000
    if (horiz <= 0) continue
    const apparent = elevations[i] - curvatureDropMeters(distances[i])
    const angle = (Math.atan2(apparent - homeAsl, horiz) * 180) / Math.PI
    if (angle > homeTakeoffDeg) {
      homeTakeoffDeg = angle
      homeObstructionIndex = i
    }
  }

  // DX take-off angle: same scan from the DX end (curvature drop measured from DX).
  let dxTakeoffDeg = 0
  let dxObstructionIndex = n - 1
  for (let i = n - 2; i >= 0; i--) {
    const distFromDxKm = totalKm - distances[i]
    const horiz = distFromDxKm * 1000
    if (horiz <= 0) continue
    const apparent = elevations[i] - curvatureDropMeters(distFromDxKm)
    const angle = (Math.atan2(apparent - dxAsl, horiz) * 180) / Math.PI
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
