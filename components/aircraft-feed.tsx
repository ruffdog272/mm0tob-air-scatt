"use client"

import { useEffect, useRef, useState } from "react"
import { Antenna, ArrowUpRight, Gauge, Plane, Radio, Settings, Timer, Wifi, X } from "lucide-react"

import {
  BANDS,
  MARGINAL_CORRIDOR_KM,
  type AnalyzedAircraft,
  type Probability,
} from "@/lib/scatter"
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
  if (a.minTrajectoryDistKm <= MARGINAL_CORRIDOR_KM)
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

type RotatorProtocol = "pstrotator" | "standard"

type RotatorConfig = {
  address: string
  protocol: RotatorProtocol
  thresholdDeg: number
}

const ROTATOR_CONFIG_KEY = "rotatorConfig"

const DEFAULT_ROTATOR_CONFIG: RotatorConfig = {
  address: "http://127.0.0.1:8080",
  protocol: "pstrotator",
  thresholdDeg: 0.5,
}

function loadRotatorConfig(): RotatorConfig {
  if (typeof window === "undefined") return DEFAULT_ROTATOR_CONFIG
  try {
    const raw = localStorage.getItem(ROTATOR_CONFIG_KEY)
    if (!raw) return DEFAULT_ROTATOR_CONFIG
    const parsed = JSON.parse(raw) as Partial<RotatorConfig>
    return {
      address:
        typeof parsed.address === "string" && parsed.address.trim()
          ? parsed.address.trim()
          : DEFAULT_ROTATOR_CONFIG.address,
      protocol: parsed.protocol === "standard" ? "standard" : "pstrotator",
      thresholdDeg:
        typeof parsed.thresholdDeg === "number" && Number.isFinite(parsed.thresholdDeg) && parsed.thresholdDeg >= 0
          ? parsed.thresholdDeg
          : DEFAULT_ROTATOR_CONFIG.thresholdDeg,
    }
  } catch {
    return DEFAULT_ROTATOR_CONFIG
  }
}

/** Builds the hardware rotator URL for the given az/el using the selected protocol. */
function buildRotatorUrl(config: RotatorConfig, az: number, el: number): string {
  const base = config.address.trim().replace(/\/+$/, "")
  const azStr = az.toFixed(1)
  const elStr = el.toFixed(1)
  return config.protocol === "standard"
    ? `${base}/set?az=${azStr}&el=${elStr}`
    : `${base}/azel?az=${azStr}&el=${elStr}`
}

function RotatorSettingsForm({
  config,
  onChange,
}: {
  config: RotatorConfig
  onChange: (next: RotatorConfig) => void
}) {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-border bg-secondary/20 p-3">
      <div className="flex flex-col gap-1">
        <label
          htmlFor="rotator-address"
          className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
        >
          Rotator Address
        </label>
        <input
          id="rotator-address"
          type="text"
          value={config.address}
          onChange={(e) => onChange({ ...config, address: e.target.value })}
          placeholder="http://127.0.0.1:8080"
          className="rounded-md border border-border bg-background px-2.5 py-1.5 font-mono text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor="rotator-protocol"
          className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
        >
          Protocol / Format
        </label>
        <select
          id="rotator-protocol"
          value={config.protocol}
          onChange={(e) =>
            onChange({ ...config, protocol: e.target.value === "standard" ? "standard" : "pstrotator" })
          }
          className="rounded-md border border-border bg-background px-2.5 py-1.5 font-mono text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
        >
          <option value="pstrotator">PstRotator (azel?az=X&amp;el=Y)</option>
          <option value="standard">Standard Web (set?az=X&amp;el=Y)</option>
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor="rotator-threshold"
          className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
        >
          Minimum Movement Threshold (°)
        </label>
        <input
          id="rotator-threshold"
          type="number"
          min={0}
          step={0.1}
          value={config.thresholdDeg}
          onChange={(e) => {
            const value = Number.parseFloat(e.target.value)
            onChange({
              ...config,
              thresholdDeg: Number.isFinite(value) && value >= 0 ? value : 0,
            })
          }}
          className="rounded-md border border-border bg-background px-2.5 py-1.5 font-mono text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
        />
        <span className="text-[10px] text-muted-foreground">
          Prevents micro-adjustments that wear out hardware gears.
        </span>
      </div>
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
  const [autoTrack, setAutoTrack] = useState(false)
  const [rotatorStatus, setRotatorStatus] = useState<"offline" | "online">("offline")
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [rotatorConfig, setRotatorConfig] = useState<RotatorConfig>(DEFAULT_ROTATOR_CONFIG)
  const lastSentRef = useRef<{ az: number; el: number } | null>(null)

  // Load persisted rotator config on mount (client-only).
  useEffect(() => {
    setRotatorConfig(loadRotatorConfig())
  }, [])

  const updateRotatorConfig = (next: RotatorConfig) => {
    setRotatorConfig(next)
    try {
      localStorage.setItem(ROTATOR_CONFIG_KEY, JSON.stringify(next))
    } catch {
      // Ignore storage failures (e.g. private browsing quota).
    }
  }

  useEffect(() => {
    if (!autoTrack || !Number.isFinite(a.bearingFromHome) || !Number.isFinite(a.elevationDeg)) return

    const az = a.bearingFromHome
    const el = a.elevationDeg
    const last = lastSentRef.current
    const movedEnough =
      !last ||
      Math.abs(az - last.az) >= rotatorConfig.thresholdDeg ||
      Math.abs(el - last.el) >= rotatorConfig.thresholdDeg

    if (!movedEnough) return

    let active = true
    void fetch(buildRotatorUrl(rotatorConfig, az, el), { method: "GET" })
      .then((response) => {
        if (!active) return
        setRotatorStatus(response.ok ? "online" : "offline")
        if (response.ok) lastSentRef.current = { az, el }
      })
      .catch(() => {
        if (active) setRotatorStatus("offline")
      })

    return () => {
      active = false
    }
  }, [autoTrack, a.bearingFromHome, a.elevationDeg, rotatorConfig])

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
          <div className="mt-3 flex flex-col gap-3 rounded-md border border-border bg-secondary/30 px-3 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Wifi className="h-3.5 w-3.5 text-primary" />
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Hardware rotator
                </span>
              </div>
              <span className={`flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider ${rotatorStatus === "online" ? "text-emerald-500" : "text-destructive"}`}>
                <span className={`size-1.5 rounded-full ${rotatorStatus === "online" ? "bg-emerald-500" : "bg-destructive"}`} />
                {rotatorStatus === "online" ? "Connected" : "Offline"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={autoTrack}
                onClick={() => setAutoTrack((enabled) => !enabled)}
                className="flex flex-1 items-center justify-between gap-3 text-left focus:outline-none focus:ring-2 focus:ring-ring/50"
              >
                <span className="text-xs font-medium text-foreground">Auto-Track Hardware</span>
                <span className={`relative h-5 w-9 rounded-full transition-colors ${autoTrack ? "bg-primary" : "bg-muted"}`}>
                  <span className={`absolute top-0.5 size-4 rounded-full bg-background shadow-sm transition-transform ${autoTrack ? "translate-x-4" : "translate-x-0.5"}`} />
                </span>
              </button>
              <button
                type="button"
                aria-label="Rotator settings"
                aria-expanded={settingsOpen}
                onClick={() => setSettingsOpen((open) => !open)}
                className={`shrink-0 rounded-md p-1.5 transition hover:bg-secondary hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 ${settingsOpen ? "bg-secondary text-foreground" : "text-muted-foreground"}`}
              >
                <Settings className="h-3.5 w-3.5" />
              </button>
            </div>
            {settingsOpen && (
              <RotatorSettingsForm config={rotatorConfig} onChange={updateRotatorConfig} />
            )}
          </div>
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
  selectedHex,
  onSelectHex,
}: {
  aircraft: AnalyzedAircraft[]
  band: string
  unit: AltUnit
  onBandChange: (b: string) => void
  dataTimestamp: number | null
  now: number
  error?: boolean
  /** hex of the selected aircraft (controlled by the parent, shared with map) */
  selectedHex: string | null
  /** select (or deselect with null) an aircraft to show/hide its detail card */
  onSelectHex: (hex: string | null) => void
}) {
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
              onSelect={() => onSelectHex(a.hex)}
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
          onClose={() => onSelectHex(null)}
        />
      )}
    </section>
  )
}
