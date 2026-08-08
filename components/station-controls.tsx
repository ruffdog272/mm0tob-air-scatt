"use client"

import type { LatLon } from "@/lib/maidenhead"

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
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        <span className="h-2 w-2 rounded-full" style={{ background: accent }} />
        {label}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        placeholder="FN31pr"
        maxLength={6}
        spellCheck={false}
        aria-invalid={!valid}
        className="w-full rounded-md border border-input bg-secondary/60 px-3 py-2 font-mono text-lg tracking-widest text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/40 aria-[invalid=true]:border-destructive"
      />
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
            value={groundElev != null ? Math.round(groundElev) : ""}
            placeholder="…"
            onChange={(e) => {
              const raw = e.target.value
              onGroundChange(raw === "" ? null : Number.parseFloat(raw))
            }}
            className="w-full rounded-md border border-input bg-secondary/60 px-2 py-1 pr-10 font-mono text-sm text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/40"
          />
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[10px] text-muted-foreground">
            m ASL
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
            max={500}
            step={1}
            value={Number.isFinite(antennaHeight) ? antennaHeight : 0}
            onChange={(e) => onAntennaChange(Number.parseFloat(e.target.value) || 0)}
            className="w-full rounded-md border border-input bg-secondary/60 px-2 py-1 pr-10 font-mono text-sm text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/40"
          />
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[10px] text-muted-foreground">
            m AGL
          </span>
        </div>
      </div>
      <p className="flex items-center justify-between font-mono text-[10px] text-muted-foreground/80">
        <span>
          {antennaAsl != null
            ? `= ${antennaAsl.toFixed(0)} m ASL at antenna`
            : "ground elevation pending"}
        </span>
        {overridden && (
          <button
            type="button"
            onClick={() => onGroundChange(null)}
            className="text-[10px] text-primary underline-offset-2 hover:underline"
          >
            reset{fetchedGround != null ? ` (${Math.round(fetchedGround)} m)` : ""}
          </button>
        )}
      </p>
    </div>
  )
}

export function StationControls({
  callsign,
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
  onCallsignChange,
  onMyChange,
  onDxChange,
  onMyAntChange,
  onDxAntChange,
  onMyGroundChange,
  onDxGroundChange,
}: {
  callsign: string
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
  onCallsignChange: (v: string) => void
  onMyChange: (v: string) => void
  onDxChange: (v: string) => void
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
        antennaLabel="My Ant"
        antennaHeight={myAntM}
        onAntennaChange={onMyAntChange}
        groundElev={myGround}
        fetchedGround={myFetchedGround}
        overridden={myGroundOverridden}
        onGroundChange={onMyGroundChange}
        antennaAsl={myGround != null ? myGround + myAntM : null}
      />
      <GridField
        label="DX Grid"
        accent="var(--chart-5)"
        value={dxGrid}
        coords={dxCoords}
        valid={dxValid}
        onChange={onDxChange}
        antennaLabel="DX Ant"
        antennaHeight={dxAntM}
        onAntennaChange={onDxAntChange}
        groundElev={dxGround}
        fetchedGround={dxFetchedGround}
        overridden={dxGroundOverridden}
        onGroundChange={onDxGroundChange}
        antennaAsl={dxGround != null ? dxGround + dxAntM : null}
      />
    </div>
  )
}
