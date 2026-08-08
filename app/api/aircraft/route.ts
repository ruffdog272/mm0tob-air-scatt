import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

// Proxy to the free public airplanes.live point endpoint to avoid CORS and
// keep the browser polling our own origin.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const lat = Number.parseFloat(searchParams.get("lat") ?? "")
  const lon = Number.parseFloat(searchParams.get("lon") ?? "")
  // radius in nautical miles, capped at the API max of 250
  const radius = Math.min(250, Number.parseInt(searchParams.get("radius") ?? "250", 10))

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 })
  }

  const url = `https://api.airplanes.live/v2/point/${lat.toFixed(4)}/${lon.toFixed(4)}/${radius}`

  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "ham-aircraft-scatter/1.0" },
      cache: "no-store",
    })
    if (!res.ok) {
      return NextResponse.json(
        { error: `Upstream error ${res.status}`, ac: [] },
        { status: 502 },
      )
    }
    const data = await res.json()
    return NextResponse.json(
      { ac: data.ac ?? [], now: data.now ?? Date.now() },
      { headers: { "Cache-Control": "no-store" } },
    )
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Fetch failed", ac: [] },
      { status: 502 },
    )
  }
}
