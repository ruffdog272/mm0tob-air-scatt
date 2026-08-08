"use client"

import useSWR from "swr"

interface SpaceWeather {
  sfi: number | null
  ssn: number | null
  kp: number | null
  kpTime: string | null
  updated: string
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

function kpTone(kp: number | null): { label: string; color: string } {
  if (kp == null) return { label: "—", color: "var(--muted-foreground)" }
  if (kp < 4) return { label: "Quiet", color: "var(--prob-high)" }
  if (kp < 5) return { label: "Unsettled", color: "var(--prob-marginal)" }
  return { label: "Storm", color: "var(--prob-unlikely)" }
}

function Metric({
  label,
  value,
  hint,
  color,
}: {
  label: string
  value: string
  hint?: string
  color?: string
}) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-border/60 py-2.5 last:border-0">
      <div className="flex flex-col">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        {hint && <span className="text-[10px] text-muted-foreground/70">{hint}</span>}
      </div>
      <span
        className="font-mono text-xl tabular-nums"
        style={{ color: color ?? "var(--foreground)" }}
      >
        {value}
      </span>
    </div>
  )
}

export function SpaceWeather() {
  const { data } = useSWR<SpaceWeather>("/api/space-weather", fetcher, {
    refreshInterval: 15 * 60 * 1000,
  })
  const kp = kpTone(data?.kp ?? null)

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-tight">Space Weather</h2>
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          NOAA SWPC
        </span>
      </div>
      <div>
        <Metric
          label="SFI"
          hint="10.7 cm solar flux"
          value={data?.sfi != null ? data.sfi.toFixed(0) : "—"}
          color="var(--primary)"
        />
        <Metric
          label="SSN"
          hint="Sunspot number"
          value={data?.ssn != null ? data.ssn.toFixed(0) : "—"}
        />
        <Metric
          label="Kp"
          hint={kp.label}
          value={data?.kp != null ? data.kp.toFixed(2) : "—"}
          color={kp.color}
        />
      </div>
    </section>
  )
}
