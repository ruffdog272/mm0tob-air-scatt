"use client"

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

function AircraftRow({
  a,
  band,
  remainingEta,
}: {
  a: AnalyzedAircraft
  band: string
  remainingEta: number | null
}) {
  const meta = PROB_META[a.probability]
  return (
    <li
      className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-md border-l-2 bg-secondary/30 px-3 py-2.5 transition hover:bg-secondary/60"
      style={{ borderLeftColor: meta.color }}
    >
      {/* Bearing dial */}
      <div className="relative h-9 w-9 shrink-0 rounded-full border border-border">
        <div
          className="absolute left-1/2 top-1/2 h-3.5 w-px origin-bottom -translate-x-1/2 -translate-y-full"
          style={{
            background: meta.color,
            transform: `translate(-50%,-100%) rotate(${a.bearingFromHome}deg)`,
            transformOrigin: "bottom center",
          }}
        />
        <span className="absolute inset-0 flex items-center justify-center font-mono text-[9px] text-muted-foreground">
          {Math.round(a.bearingFromHome)}
        </span>
      </div>

      {/* Identity + telemetry */}
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
          <span>FL{Math.round(a.altFt / 100)}</span>
          <span>{Math.round(a.groundSpeedKt)} kt</span>
          <span>hdg {Math.round(a.track)}°</span>
          <span style={{ color: meta.color }}>
            {a.crossTrackKm >= 0 ? "+" : "\u2212"}
            {Math.abs(a.crossTrackKm).toFixed(1)} km
          </span>
        </div>
      </div>

      {/* Doppler + ETA */}
      <div className="flex flex-col items-end gap-0.5 text-right">
        <span className="font-mono text-sm tabular-nums text-foreground">
          {fmtDoppler(a.doppler[band])}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          ETA {fmtEta(remainingEta)}
        </span>
      </div>
    </li>
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
  const elapsed = dataTimestamp ? (now - dataTimestamp) / 1000 : 0

  return (
    <section className="flex min-h-0 flex-col rounded-lg border border-border bg-card">
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold tracking-tight">Live Feed</h2>
          <span className="rounded-full bg-secondary px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
            {aircraft.length} above FL200
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
            No cruising aircraft in the search box right now.
          </li>
        )}
        {aircraft.map((a) => {
          const remaining = a.etaSeconds != null ? a.etaSeconds - elapsed : null
          return (
            <AircraftRow key={a.hex} a={a} band={band} remainingEta={remaining} />
          )
        })}
      </ul>
    </section>
  )
}
