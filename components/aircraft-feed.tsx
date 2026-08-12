"use client"

import { useEffect, useState } from "react"
import { Antenna, ArrowUpRight, Gauge, Plane, Radio, Timer, X } from "lucide-react"

import { BANDS, type AnalyzedAircraft, type Probability } from "@/lib/scatter"
import { type AltUnit, fmtAltUnit } from "@/lib/units"

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

const COMPASS_POINTS = [
  "N",
  "NNE",
  "NE",
  "ENE",
  "E",
  "ESE",
  "SE",
  "SSE",
  "S",
  "SSW",
  "SW",
  "WSW",
  "W",
  "WNW",
  "NW",
  "NNW",
]

function compassPoint(deg: number): string {
  const idx = Math.round((((deg % 360) + 360) % 360) / 22.5) % 16
  return COMPASS_POINTS[idx]
}

function fmtTrajectory(a: AnalyzedAircraft): string {
  if (a.willIntersect) return "Will cross path segment"
  if (a.minTrajectoryDistKm <= 10)
    return `Passes ${a.minTrajectoryDistKm.toFixed(1)} km from path`
  return "Misses station-to-station window"
}

function fmtAlt(altM: number, unit: AltUnit): string {
  return fmtAltUnit(altM, unit)
}

/**
 * Compass dial showing the aircraft's absolute flight heading (movement vector
 * relative to true north). The needle points the same way the plane icon does
 * on the map: 0=N (up), 90=E (right), 180=S (down), 270=W (left).
 */
function HeadingDial({ deg, color }: { deg: number; color: string }) {
  return (
    <div
      className="relative h-9 w-9 shrink-0 rounded-full border border-border"
      title={`Flight heading ${Math.round(deg)}°`}
    >
      {/* North tick */}
      <span className="absolute left-1/2 top-0.5 -translate-x-1/2 text-[7px] leading-none text-muted-foreground/70">
        N
      </span>
      {/* Heading needle: arrow points in the direction of travel */}
      <div
        className="absolute left-1/2 top-1/2 h-4 w-0"
        style={{
          transform: `translate(-50%, -50%) rotate(${deg}deg)`,
          transformOrigin: "center center",
        }}
      >
        <div
          className="absolute left-1/2 top-0 h-2.5 w-px -translate-x-1/2"
          style={{ background: color }}
        />
        <div
          className="absolute left-1/2 top-0 h-0 w-0 -translate-x-1/2 -translate-y-0.5"
          style={{
            borderLeft: "2.5px solid transparent",
            borderRight: "2.5px solid transparent",
            borderBottom: `4px solid ${color}`,
          }}
        />
      </div>
      <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 font-mono text-[8px] text-muted-foreground">
        {Math.round(deg)}°
      </span>
    </div>
  )
}

function AircraftRow({
  a,
  band,
  unit,
  remainingEta,
  onSelect,
}: {
  a: AnalyzedAircraft
  band: string
  unit: AltUnit
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
        <HeadingDial deg={a.headingDeg} color={meta.color} />

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
            <span>{fmtAlt(a.altM, unit)}</span>
            <span>el {a.elevationDeg.toFixed(1)}°</span>
            <span style={{ color: meta.color }}>
              {a.willIntersect ? "crosses" : `${a.distToSegmentKm.toFixed(1)} km off`}
            </span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-0.5 text-right">
          <span className="font-mono text-sm tabular-nums text-foreground">
            {fmtDoppler(a.doppler[band])}
          </span>
          {a.willIntersect ? (
            <span
              className="font-mono text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: meta.color }}
            >
              ETA {fmtEta(remainingEta)}
            </span>
          ) : (
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              no cross
            </span>
          )}
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
  unit,
  remainingEta,
  onClose,
}: {
  a: AnalyzedAircraft
  band: string
  unit: AltUnit
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
          {/* Prominent live ETA-to-path-intersection countdown */}
          <div
            className="mb-3 flex items-center justify-between gap-3 rounded-lg border px-4 py-3"
            style={{
              borderColor: a.willIntersect ? meta.color : "var(--border)",
              background: a.willIntersect ? `${meta.color}14` : "var(--secondary)",
            }}
          >
            <div className="flex items-center gap-2">
              <Timer
                className="h-4 w-4"
                style={{ color: a.willIntersect ? meta.color : "var(--muted-foreground)" }}
              />
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                ETA to Path Intersection
              </span>
            </div>
            <span
              className="font-mono text-2xl font-semibold tabular-nums"
              style={{ color: a.willIntersect ? meta.color : "var(--muted-foreground)" }}
            >
              {a.willIntersect ? fmtEta(remainingEta) : "no cross"}
            </span>
          </div>

          <DetailRow label="Altitude" value={fmtAlt(a.altM, unit)} />
          <DetailRow
            label="Flight Heading"
            value={`${a.headingDeg.toFixed(1)}° (${compassPoint(a.headingDeg)})`}
          />
          <DetailRow
            label="Trajectory"
            value={fmtTrajectory(a)}
            color={meta.color}
          />
          <DetailRow
            label="Dist. to path window"
            value={`${a.distToSegmentKm.toFixed(2)} km`}
          />
          {a.crossingPoint && (
            <DetailRow
              label="Predicted crossing"
              value={`${a.crossingPoint.lat.toFixed(3)}, ${a.crossingPoint.lon.toFixed(3)}`}
            />
          )}
          <DetailRow
            label="HOME azimuth"
            value={`${a.bearingFromHome.toFixed(1)}°`}
          />
          <DetailRow label="DX azimuth" value={`${a.bearingFromDx.toFixed(1)}°`} />
          <DetailRow
            label="Elevation Angle"
            value={`${a.elevationDeg.toFixed(2)}° above horizon`}
          />
          <DetailRow
            label="Range from station"
            value={`${a.rangeFromHomeKm.toFixed(1)} km`}
          />
          <DetailRow
            label="Reported track (ADS-B)"
            value={`${Math.round(a.track)}°`}
          />
          <DetailRow
            label={`Doppler (${BANDS.find((b) => b.key === band)?.label ?? band})`}
            value={fmtDoppler(a.doppler[band])}
          />
          <DetailRow label="ETA to path" value={fmtEta(remainingEta)} />
          <div className="mt-3 flex items-center gap-2 rounded-md bg-secondary/40 px-3 py-2 text-[11px] text-muted-foreground">
            <Radio className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span>
              Pre-aim HOME to {Math.round(a.bearingFromHome)}° / DX to{" "}
              {Math.round(a.bearingFromDx)}° azimuth, {a.elevationDeg.toFixed(1)}°
              elevation to track this aircraft.
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
  unit,
  onBandChange,
  dataTimestamp,
  now,
  error,
}: {
  aircraft: AnalyzedAircraft[]
  band: string
  unit: AltUnit
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
        <div
          role="group"
          aria-label="Doppler band"
          className="flex items-center gap-1 rounded-lg border border-border bg-secondary/60 p-1"
        >
          {BANDS.map((b) => {
            const active = band === b.key
            return (
              <button
                key={b.key}
                onClick={() => onBandChange(b.key)}
                aria-pressed={active}
                className={`rounded-md px-2.5 py-1 font-mono text-[11px] font-semibold transition ${
                  active
                    ? "bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/60"
                    : "bg-transparent text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                {b.label}
              </button>
            )
          })}
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
              unit={unit}
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
          unit={unit}
          remainingEta={selectedEta}
          onClose={() => setSelectedHex(null)}
        />
      )}
    </section>
  )
}
