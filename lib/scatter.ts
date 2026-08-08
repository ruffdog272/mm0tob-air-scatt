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
  /** signed cross-track distance to the signal path (km) */
  crossTrackKm: number
  /** bearing from home station to aircraft (deg) — antenna azimuth */
  bearingFromHome: number
  /** distance from home station (km) */
  rangeFromHomeKm: number
  /** elevation / take-off angle from home station to aircraft (deg) */
  elevationDeg: number
  /** true when the aircraft is closing toward the signal path */
  approaching: boolean
  probability: Probability
  /** Doppler shift in Hz keyed by band */
  doppler: Record<string, number>
  /** seconds until the aircraft crosses the signal path, or null if diverging */
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

function classify(altFt: number, absCross: number): Probability {
  if (absCross > 15) return "unlikely"
  if (altFt >= FL_GREEN_FT && absCross <= 5) return "high"
  return "marginal"
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

  const ct = crossTrackKm(pos, home, dx)
  const absCt = Math.abs(ct)

  // Velocity vector in local ENU (km/s) centered on the aircraft.
  const speedKmS = gs * KNOTS_TO_KM_S
  const vEast = speedKmS * Math.sin((track * Math.PI) / 180)
  const vNorth = speedKmS * Math.cos((track * Math.PI) / 180)

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

  // Numeric estimate of path-crossing time via cross-track rate.
  // `approaching` is true when the absolute cross-track distance is shrinking.
  let etaSeconds: number | null = null
  let approaching = false
  if (speedKmS > 0) {
    const dt = 1 // second
    const next = offset(pos, vEast * dt, vNorth * dt)
    const ctNext = crossTrackKm(next, home, dx)
    approaching = Math.abs(ctNext) < Math.abs(ct)
    const rate = (ctNext - ct) / dt // km/s
    if (Math.abs(rate) > 1e-6) {
      const t = -ct / rate
      if (t > 0 && t < 3600) etaSeconds = t
    }
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
    crossTrackKm: ct,
    bearingFromHome: bearing(home, pos),
    rangeFromHomeKm,
    elevationDeg: elevationAngleDeg(rangeFromHomeKm, (altFt * FT_TO_M) / 1000),
    approaching,
    probability: classify(altFt, absCt),
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
    // Only keep aircraft actively closing the distance to the signal path.
    .filter((a) => a.approaching)
    .sort((x, y) => {
      const order = { high: 0, marginal: 1, unlikely: 2 }
      if (order[x.probability] !== order[y.probability])
        return order[x.probability] - order[y.probability]
      return Math.abs(x.crossTrackKm) - Math.abs(y.crossTrackKm)
    })
}
