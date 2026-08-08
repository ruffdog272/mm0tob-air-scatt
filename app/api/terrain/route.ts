import { NextResponse } from "next/server"

import { distanceKm, greatCirclePoints } from "@/lib/geo"

export const dynamic = "force-dynamic"

const SAMPLES = 20

/**
 * Terrain elevation profile between two stations.
 *
 * Breaks the great-circle segment into 20 equidistant coordinates and fetches
 * the ground elevation for all of them in a single Open-Meteo request:
 *   https://api.open-meteo.com/v1/elevation?latitude=lat1,lat2,...&longitude=lon1,lon2,...
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const mlat = Number.parseFloat(searchParams.get("mlat") ?? "")
  const mlon = Number.parseFloat(searchParams.get("mlon") ?? "")
  const dlat = Number.parseFloat(searchParams.get("dlat") ?? "")
  const dlon = Number.parseFloat(searchParams.get("dlon") ?? "")

  if ([mlat, mlon, dlat, dlon].some((v) => !Number.isFinite(v))) {
    return NextResponse.json({ error: "invalid coordinates" }, { status: 400 })
  }

  const home = { lat: mlat, lon: mlon }
  const dx = { lat: dlat, lon: dlon }

  // 20 equidistant points along the great circle (greatCirclePoints returns
  // n+1 tuples, so request n = SAMPLES - 1).
  const tuples = greatCirclePoints(home, dx, SAMPLES - 1)
  const points = tuples.map(([lat, lon]) => ({ lat, lon }))

  const total = distanceKm(home, dx)
  const distances = points.map((_, i) => (total * i) / (points.length - 1))

  const lat = points.map((p) => p.lat.toFixed(5)).join(",")
  const lon = points.map((p) => p.lon.toFixed(5)).join(",")
  const url = `https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lon}`

  try {
    const res = await fetch(url, { next: { revalidate: 3600 } })
    if (!res.ok) throw new Error(`open-meteo ${res.status}`)
    const json = (await res.json()) as { elevation?: number[] }
    const elevations = Array.isArray(json.elevation) ? json.elevation : []
    if (elevations.length !== points.length) {
      throw new Error("elevation length mismatch")
    }
    return NextResponse.json({
      distances,
      elevations,
      points,
      totalKm: total,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "terrain fetch failed" },
      { status: 502 },
    )
  }
}
