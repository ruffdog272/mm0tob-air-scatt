// Radio line-of-sight / terrain clearance analysis over a great-circle path.

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
  /** straight line-of-sight height (m ASL) at each sample */
  losLine: number[]
  /** terrain height plus Earth-curvature bulge (m ASL) at each sample */
  effectiveTerrain: number[]
  /** LOS height minus effective terrain at each sample (m); <0 = blocked */
  clearance: number[]
  /** minimum clearance across intermediate samples (m) */
  worstClearance: number
  /** index of the worst (lowest-clearance) sample */
  worstIndex: number
  obstructed: boolean
  /** take-off angle (deg above horizon) HOME needs to clear the worst peak */
  requiredTakeoffDeg: number
}

/**
 * Compute radio clearance for a terrain profile given antenna heights above
 * ground level (meters). Uses the true geometric Earth radius so the bulge
 * reflects the optical / "true horizon" obstruction the user asked for.
 */
export function analyzeClearance(
  profile: TerrainProfile,
  homeAglM: number,
  dxAglM: number,
): ClearanceResult {
  const { distances, elevations, totalKm } = profile
  const n = elevations.length

  const homeGround = elevations[0] ?? 0
  const dxGround = elevations[n - 1] ?? 0
  const homeAsl = homeGround + homeAglM
  const dxAsl = dxGround + dxAglM

  const R = EARTH_RADIUS_KM * 1000 // meters

  const losLine: number[] = []
  const effectiveTerrain: number[] = []
  const clearance: number[] = []

  for (let i = 0; i < n; i++) {
    const f = totalKm > 0 ? distances[i] / totalKm : 0
    // Straight interpolated line between the two antenna tops.
    const los = homeAsl + (dxAsl - homeAsl) * f
    // Earth-curvature bulge (m) at this point: d1*d2 / (2R).
    const d1 = distances[i] * 1000
    const d2 = (totalKm - distances[i]) * 1000
    const bulge = (d1 * d2) / (2 * R)
    const eff = elevations[i] + bulge

    losLine.push(los)
    effectiveTerrain.push(eff)
    clearance.push(los - eff)
  }

  // Evaluate only intermediate samples for obstruction (skip the endpoints).
  let worstClearance = Number.POSITIVE_INFINITY
  let worstIndex = 0
  for (let i = 1; i < n - 1; i++) {
    if (clearance[i] < worstClearance) {
      worstClearance = clearance[i]
      worstIndex = i
    }
  }
  if (!Number.isFinite(worstClearance)) worstClearance = 0

  const obstructed = worstClearance < 0

  // Take-off angle needed from HOME antenna to graze the worst peak.
  let requiredTakeoffDeg = 0
  if (obstructed) {
    const peakEff = effectiveTerrain[worstIndex]
    const horiz = distances[worstIndex] * 1000
    if (horiz > 0) {
      requiredTakeoffDeg = (Math.atan2(peakEff - homeAsl, horiz) * 180) / Math.PI
    }
  }

  return {
    homeAsl,
    dxAsl,
    homeGround,
    dxGround,
    losLine,
    effectiveTerrain,
    clearance,
    worstClearance,
    worstIndex,
    obstructed,
    requiredTakeoffDeg: Math.max(0, requiredTakeoffDeg),
  }
}
