// Aircraft-scatter analysis: probability, Doppler, bearing, ETA.

import type { LatLon } from "./maidenhead"
import {
  EARTH_RADIUS_KM,
  bearing,
  crossTrackKm,
  distanceKm,
  elevationAngleDeg,
  localENU,
} from "./geo"

export const FT_TO_M = 0.3048

export const FL_FLOOR_FT = 20000 // FL200 hard floor
export const FL_GREEN_FT = 25000 // FL250

export const SPEED_OF_LIGHT_KM_S = 299792.458
export const KNOTS_TO_KM_S = 1.852 / 3600

/** Predictive look-ahead window for trajectory intersection (seconds). */
export const PREDICT_HORIZON_S = 15 * 60
/**
 * Trailing window kept AFTER an aircraft passes its closest approach / path
 * intercept (seconds). Planes stay visible and tracked for this long once they
 * have crossed, instead of vanishing the instant they pass.
 */
export const PREDICT_TRAILING_S = 5 * 60
/** Marginal (yellow) corridor half-width around the path segment (km). */
export const MARGINAL_CORRIDOR_KM = 25
/**
 * Relevance cutoff: aircraft whose projected trajectory never comes within this
 * distance of the path (over the look-ahead horizon) are discarded as clutter.
 * ~50 statute miles — a plane that never gets this close cannot scatter usefully.
 */
export const MAX_RELEVANT_DIST_KM = 80

export type Probability = "high" | "marginal" | "unlikely"

/** Ham bands we compute Doppler corrections for. */
export const BANDS = [
  { key: "2m", label: "2 m", freqHz: 144_000_000 },
  { key: "70cm", label: "70 cm", freqHz: 432_000_000 },
  { key: "3cm", label: "3 cm", freqHz: 10_368_000_000 },
] as const

export interface RawAircraft {
  hex: string
  flight?: string
  lat: number
  lon: number
  alt_baro?: number | "ground"
  alt_geom?: number
  gs?: number // ground speed, knots
  track?: number // deg
}

export interface AnalyzedAircraft {
  hex: string
  callsign: string
  pos: LatLon
  altFt: number
  /** altitude in meters above sea level */
  altM: number
  groundSpeedKt: number
  track: number
  /** absolute flight heading from the movement vector, 0-360 (0=N, 90=E) */
  headingDeg: number
  /** signed cross-track distance to the infinite great-circle line (km) */
  crossTrackKm: number
  /** current perpendicular distance to the BOUNDED path segment (km) */
  distToSegmentKm: number
  /** distance projected ALONG the path from HOME (km), clamped to [0, segLen] */
  alongTrackKm: number
  /** closest the projected trajectory comes to the segment within horizon (km) */
  minTrajectoryDistKm: number
  /** true when the forward trajectory will cross the segment within the horizon */
  willIntersect: boolean
  /** predicted lat/lon where the trajectory crosses the path segment, if any */
  crossingPoint: LatLon | null
  /** bearing from home station to aircraft (deg) — antenna azimuth */
  bearingFromHome: number
  /** bearing from DX station to aircraft (deg) — DX antenna azimuth */
  bearingFromDx: number
  /** distance from home station (km) */
  rangeFromHomeKm: number
  /** elevation / take-off angle from home station to aircraft (deg) */
  elevationDeg: number
  /** true when the aircraft is closing on the bounded path segment */
  approaching: boolean
  probability: Probability
  /** Doppler shift in Hz keyed by band */
  doppler: Record<string, number>
  /** seconds until the aircraft crosses the path segment, or null if it won't */
  etaSeconds: number | null
}

function offset(p: LatLon, eastKm: number, northKm: number): LatLon {
  const lat = p.lat + (northKm / EARTH_RADIUS_KM) * (180 / Math.PI)
  const lon =
    p.lon +
    (eastKm / (EARTH_RADIUS_KM * Math.cos((p.lat * Math.PI) / 180))) *
      (180 / Math.PI)
  return { lat, lon }
}

/**
 * Trajectory-aware classification.
 * - HIGH  (green):  projected trajectory WILL cross the bounded path segment
 *                   within the horizon AND altitude >= FL250.
 * - MARG  (yellow): trajectory passes within the marginal corridor of the
 *                   segment, OR altitude is FL200–FL250.
 * - LOW   (red):    trajectory misses the station-to-station window entirely.
 */
function classify(
  altFt: number,
  willIntersect: boolean,
  minTrajectoryDistKm: number,
): Probability {
  if (willIntersect && altFt >= FL_GREEN_FT) return "high"
  if (minTrajectoryDistKm <= MARGINAL_CORRIDOR_KM) return "marginal"
  if (altFt >= FL_FLOOR_FT && altFt < FL_GREEN_FT) return "marginal"
  return "unlikely"
}

/**
 * Analyze a single raw aircraft against the home/DX signal path.
 */
export function analyzeAircraft(
  raw: RawAircraft,
  home: LatLon,
  dx: LatLon,
): AnalyzedAircraft {
  const pos: LatLon = { lat: raw.lat, lon: raw.lon }
  const altFt = typeof raw.alt_baro === "number" ? raw.alt_baro : raw.alt_geom ?? 0
  const gs = raw.gs ?? 0
  const track = raw.track ?? 0

  // Signed cross-track vs the INFINITE great-circle line (kept for the Doppler
  // geometry sign and as a display reference).
  const ct = crossTrackKm(pos, home, dx)

  // Velocity vector in local ENU (km/s) centered on the aircraft.
  const speedKmS = gs * KNOTS_TO_KM_S
  const vEast = speedKmS * Math.sin((track * Math.PI) / 180)
  const vNorth = speedKmS * Math.cos((track * Math.PI) / 180)

  // Absolute flight heading derived from the movement vector relative to true
  // north (0=N, 90=E, 180=S, 270=W). Falls back to reported track when the
  // aircraft is effectively stationary and the vector is undefined.
  const headingDeg =
    speedKmS > 1e-6
      ? ((Math.atan2(vEast, vNorth) * 180) / Math.PI + 360) % 360
      : ((track % 360) + 360) % 360

  // --- Bounded segment + predictive trajectory model (planar ENU @ home) ---
  // The radio path is a STRICT SEGMENT between HOME and DX, never extended to
  // infinity. All prediction happens in a local East/North plane centered on
  // the home station, which is accurate over these ranges.
  const dEnu = localENU(home, dx)
  const pEnu = localENU(home, pos)
  const segLen = Math.hypot(dEnu.east, dEnu.north) || 1
  const dHatE = dEnu.east / segLen
  const dHatN = dEnu.north / segLen
  const nHatE = -dHatN // left-hand normal to the segment
  const nHatN = dHatE

  // Clamped point-to-SEGMENT distance (endpoints bound the window).
  const segDist = (e: number, n: number): number => {
    let s = e * dHatE + n * dHatN
    if (s < 0) s = 0
    else if (s > segLen) s = segLen
    return Math.hypot(e - s * dHatE, n - s * dHatN)
  }

  const distToSegmentKm = segDist(pEnu.east, pEnu.north)

  // Projection of the aircraft onto the path, measured from HOME, clamped to
  // the segment. Used to place the aircraft on the terrain-profile X-axis.
  const alongTrackKm = Math.min(
    segLen,
    Math.max(0, pEnu.east * dHatE + pEnu.north * dHatN),
  )

  // Project the trajectory forward and solve for the moment it crosses the
  // segment's line; only counts if the crossing lands BETWEEN the stations and
  // inside the look-ahead horizon.
  const crossSigned = pEnu.east * nHatE + pEnu.north * nHatN
  const vPerp = vEast * nHatE + vNorth * nHatN
  let etaSeconds: number | null = null
  let willIntersect = false
  let crossingPoint: LatLon | null = null
  // Track a recent crossing separately so a plane that JUST passed the path
  // still counts as intersecting (and stays visible) for the trailing window.
  let recentlyCrossed = false
  if (Math.abs(vPerp) > 1e-9) {
    const tCross = -crossSigned / vPerp
    if (tCross >= -PREDICT_TRAILING_S && tCross <= PREDICT_HORIZON_S) {
      const cxE = pEnu.east + vEast * tCross
      const cxN = pEnu.north + vNorth * tCross
      const sCross = cxE * dHatE + cxN * dHatN
      if (sCross >= 0 && sCross <= segLen) {
        willIntersect = true
        // Only report a positive ETA for a FUTURE crossing; a past crossing
        // (within the trailing window) keeps the plane on-screen but has no ETA.
        etaSeconds = tCross >= 0 ? tCross : null
        recentlyCrossed = tCross < 0
        crossingPoint = offset(home, cxE, cxN)
      }
    }
  }

  // Closest the projected path comes to the segment across the FULL window:
  // from the trailing edge (5 min in the past) through the 15 min look-ahead.
  // Spanning the past keeps a plane relevant for 5 min after closest approach.
  let minTrajectoryDistKm = distToSegmentKm
  const STEP_S = 15
  for (let t = -PREDICT_TRAILING_S; t <= PREDICT_HORIZON_S; t += STEP_S) {
    if (t === 0) continue
    const d = segDist(pEnu.east + vEast * t, pEnu.north + vNorth * t)
    if (d < minTrajectoryDistKm) minTrajectoryDistKm = d
  }

  // Approaching = distance to the bounded segment is currently decreasing, OR
  // the plane crossed the path within the trailing window (so it lingers on
  // screen for 5 min after passing rather than dropping out immediately).
  const approaching =
    segDist(pEnu.east + vEast, pEnu.north + vNorth) < distToSegmentKm ||
    recentlyCrossed

  // Unit vectors from aircraft toward each station.
  const homeENU = localENU(pos, home)
  const dxENU = localENU(pos, dx)
  const homeMag = Math.hypot(homeENU.east, homeENU.north) || 1
  const dxMag = Math.hypot(dxENU.east, dxENU.north) || 1
  const u1 = { e: homeENU.east / homeMag, n: homeENU.north / homeMag }
  const u2 = { e: dxENU.east / dxMag, n: dxENU.north / dxMag }

  // dR/dt for the two-hop reflection path (km/s); Doppler = -(f/c)*dR/dt.
  const dRdt = -(vEast * u1.e + vNorth * u1.n) - (vEast * u2.e + vNorth * u2.n)
  const doppler: Record<string, number> = {}
  for (const band of BANDS) {
    doppler[band.key] = -(band.freqHz / SPEED_OF_LIGHT_KM_S) * dRdt
  }

  const rangeFromHomeKm = distanceKm(home, pos)

  return {
    hex: raw.hex,
    callsign: (raw.flight || raw.hex).trim(),
    pos,
    altFt,
    altM: altFt * FT_TO_M,
    groundSpeedKt: gs,
    track,
    headingDeg,
    crossTrackKm: ct,
    distToSegmentKm,
    alongTrackKm,
    minTrajectoryDistKm,
    willIntersect,
    crossingPoint,
    bearingFromHome: bearing(home, pos),
    bearingFromDx: bearing(dx, pos),
    rangeFromHomeKm,
    elevationDeg: elevationAngleDeg(rangeFromHomeKm, (altFt * FT_TO_M) / 1000),
    approaching,
    probability: classify(altFt, willIntersect, minTrajectoryDistKm),
    doppler,
    etaSeconds,
  }
}

/** Filter ground/ghost data and anything below FL200, then analyze + sort. */
export function analyzeFeed(
  rawList: RawAircraft[],
  home: LatLon,
  dx: LatLon,
): AnalyzedAircraft[] {
  return rawList
    .filter((a) => {
      if (a.alt_baro === "ground") return false
      if (typeof a.lat !== "number" || typeof a.lon !== "number") return false
      const alt = typeof a.alt_baro === "number" ? a.alt_baro : a.alt_geom ?? 0
      return alt >= FL_FLOOR_FT
    })
    .map((a) => analyzeAircraft(a, home, dx))
    // Keep only aircraft that (a) are actively closing on the bounded path
    // segment AND (b) whose projected trajectory actually comes within the
    // relevance radius. This drops the far-field clutter of planes that will
    // never get near enough to the path to scatter.
    .filter((a) => a.approaching && a.minTrajectoryDistKm <= MAX_RELEVANT_DIST_KM)
    .sort((x, y) => {
      const order = { high: 0, marginal: 1, unlikely: 2 }
      if (order[x.probability] !== order[y.probability])
        return order[x.probability] - order[y.probability]
      // Within a tier, aircraft that will intersect soonest rank first.
      if (x.willIntersect && y.willIntersect)
        return (x.etaSeconds ?? Infinity) - (y.etaSeconds ?? Infinity)
      return x.distToSegmentKm - y.distToSegmentKm
    })
}
