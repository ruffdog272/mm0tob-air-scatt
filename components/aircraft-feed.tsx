"use client"

import { useEffect, useState } from "react"
import { Antenna, ArrowUpRight, Gauge, Plane, Radio, X } from "lucide-react"

import { BANDS, type AnalyzedAircraft, type Probability } from "@/lib/scatter"

const PROB_META: Record<Probability, { label: string; color: string }> = {
  high: { label: "HIGH", color: "var(--prob-high)" },
  marginal: { label: "MARG", color: "var(--prob-marginal)" },
  unlikely: { label: "LOW", color: "var(--prob-unlikely)" },
}

function fmtDoppler(hz: number): string {
  const sign = hz > 0 ? "+" : hz < 0 ? "\u2212" : "\u00b1"
  const abs = Math.abs(hz)
  if (abs >= 1000) return `${sign}${(abs / 1000).toFixed(2)} kHz`
  return `${sign}${abs.toFixed(0)} Hz`
}

function fmtEta(seconds: number | null): string {
  if (seconds == null) return "—"
  if (seconds <= 0) return "NOW"
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, "0")}`
}

function fmtAlt(altFt: number, altM: number): string {
  return `${Math.round(altFt).toLocaleString("en-US")} ft / ${Math.round(
    altM,
  ).toLocaleString("en-US")} m`
}

/** Compass dial showing the antenna azimuth from the home station. */
function AzimuthDial({ deg, color }: { deg: number; color: string }) {
  return (
    <div className="relative h-9 w-9 shrink-0 rounded-full border border-border">
      <div
        className="absolute left-1/2 top-1/2 h-3.5 w-px"
        style={{
          background: color,
          transform: `translate(-50%,-100%) rotate(${deg}deg)`,
          transformOrigin: "bottom center",
        }}
      />
      <span className="absolute inset-0 flex items-center justify-center font-mono text-[9px] text-muted-foreground">
        {Math.round(deg)}
      </span>
    </div>
  )
}

function AircraftRow({
  a,
  band,
  remainingEta,
  onSelect,
}: {
  a: AnalyzedAircraft
  band: string
  remainingEta: number | null
  onSelect: () => void
}) {
  const meta = PROB_META[a.probability]
  return (
    <li>
      <button
        onClick={onSelect}
        className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 rounded-md border-l-2 bg-secondary/30 px-3 py-2.5 text-left transition hover:bg-secondary/70 focus:outline-none focus:ring-2 focus:ring-ring/50"
        style={{ borderLeftColor: meta.color }}
      >
        <AzimuthDial deg={a.bearingFromHome} color={meta.color} />

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate font-mono text-sm font-semibold text-foreground">
              {a.callsign}
            </span>
            <span
              className="rounded px-1.5 py-0.5 font-mono text-[9px] font-bold tracking-wider"
              style={{ background: `${meta.color}22`, color: meta.color }}
            >
              {meta.label}
            </span>
          </div>
          <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[11px] text-muted-foreground">
            <span>{fmtAlt(a.altFt, a.altM)}</span>
            <span>el {a.elevationDeg.toFixed(1)}°</span>
            <span style={{ color: meta.color }}>
              {a.crossTrackKm >= 0 ? "+" : "\u2212"}
              {Math.abs(a.crossTrackKm).toFixed(1)} km
            </span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-0.5 text-right">
          <span className="font-mono text-sm tabular-nums text-foreground">
            {fmtDoppler(a.doppler[band])}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            ETA {fmtEta(remainingEta)}
          </span>
        </div>
      </button>
    </li>
  )
}

function DetailRow({
  label,
  value,
  color,
}: {
  label: string
  value: string
  color?: string
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border/50 py-2">
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span
        className="font-mono text-sm tabular-nums text-foreground"
        style={color ? { color } : undefined}
      >
        {value}
      </span>
    </div>
  )
}

function AircraftDetail({
  a,
  band,
  remainingEta,
  onClose,
}: {
  a: AnalyzedAircraft
  band: string
  remainingEta: number | null
  onClose: () => void
}) {
  const meta = PROB_META[a.probability]

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`Aircraft ${a.callsign} details`}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header
          className="flex items-center justify-between gap-3 border-b border-border px-5 py-4"
          style={{ borderBottomColor: meta.color }}
        >
          <div className="flex items-center gap-3">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-lg"
              style={{ background: `${meta.color}22`, color: meta.color }}
            >
              <Plane className="h-5 w-5" />
            </span>
            <div>
              <h3 className="font-mono text-base font-semibold text-foreground">
                {a.callsign}
              </h3>
              <span
                className="font-mono text-[10px] font-bold uppercase tracking-wider"
                style={{ color: meta.color }}
              >
                {meta.label} probability
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close details"
            className="rounded-md p-1.5 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="grid grid-cols-3 gap-2 px-5 pt-4">
          <div className="flex flex-col items-center rounded-md bg-secondary/40 p-2">
            <Antenna className="mb-1 h-4 w-4 text-primary" />
            <span className="font-mono text-sm text-foreground">
              {Math.round(a.bearingFromHome)}°
            </span>
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground">
              Azimuth
            </span>
          </div>
          <div className="flex flex-col items-center rounded-md bg-secondary/40 p-2">
            <ArrowUpRight className="mb-1 h-4 w-4 text-primary" />
            <span className="font-mono text-sm text-foreground">
              {a.elevationDeg.toFixed(1)}°
            </span>
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground">
              Elevation
            </span>
          </div>
          <div className="flex flex-col items-center rounded-md bg-secondary/40 p-2">
            <Gauge className="mb-1 h-4 w-4 text-primary" />
            <span className="font-mono text-sm text-foreground">
              {Math.round(a.groundSpeedKt)}
            </span>
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground">
              Knots
            </span>
          </div>
        </div>

        <div className="px-5 pb-5 pt-3">
          <DetailRow label="Altitude" value={fmtAlt(a.altFt, a.altM)} />
          <DetailRow
            label="Antenna Azimuth"
            value={`${a.bearingFromHome.toFixed(1)}°`}
          />
          <DetailRow
            label="Elevation Angle"
            value={`${a.elevationDeg.toFixed(2)}° above horizon`}
          />
          <DetailRow
            label="Range from station"
            value={`${a.rangeFromHomeKm.toFixed(1)} km`}
          />
          <DetailRow
            label="Cross-track offset"
            value={`${a.crossTrackKm >= 0 ? "+" : "\u2212"}${Math.abs(
              a.crossTrackKm,
            ).toFixed(2)} km`}
            color={meta.color}
          />
          <DetailRow label="Ground track" value={`${Math.round(a.track)}°`} />
          <DetailRow
            label={`Doppler (${BANDS.find((b) => b.key === band)?.label ?? band})`}
            value={fmtDoppler(a.doppler[band])}
          />
          <DetailRow label="ETA to path" value={fmtEta(remainingEta)} />
          <div className="mt-3 flex items-center gap-2 rounded-md bg-secondary/40 px-3 py-2 text-[11px] text-muted-foreground">
            <Radio className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span>
              Point beam to {Math.round(a.bearingFromHome)}° azimuth,{" "}
              {a.elevationDeg.toFixed(1)}° elevation for this reflection.
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export function AircraftFeed({
  aircraft,
  band,
  onBandChange,
  dataTimestamp,
  now,
  error,
}: {
  aircraft: AnalyzedAircraft[]
  band: string
  onBandChange: (b: string) => void
  dataTimestamp: number | null
  now: number
  error?: boolean
}) {
  const [selectedHex, setSelectedHex] = useState<string | null>(null)
  const elapsed = dataTimestamp ? (now - dataTimestamp) / 1000 : 0
  const selected = aircraft.find((a) => a.hex === selectedHex) ?? null
  const selectedEta =
    selected && selected.etaSeconds != null
      ? selected.etaSeconds - elapsed
      : null

  return (
    <section className="flex min-h-0 flex-col rounded-lg border border-border bg-card">
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold tracking-tight">Closing Traffic</h2>
          <span className="rounded-full bg-secondary px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
            {aircraft.length} inbound
          </span>
        </div>
        <div className="flex items-center gap-1 rounded-md bg-secondary p-0.5">
          {BANDS.map((b) => (
            <button
              key={b.key}
              onClick={() => onBandChange(b.key)}
              className={`rounded px-2 py-1 font-mono text-[11px] transition ${
                band === b.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {b.label}
            </button>
          ))}
        </div>
      </header>

      <ul className="flex flex-col gap-1.5 overflow-y-auto p-2.5">
        {error && (
          <li className="px-3 py-6 text-center text-sm text-destructive">
            Feed unavailable — retrying…
          </li>
        )}
        {!error && aircraft.length === 0 && (
          <li className="px-3 py-10 text-center text-sm text-muted-foreground">
            No aircraft currently closing on the path.
          </li>
        )}
        {aircraft.map((a) => {
          const remaining = a.etaSeconds != null ? a.etaSeconds - elapsed : null
          return (
            <AircraftRow
              key={a.hex}
              a={a}
              band={band}
              remainingEta={remaining}
              onSelect={() => setSelectedHex(a.hex)}
            />
          )
        })}
      </ul>

      {selected && (
        <AircraftDetail
          a={selected}
          band={band}
          remainingEta={selectedEta}
          onClose={() => setSelectedHex(null)}
        />
      )}
    </section>
  )
}
