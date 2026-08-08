import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const revalidate = 0

// Pull live solar/geomagnetic indices from NOAA SWPC public JSON feeds.
async function safeJson(url: string) {
  try {
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

export async function GET() {
  const [flux, indices, kpArr] = await Promise.all([
    safeJson("https://services.swpc.noaa.gov/products/summary/10cm-flux.json"),
    safeJson(
      "https://services.swpc.noaa.gov/json/solar-cycle/observed-solar-cycle-indices.json",
    ),
    safeJson("https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json"),
  ])

  let sfi: number | null = null
  if (flux && typeof flux.Flux !== "undefined") sfi = Number.parseFloat(flux.Flux)

  let ssn: number | null = null
  if (Array.isArray(indices) && indices.length) {
    const last = indices[indices.length - 1]
    if (last?.ssn != null) ssn = Number.parseFloat(last.ssn)
    if (sfi == null && last?.["f10.7"] != null) sfi = Number.parseFloat(last["f10.7"])
  }

  let kp: number | null = null
  let kpTime: string | null = null
  if (Array.isArray(kpArr) && kpArr.length) {
    // entries: { time_tag, Kp, a_running, station_count }
    const last = kpArr[kpArr.length - 1]
    const val = Number.parseFloat(last?.Kp)
    if (Number.isFinite(val)) {
      kp = val
      kpTime = last?.time_tag ?? null
    }
  }

  return NextResponse.json(
    {
      sfi,
      ssn,
      kp,
      kpTime,
      updated: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } },
  )
}
