import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

// Proxy to the free public adsb.fi open-data point endpoint to avoid CORS and
// keep the browser polling our own origin. (airplanes.live's public v2 endpoint
// now returns 403 to datacenter IPs; adsb.fi serves the same field schema.)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const lat = Number.parseFloat(searchParams.get("lat") ?? "")
  const lon = Number.parseFloat(searchParams.get("lon") ?? "")
  // radius in nautical miles, capped at the API max of 250
  const radius = Math.min(250, Number.parseInt(searchParams.get("radius") ?? "250", 10))

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 })
  }

  const url = `https://opendata.adsb.fi/api/v2/lat/${lat.toFixed(4)}/lon/${lon.toFixed(4)}/dist/${radius}`

  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    })
    if (!res.ok) {
      return NextResponse.json(
        { error: `Upstream error ${res.status}`, ac: [] },
        { status: 502 },
      )
    }
    const data = await res.json()
    // adsb.fi returns the array under `aircraft`; normalize to `ac` so the
    // client keeps its existing shape.
    const ac = data.aircraft ?? data.ac ?? []
    return NextResponse.json(
      { ac, now: data.now ?? Date.now() },
      { headers: { "Cache-Control": "no-store" } },
    )
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Fetch failed", ac: [] },
      { status: 502 },
    )
  }
}
