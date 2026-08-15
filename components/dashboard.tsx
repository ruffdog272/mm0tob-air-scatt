"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import dynamic from "next/dynamic"
import useSWR from "swr"
import { Plane, Radio, Route } from "lucide-react"

import { gridToLatLon, isValidLocator, latLonToGrid } from "@/lib/maidenhead"
import { bearing, distanceKm, KM_PER_NM } from "@/lib/geo"
import { type AltUnit, isAltUnit } from "@/lib/units"
import { analyzeFeed, type RawAircraft } from "@/lib/scatter"
import { analyzeClearance, type TerrainProfile } from "@/lib/terrain"
import { StationControls } from "@/components/station-controls"
import { AircraftFeed } from "@/components/aircraft-feed"
import { SpaceWeather } from "@/components/space-weather"
import { TerrainProfileChart } from "@/components/terrain-profile"

const ScatterMap = dynamic(() => import("@/components/scatter-map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-secondary/30 text-sm text-muted-foreground">
      Loading map…
    </div>
  ),
})

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("feed error")
    return r.json()
  })

function StatChip({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5">
      <span className="text-primary">{icon}</span>
      <div className="flex flex-col leading-none">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span className="font-mono text-sm text-foreground">{value}</span>
      </div>
    </div>
  )
}

export function Dashboard() {
  const [myGrid, setMyGrid] = useState("FN31PR")
  const [dxGrid, setDxGrid] = useState("FM19LW")
  const [band, setBand] = useState("2m")
  const [callsign, setCallsign] = useState("")
  const [dxCallsign, setDxCallsign] = useState("")
  const [altUnit, setAltUnit] = useState<AltUnit>("m")
  const [locating, setLocating] = useState(false)
  const [myAntM, setMyAntM] = useState(10)
  const [dxAntM, setDxAntM] = useState(10)
  // Manual ground-elevation overrides (m ASL). null = use fetched grid value.
  const [myGroundOverride, setMyGroundOverride] = useState<number | null>(null)
  const [dxGroundOverride, setDxGroundOverride] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())

  // Load all saved operator settings from localStorage on mount. Runs once
  // before the persistence effects below re-sync the (now hydrated) values.
  useEffect(() => {
    const saved = localStorage.getItem("operatorCallsign")
    if (saved) setCallsign(saved)
    const savedDxCall = localStorage.getItem("dxCallsign")
    if (savedDxCall) setDxCallsign(savedDxCall)
    const savedMyGrid = localStorage.getItem("myGrid")
    if (savedMyGrid) setMyGrid(savedMyGrid)
    const savedDxGrid = localStorage.getItem("dxGrid")
    if (savedDxGrid) setDxGrid(savedDxGrid)
    const savedUnit = localStorage.getItem("altUnit")
    if (isAltUnit(savedUnit)) setAltUnit(savedUnit)
    const my = localStorage.getItem("myAntennaM")
    if (my != null && Number.isFinite(Number.parseFloat(my))) setMyAntM(Number.parseFloat(my))
    const dx = localStorage.getItem("dxAntennaM")
    if (dx != null && Number.isFinite(Number.parseFloat(dx))) setDxAntM(Number.parseFloat(dx))
  }, [])

  // Persist every input field whenever it changes
  useEffect(() => {
    localStorage.setItem("operatorCallsign", callsign)
  }, [callsign])
  useEffect(() => {
    localStorage.setItem("dxCallsign", dxCallsign)
  }, [dxCallsign])
  useEffect(() => {
    localStorage.setItem("myGrid", myGrid)
  }, [myGrid])
  useEffect(() => {
    localStorage.setItem("dxGrid", dxGrid)
  }, [dxGrid])
  useEffect(() => {
    localStorage.setItem("altUnit", altUnit)
  }, [altUnit])
  useEffect(() => {
    localStorage.setItem("myAntennaM", String(myAntM))
  }, [myAntM])
  useEffect(() => {
    localStorage.setItem("dxAntennaM", String(dxAntM))
  }, [dxAntM])

  // GPS auto-lookup: resolve the browser location and fill My Grid.
  const onUseMyLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setMyGrid(latLonToGrid(p.coords.latitude, p.coords.longitude))
        setLocating(false)
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    )
  }

  // Load any saved ground-elevation override for the current grid. Runs on
  // mount and whenever the grid changes, so a new location starts fresh (or
  // restores a previously-saved manual value keyed to that grid).
  useEffect(() => {
    const stored = localStorage.getItem(`groundElev:${myGrid}`)
    setMyGroundOverride(stored != null ? Number.parseFloat(stored) : null)
  }, [myGrid])
  useEffect(() => {
    const stored = localStorage.getItem(`groundElev:${dxGrid}`)
    setDxGroundOverride(stored != null ? Number.parseFloat(stored) : null)
  }, [dxGrid])

  const setMyGround = (v: number | null) => {
    setMyGroundOverride(v)
    if (v == null) localStorage.removeItem(`groundElev:${myGrid}`)
    else localStorage.setItem(`groundElev:${myGrid}`, String(v))
  }
  const setDxGround = (v: number | null) => {
    setDxGroundOverride(v)
    if (v == null) localStorage.removeItem(`groundElev:${dxGrid}`)
    else localStorage.setItem(`groundElev:${dxGrid}`, String(v))
  }

  // 1 Hz tick for ETA countdowns
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const myValid = isValidLocator(myGrid)
  const dxValid = isValidLocator(dxGrid)
  const myCoords = useMemo(() => gridToLatLon(myGrid), [myGrid])
  const dxCoords = useMemo(() => gridToLatLon(dxGrid), [dxGrid])
  const bothValid = Boolean(myCoords && dxCoords)

  const mid = useMemo(() => {
    if (!myCoords || !dxCoords) return null
    return {
      lat: (myCoords.lat + dxCoords.lat) / 2,
      lon: (myCoords.lon + dxCoords.lon) / 2,
    }
  }, [myCoords, dxCoords])

  const key =
    bothValid && mid
      ? `/api/aircraft?lat=${mid.lat.toFixed(3)}&lon=${mid.lon.toFixed(3)}&radius=250`
      : null

  const { data, error } = useSWR<{ ac: RawAircraft[]; now: number }>(key, fetcher, {
    refreshInterval: 10_000,
    revalidateOnFocus: false,
    keepPreviousData: true,
  })

  // Timestamp of the most recent feed reception (for ETA elapsed math)
  const fetchedAt = useRef<number | null>(null)
  useEffect(() => {
    if (data) fetchedAt.current = Date.now()
  }, [data])

  const aircraft = useMemo(() => {
    if (!data?.ac || !myCoords || !dxCoords) return []
    return analyzeFeed(data.ac, myCoords, dxCoords)
  }, [data, myCoords, dxCoords])

  // Terrain elevation profile between the two stations (cached; only refetches
  // when the coordinates change, not on antenna-height edits).
  const terrainKey =
    bothValid && myCoords && dxCoords
      ? `/api/terrain?mlat=${myCoords.lat.toFixed(4)}&mlon=${myCoords.lon.toFixed(
          4,
        )}&dlat=${dxCoords.lat.toFixed(4)}&dlon=${dxCoords.lon.toFixed(4)}`
      : null

  const { data: terrain, error: terrainError } = useSWR<TerrainProfile>(
    terrainKey,
    fetcher,
    { revalidateOnFocus: false, keepPreviousData: false },
  )

  const clearance = useMemo(() => {
    if (!terrain?.elevations?.length) return null
    return analyzeClearance(terrain, myAntM, dxAntM, myGroundOverride, dxGroundOverride)
  }, [terrain, myAntM, dxAntM, myGroundOverride, dxGroundOverride])

  const myFetchedGround = terrain?.elevations?.[0] ?? null
  const dxFetchedGround = terrain?.elevations?.[terrain.elevations.length - 1] ?? null
  // Effective ground = manual override when present, else the fetched value.
  const myGround = myGroundOverride ?? myFetchedGround
  const dxGround = dxGroundOverride ?? dxFetchedGround

  const pathDistance = myCoords && dxCoords ? distanceKm(myCoords, dxCoords) : 0
  // Static great-circle bearing HOME→DX and its reciprocal (DX→HOME). The
  // reciprocal is the true back-bearing computed from DX toward HOME, not a
  // naive +180° (which drifts on long paths due to convergence of meridians).
  const pathBearing = myCoords && dxCoords ? bearing(myCoords, dxCoords) : 0
  const reciprocalBearing =
    myCoords && dxCoords ? bearing(dxCoords, myCoords) : 0
  const highCount = aircraft.filter((a) => a.probability === "high").length

  // Aircraft selection is lifted here so a click on either a feed row OR a map
  // marker opens the exact same detail card (rendered by AircraftFeed).
  const [selectedHex, setSelectedHex] = useState<string | null>(null)

  return (
    <div className="mx-auto flex min-h-screen max-w-[1400px] flex-col gap-4 p-4 lg:p-6">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Radio className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-balance">
              Aircraft Scatter Console
            </h1>
            <p className="text-xs text-muted-foreground">
              VHF/UHF DX via aircraft reflection · live ADS-B
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatChip
            icon={<Route className="h-4 w-4" />}
            label="Path · Bearing / Recip"
            value={`${pathDistance.toFixed(0)} km · ${pathBearing.toFixed(
              0,
            )}° / ${reciprocalBearing.toFixed(0)}°`}
          />
          <StatChip
            icon={<Plane className="h-4 w-4" />}
            label="High prob"
            value={`${highCount} / ${aircraft.length}`}
          />
          <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5">
            <span
              className={`h-2 w-2 rounded-full ${
                bothValid && !error
                  ? "animate-pulse bg-prob-high"
                  : "bg-prob-unlikely"
              }`}
            />
            <span className="font-mono text-xs text-muted-foreground">
              {bothValid ? (error ? "OFFLINE" : "LIVE · 10s") : "STANDBY"}
            </span>
          </div>
        </div>
      </header>

      {/* Grid inputs */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold tracking-tight">Station Setup</h2>
          <div
            role="group"
            aria-label="Altitude units"
            className="flex items-center gap-1 rounded-lg border border-border bg-secondary/60 p-1"
          >
            <span className="px-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
              Altitude
            </span>
            {(["m", "ft"] as const).map((u) => {
              const active = altUnit === u
              return (
                <button
                  key={u}
                  onClick={() => setAltUnit(u)}
                  aria-pressed={active}
                  className={`rounded-md px-2.5 py-1 font-mono text-[11px] font-semibold transition ${
                    active
                      ? "bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/60"
                      : "bg-transparent text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
                >
                  {u === "m" ? "Meters" : "Feet"}
                </button>
              )
            })}
          </div>
        </div>
        <StationControls
          callsign={callsign}
          dxCallsign={dxCallsign}
          myGrid={myGrid}
          dxGrid={dxGrid}
          myCoords={myCoords}
          dxCoords={dxCoords}
          myValid={myValid}
          dxValid={dxValid}
          myAntM={myAntM}
          dxAntM={dxAntM}
          myGround={myGround}
          dxGround={dxGround}
          myFetchedGround={myFetchedGround}
          dxFetchedGround={dxFetchedGround}
          myGroundOverridden={myGroundOverride != null}
          dxGroundOverridden={dxGroundOverride != null}
          unit={altUnit}
          locating={locating}
          onCallsignChange={setCallsign}
          onDxCallsignChange={setDxCallsign}
          onMyChange={setMyGrid}
          onDxChange={setDxGrid}
          onUseMyLocation={onUseMyLocation}
          onMyAntChange={setMyAntM}
          onDxAntChange={setDxAntM}
          onMyGroundChange={setMyGround}
          onDxGroundChange={setDxGround}
        />
      </div>

      {/* Main grid */}
      <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-4">
          <div className="h-96 overflow-hidden rounded-lg border border-border">
            {bothValid && myCoords && dxCoords ? (
              <ScatterMap
                home={myCoords}
                dx={dxCoords}
                aircraft={aircraft}
                dataTimestamp={fetchedAt.current}
                now={now}
                onSelect={setSelectedHex}
              />
            ) : (
              <div className="flex h-full items-center justify-center bg-secondary/30 text-sm text-muted-foreground">
                Enter two valid 6-character grid locators to begin.
              </div>
            )}
          </div>

          {bothValid && (
            <TerrainProfileChart
              profile={terrain ?? null}
              clearance={clearance}
              aircraft={aircraft}
              unit={altUnit}
              loading={!terrain && !terrainError}
              error={Boolean(terrainError)}
            />
          )}

          <AircraftFeed
            aircraft={aircraft}
            band={band}
            unit={altUnit}
            onBandChange={setBand}
            dataTimestamp={fetchedAt.current}
            now={now}
            error={Boolean(error)}
            selectedHex={selectedHex}
            onSelectHex={setSelectedHex}
          />
        </div>

        {/* Sidebar */}
        <aside className="flex flex-col gap-4">
          <SpaceWeather />

          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold tracking-tight">Probability Key</h2>
            {clearance && (
              <div className="mb-3 rounded-md border border-border bg-secondary/40 px-3 py-2 text-[11px] leading-tight">
                <p className="font-semibold text-foreground">Min Take-off Angle</p>
                <p className="mt-1 flex items-center justify-between font-mono text-muted-foreground">
                  <span>
                    <span className="text-primary">HOME</span> clears hill @{" "}
                    {clearance.homeObstructionKm.toFixed(1)} km
                  </span>
                  <span className="text-foreground">
                    {clearance.homeTakeoffDeg.toFixed(1)}°
                  </span>
                </p>
                <p className="mt-0.5 flex items-center justify-between font-mono text-muted-foreground">
                  <span>
                    <span className="text-chart-5">DX</span> clears hill @{" "}
                    {clearance.dxObstructionKm.toFixed(1)} km
                  </span>
                  <span className="text-foreground">
                    {clearance.dxTakeoffDeg.toFixed(1)}°
                  </span>
                </p>
              </div>
            )}
            <ul className="flex flex-col gap-2.5 text-xs">
              <li className="flex items-start gap-2.5">
                <span className="mt-0.5 h-3 w-3 shrink-0 rounded-full bg-prob-high" />
                <span className="text-muted-foreground">
                  <span className="text-foreground">High</span> — trajectory will cross the path segment and 25,000 ft+
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-0.5 h-3 w-3 shrink-0 rounded-full bg-prob-marginal" />
                <span className="text-muted-foreground">
                  <span className="text-foreground">Marginal</span> — passes within 25 km of the segment (incl. parallel flights), or 20–25,000 ft
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-0.5 h-3 w-3 shrink-0 rounded-full bg-prob-unlikely" />
                <span className="text-muted-foreground">
                  <span className="text-foreground">Unlikely</span> — flight path misses the station-to-station window
                </span>
              </li>
            </ul>
            <p className="mt-4 border-t border-border/60 pt-3 font-mono text-[10px] leading-relaxed text-muted-foreground/80">
              Search box: 250 NM ({(250 * KM_PER_NM).toFixed(0)} km) around the path
              midpoint. Trajectories are projected 15 min ahead against the bounded
              HOME↔DX segment, and tracked for 2 min after they pass. Tap a row
              or map marker for crossing point, dual-station azimuth, and Doppler.
            </p>
          </section>
        </aside>
      </div>

      <footer className="pb-2 text-center font-mono text-[10px] text-muted-foreground/60">
        ADS-B via adsb.fi · indices via NOAA SWPC · for experimental use
      </footer>
    </div>
  )
}
