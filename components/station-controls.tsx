"use client"

import { useEffect, useRef, useState } from "react"
import { ChevronDown, LocateFixed, Star, Trash2 } from "lucide-react"

import type { LatLon } from "@/lib/maidenhead"
import { type AltUnit, fromDisplayAlt, toDisplayAlt } from "@/lib/units"

/** A saved DX station (beacon / regular sked) for quick recall. */
export interface DxFavorite {
  callsign: string
  grid: string
}

/** Pre-loaded test beacons used the first time the app runs. */
const DEFAULT_DX_FAVORITES: DxFavorite[] = [
  { callsign: "GB3VHF", grid: "JO01EH" },
  { callsign: "GB3NGI", grid: "IO65VB" },
]

/**
 * DX Favorites: a localStorage-backed list of saved DX callsign/grid pairs with
 * a "Save" button and a "Quick Select" dropdown (each entry deletable). On the
 * very first load with no saved data it seeds the two default test beacons.
 */
function DxFavorites({
  dxCallsign,
  dxGrid,
  onDxCallsignChange,
  onDxChange,
}: {
  dxCallsign: string
  dxGrid: string
  onDxCallsignChange: (v: string) => void
  onDxChange: (v: string) => void
}) {
  const [favorites, setFavorites] = useState<DxFavorite[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Load saved favorites, or seed the default beacons on first run.
  useEffect(() => {
    const raw = localStorage.getItem("dxFavorites")
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as unknown
        if (Array.isArray(parsed) && parsed.length > 0) {
          setFavorites(parsed as DxFavorite[])
          return
        }
      } catch {
        /* fall through to seeding defaults */
      }
    }
    setFavorites(DEFAULT_DX_FAVORITES)
    localStorage.setItem("dxFavorites", JSON.stringify(DEFAULT_DX_FAVORITES))
  }, [])

  // Close the dropdown when clicking outside of it.
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [])

  const persist = (next: DxFavorite[]) => {
    setFavorites(next)
    localStorage.setItem("dxFavorites", JSON.stringify(next))
  }

  const saveCurrent = () => {
    const callsign = dxCallsign.trim().toUpperCase()
    const grid = dxGrid.trim().toUpperCase()
    if (!grid) return
    if (favorites.some((f) => f.callsign === callsign && f.grid === grid)) return
    persist([...favorites, { callsign, grid }])
  }

  const removeAt = (index: number) =>
    persist(favorites.filter((_, i) => i !== index))

  const selectFavorite = (f: DxFavorite) => {
    onDxCallsignChange(f.callsign)
    onDxChange(f.grid)
    setOpen(false)
  }

  return (
    <div className="flex items-center gap-1.5" ref={ref}>
      <div className="relative flex-1">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="listbox"
          aria-expanded={open}
          className="flex w-full items-center justify-between gap-2 rounded-md border border-input bg-secondary/60 px-2.5 py-1.5 text-left text-xs text-foreground outline-none transition hover:bg-secondary focus:border-ring focus:ring-2 focus:ring-ring/40"
        >
          <span className="truncate text-muted-foreground">Quick Select DX</span>
          <ChevronDown
            className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition ${
              open ? "rotate-180" : ""
            }`}
          />
        </button>
        {open && (
          <ul
            role="listbox"
            className="absolute left-0 top-[calc(100%+4px)] z-50 max-h-56 w-full overflow-y-auto rounded-md border border-border bg-card p-1 shadow-xl"
          >
            {favorites.length === 0 && (
              <li className="px-2 py-2 text-center font-mono text-[11px] text-muted-foreground">
                No saved DX
              </li>
            )}
            {favorites.map((f, i) => (
              <li key={`${f.callsign}:${f.grid}:${i}`} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => selectFavorite(f)}
                  className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded px-2 py-1.5 text-left transition hover:bg-secondary"
                >
                  <span className="truncate font-mono text-xs font-semibold text-foreground">
                    {f.callsign || "—"}
                  </span>
                  <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                    {f.grid}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => removeAt(i)}
                  aria-label={`Delete ${f.callsign || f.grid}`}
                  title="Delete"
                  className="shrink-0 rounded p-1 text-muted-foreground transition hover:bg-destructive/15 hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <button
        type="button"
        onClick={saveCurrent}
        title="Save current DX callsign & grid"
        className="flex shrink-0 items-center gap-1 rounded-md border border-input bg-secondary/60 px-2.5 py-1.5 text-xs font-medium text-foreground transition hover:bg-secondary focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/40"
      >
        <Star className="h-3.5 w-3.5 text-chart-5" />
        Save
      </button>
    </div>
  )
}

function GridField({
  label,
  accent,
  value,
  coords,
  valid,
  onChange,
  antennaLabel,
  antennaHeight,
  onAntennaChange,
  groundElev,
  fetchedGround,
  overridden,
  onGroundChange,
  antennaAsl,
  unit,
  stationCallLabel,
  stationCall,
  onStationCallChange,
  onUseLocation,
  locating,
}: {
  label: string
  accent: string
  value: string
  coords: LatLon | null
  valid: boolean
  onChange: (v: string) => void
  antennaLabel: string
  antennaHeight: number
  onAntennaChange: (v: number) => void
  groundElev: number | null
  fetchedGround: number | null
  overridden: boolean
  onGroundChange: (v: number | null) => void
  antennaAsl: number | null
  unit: AltUnit
  stationCallLabel?: string
  stationCall?: string
  onStationCallChange?: (v: string) => void
  onUseLocation?: () => void
  locating?: boolean
}) {
  const groundDisplay =
    groundElev != null ? String(Math.round(toDisplayAlt(groundElev, unit))) : ""
  const antennaDisplay = Number.isFinite(antennaHeight)
    ? Math.round(toDisplayAlt(antennaHeight, unit))
    : 0

  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        <span className="h-2 w-2 rounded-full" style={{ background: accent }} />
        {label}
      </label>

      {/* Optional station callsign (used for the DX station) */}
      {onStationCallChange && (
        <input
          value={stationCall ?? ""}
          onChange={(e) => onStationCallChange(e.target.value.toUpperCase())}
          placeholder={stationCallLabel ?? "CALLSIGN"}
          maxLength={12}
          spellCheck={false}
          aria-label={stationCallLabel}
          className="w-full rounded-md border border-input bg-secondary/60 px-3 py-1.5 font-mono text-sm tracking-widest text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/40"
        />
      )}

      <div className="relative">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          placeholder="FN31pr11"
          maxLength={8}
          spellCheck={false}
          aria-invalid={!valid}
          title="4, 6, or 8 character Maidenhead grid locator (e.g. FN31, FN31pr, or FN31pr11)"
          className="w-full rounded-md border border-input bg-secondary/60 px-3 py-2 pr-11 font-mono text-lg tracking-widest text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/40 aria-[invalid=true]:border-destructive"
        />
        {onUseLocation && (
          <button
            type="button"
            onClick={onUseLocation}
            disabled={locating}
            aria-label="Use my current GPS location"
            title="Use my location"
            className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md border border-border bg-card text-primary transition hover:bg-secondary disabled:opacity-50"
          >
            <LocateFixed className={`h-4 w-4 ${locating ? "animate-pulse" : ""}`} />
          </button>
        )}
      </div>
      <p className="font-mono text-xs text-muted-foreground">
        {valid && coords
          ? `${coords.lat.toFixed(4)}, ${coords.lon.toFixed(4)}`
          : "invalid locator"}
      </p>

      {/* Ground elevation (editable) + antenna height above ground level */}
      <div className="mt-1 flex items-center gap-2">
        <span className="w-14 shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground/80">
          Ground
        </span>
        <div className="relative flex-1">
          <input
            type="number"
            step={1}
            value={groundDisplay}
            placeholder="…"
            onChange={(e) => {
              const raw = e.target.value
              onGroundChange(
                raw === "" ? null : fromDisplayAlt(Number.parseFloat(raw), unit),
              )
            }}
            className="w-full rounded-md border border-input bg-secondary/60 px-2 py-1 pr-10 font-mono text-sm text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/40"
          />
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[10px] text-muted-foreground">
            {unit} ASL
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-14 shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground/80">
          {antennaLabel}
        </span>
        <div className="relative flex-1">
          <input
            type="number"
            min={0}
            step={1}
            value={antennaDisplay}
            onChange={(e) =>
              onAntennaChange(
                fromDisplayAlt(Number.parseFloat(e.target.value) || 0, unit),
              )
            }
            className="w-full rounded-md border border-input bg-secondary/60 px-2 py-1 pr-10 font-mono text-sm text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/40"
          />
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[10px] text-muted-foreground">
            {unit} AGL
          </span>
        </div>
      </div>
      <p className="flex items-center justify-between font-mono text-[10px] text-muted-foreground/80">
        <span>
          {antennaAsl != null
            ? `= ${Math.round(toDisplayAlt(antennaAsl, unit))} ${unit} ASL at antenna`
            : "ground elevation pending"}
        </span>
        {overridden && (
          <button
            type="button"
            onClick={() => onGroundChange(null)}
            className="text-[10px] text-primary underline-offset-2 hover:underline"
          >
            reset
            {fetchedGround != null
              ? ` (${Math.round(toDisplayAlt(fetchedGround, unit))} ${unit})`
              : ""}
          </button>
        )}
      </p>
    </div>
  )
}

export function StationControls({
  callsign,
  dxCallsign,
  myGrid,
  dxGrid,
  myCoords,
  dxCoords,
  myValid,
  dxValid,
  myAntM,
  dxAntM,
  myGround,
  dxGround,
  myFetchedGround,
  dxFetchedGround,
  myGroundOverridden,
  dxGroundOverridden,
  unit,
  locating,
  onCallsignChange,
  onDxCallsignChange,
  onMyChange,
  onDxChange,
  onUseMyLocation,
  onMyAntChange,
  onDxAntChange,
  onMyGroundChange,
  onDxGroundChange,
}: {
  callsign: string
  dxCallsign: string
  myGrid: string
  dxGrid: string
  myCoords: LatLon | null
  dxCoords: LatLon | null
  myValid: boolean
  dxValid: boolean
  myAntM: number
  dxAntM: number
  myGround: number | null
  dxGround: number | null
  myFetchedGround: number | null
  dxFetchedGround: number | null
  myGroundOverridden: boolean
  dxGroundOverridden: boolean
  unit: AltUnit
  locating: boolean
  onCallsignChange: (v: string) => void
  onDxCallsignChange: (v: string) => void
  onMyChange: (v: string) => void
  onDxChange: (v: string) => void
  onUseMyLocation: () => void
  onMyAntChange: (v: number) => void
  onDxAntChange: (v: number) => void
  onMyGroundChange: (v: number | null) => void
  onDxGroundChange: (v: number | null) => void
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div className="flex flex-col gap-1.5">
        <label className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          <span className="h-2 w-2 rounded-full" style={{ background: "var(--chart-2)" }} />
          Operator Callsign
        </label>
        <input
          value={callsign}
          onChange={(e) => onCallsignChange(e.target.value.toUpperCase())}
          placeholder="N0CALL"
          maxLength={12}
          spellCheck={false}
          className="w-full rounded-md border border-input bg-secondary/60 px-3 py-2 font-mono text-lg tracking-widest text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/40"
        />
        <p className="font-mono text-xs text-muted-foreground">
          {callsign ? "saved locally" : "your station ID"}
        </p>
      </div>
      <GridField
        label="My Grid"
        accent="var(--primary)"
        value={myGrid}
        coords={myCoords}
        valid={myValid}
        onChange={onMyChange}
        onUseLocation={onUseMyLocation}
        locating={locating}
        antennaLabel="My Ant"
        antennaHeight={myAntM}
        onAntennaChange={onMyAntChange}
        groundElev={myGround}
        fetchedGround={myFetchedGround}
        overridden={myGroundOverridden}
        onGroundChange={onMyGroundChange}
        antennaAsl={myGround != null ? myGround + myAntM : null}
        unit={unit}
      />
      <div className="flex flex-col gap-1.5">
        <DxFavorites
          dxCallsign={dxCallsign}
          dxGrid={dxGrid}
          onDxCallsignChange={onDxCallsignChange}
          onDxChange={onDxChange}
        />
        <GridField
          label="DX Grid"
          accent="var(--chart-5)"
          value={dxGrid}
          coords={dxCoords}
          valid={dxValid}
          onChange={onDxChange}
          stationCallLabel="DX Callsign"
          stationCall={dxCallsign}
          onStationCallChange={onDxCallsignChange}
          antennaLabel="DX Ant"
          antennaHeight={dxAntM}
          onAntennaChange={onDxAntChange}
          groundElev={dxGround}
          fetchedGround={dxFetchedGround}
          overridden={dxGroundOverridden}
          onGroundChange={onDxGroundChange}
          antennaAsl={dxGround != null ? dxGround + dxAntM : null}
          unit={unit}
        />
      </div>
    </div>
  )
}
