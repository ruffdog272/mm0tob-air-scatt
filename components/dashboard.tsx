"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import dynamic from "next/dynamic"
import useSWR from "swr"
import { Plane, Radio, Route } from "lucide-react"

import { gridToLatLon, isValidLocator } from "@/lib/maidenhead"
import { bearing, distanceKm, KM_PER_NM } from "@/lib/geo"
import { analyzeFeed, type RawAircraft } from "@/lib/scatter"
import { StationControls } from "@/components/station-controls"
import { AircraftFeed } from "@/components/aircraft-feed"
import { SpaceWeather } from "@/components/space-weather"

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
  const [now, setNow] = useState(() => Date.now())

  // Load saved operator callsign from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("operatorCallsign")
    if (saved) setCallsign(saved)
  }, [])

  // Persist callsign whenever it changes
  useEffect(() => {
    localStorage.setItem("operatorCallsign", callsign)
  }, [callsign])

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

  const pathDistance = myCoords && dxCoords ? distanceKm(myCoords, dxCoords) : 0
  const pathBearing = myCoords && dxCoords ? bearing(myCoords, dxCoords) : 0
  const highCount = aircraft.filter((a) => a.probability === "high").length

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
            label="Path"
            value={`${pathDistance.toFixed(0)} km · ${pathBearing.toFixed(0)}°`}
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
        <StationControls
          callsign={callsign}
          myGrid={myGrid}
          dxGrid={dxGrid}
          myCoords={myCoords}
          dxCoords={dxCoords}
          myValid={myValid}
          dxValid={dxValid}
          onCallsignChange={setCallsign}
          onMyChange={setMyGrid}
          onDxChange={setDxGrid}
        />
      </div>

      {/* Main grid */}
      <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-4">
          <div className="h-96 overflow-hidden rounded-lg border border-border">
            {bothValid && myCoords && dxCoords ? (
              <ScatterMap home={myCoords} dx={dxCoords} aircraft={aircraft} />
            ) : (
              <div className="flex h-full items-center justify-center bg-secondary/30 text-sm text-muted-foreground">
                Enter two valid 6-character grid locators to begin.
              </div>
            )}
          </div>

          <AircraftFeed
            aircraft={aircraft}
            band={band}
            onBandChange={setBand}
            dataTimestamp={fetchedAt.current}
            now={now}
            error={Boolean(error)}
          />
        </div>

        {/* Sidebar */}
        <aside className="flex flex-col gap-4">
          <SpaceWeather />

          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold tracking-tight">Probability Key</h2>
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
                  <span className="text-foreground">Marginal</span> — passes within 10 km of the segment, or 20–25,000 ft
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
              HOME↔DX segment. Tap a row for crossing point, dual-station azimuth,
              and Doppler.
            </p>
          </section>
        </aside>
      </div>

      <footer className="pb-2 text-center font-mono text-[10px] text-muted-foreground/60">
        ADS-B via airplanes.live · indices via NOAA SWPC · for experimental use
      </footer>
    </div>
  )
}
