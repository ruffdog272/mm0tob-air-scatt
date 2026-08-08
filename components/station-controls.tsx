"use client"

import type { LatLon } from "@/lib/maidenhead"

function GridField({
  label,
  accent,
  value,
  coords,
  valid,
  onChange,
}: {
  label: string
  accent: string
  value: string
  coords: LatLon | null
  valid: boolean
  onChange: (v: string) => void
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
  onCallsignChange,
  onMyChange,
  onDxChange,
}: {
  callsign: string
  myGrid: string
  dxGrid: string
  myCoords: LatLon | null
  dxCoords: LatLon | null
  myValid: boolean
  dxValid: boolean
  onCallsignChange: (v: string) => void
  onMyChange: (v: string) => void
  onDxChange: (v: string) => void
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
      />
      <GridField
        label="DX Grid"
        accent="var(--chart-5)"
        value={dxGrid}
        coords={dxCoords}
        valid={dxValid}
        onChange={onDxChange}
      />
    </div>
  )
}
