"use client"

import { useMemo } from "react"
import { Mountain, TriangleAlert } from "lucide-react"

import type { ClearanceResult, TerrainProfile } from "@/lib/terrain"

const W = 800
const H = 240
const PAD = { top: 16, right: 16, bottom: 28, left: 44 }

export function TerrainProfileChart({
  profile,
  clearance,
  loading,
  error,
}: {
  profile: TerrainProfile | null
  clearance: ClearanceResult | null
  loading: boolean
  error: boolean
}) {
  const geom = useMemo(() => {
    if (!profile || !clearance) return null
    const { distances, elevations, totalKm } = profile
    const eff = clearance.effectiveTerrain
    const plotW = W - PAD.left - PAD.right
    const plotH = H - PAD.top - PAD.bottom

    // Curvature-corrected ("bulge-added") view: the effective terrain is the
    // primary curve so LOS clipping is visually obvious. Y range spans the
    // effective terrain and the LOS line, with a little headroom.
    const allY = [...eff, ...clearance.losLine]
    const yMin = Math.min(0, ...allY)
    const yMax = Math.max(...allY) * 1.08 || 100

    const x = (km: number) => PAD.left + (totalKm > 0 ? km / totalKm : 0) * plotW
    const y = (m: number) =>
      PAD.top + plotH - ((m - yMin) / (yMax - yMin || 1)) * plotH

    // Effective-terrain area (filled to the baseline) + its outline.
    const effTop = eff.map((e, i) => `${x(distances[i])},${y(e)}`)
    const areaPath =
      `M ${x(0)},${y(yMin)} ` +
      effTop.map((p) => `L ${p}`).join(" ") +
      ` L ${x(totalKm)},${y(yMin)} Z`
    const terrainLine = `M ${effTop.map((p) => `L ${p}`).join(" ").slice(2)}`

    // Raw ground elevation as a subtle secondary reference line.
    const groundLine =
      "M " +
      elevations
        .map((e, i) => `${x(distances[i])},${y(e)}`)
        .join(" L ")

    const losPath = `M ${x(0)},${y(clearance.losLine[0])} L ${x(totalKm)},${y(
      clearance.losLine[clearance.losLine.length - 1],
    )}`

    // Y-axis ticks (4 divisions).
    const ticks = Array.from({ length: 4 }, (_, i) => {
      const v = yMin + ((yMax - yMin) * i) / 3
      return { v, y: y(v) }
    })

    const worst = {
      x: x(distances[clearance.worstIndex]),
      yTerrain: y(clearance.effectiveTerrain[clearance.worstIndex]),
      yLos: y(clearance.losLine[clearance.worstIndex]),
    }

    return {
      areaPath,
      terrainLine,
      groundLine,
      losPath,
      ticks,
      worst,
      homeXY: { x: x(0), y: y(clearance.homeAsl) },
      dxXY: { x: x(totalKm), y: y(clearance.dxAsl) },
      totalKm,
    }
  }, [profile, clearance])

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <Mountain className="h-4 w-4 text-primary" />
          Terrain Profile & Radio Horizon
        </h2>
        {clearance && !loading && (
          <span className="font-mono text-[11px] text-muted-foreground">
            {profile ? `${profile.totalKm.toFixed(0)} km` : ""} ·{" "}
            {clearance.obstructed ? (
              <span className="text-prob-unlikely">blocked</span>
            ) : (
              <span className="text-prob-high">clear</span>
            )}
          </span>
        )}
      </div>

      {/* Obstruction warning — the prominent probability-log indicator. */}
      {clearance?.obstructed && (
        <div
          role="alert"
          className="mb-3 flex items-start gap-2.5 rounded-md border border-destructive/50 bg-destructive/15 px-3 py-2.5"
        >
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div className="leading-tight">
            <p className="text-sm font-semibold text-foreground">
              Obstructed Path — High Take-off Angle Required
            </p>
            <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
              Terrain clips LOS by {Math.abs(clearance.worstClearance).toFixed(0)} m.
              Needs ≥ {clearance.requiredTakeoffDeg.toFixed(1)}° take-off from HOME.
            </p>
          </div>
        </div>
      )}

      {loading && (
        <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
          Fetching elevation profile…
        </div>
      )}
      {error && !loading && (
        <div className="flex h-[200px] items-center justify-center text-sm text-prob-unlikely">
          Terrain data unavailable.
        </div>
      )}

      {geom && !loading && !error && (
        <>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full"
            role="img"
            aria-label="Terrain elevation profile with line-of-sight path"
          >
            {/* Grid + Y ticks */}
            {geom.ticks.map((t, i) => (
              <g key={i}>
                <line
                  x1={PAD.left}
                  x2={W - PAD.right}
                  y1={t.y}
                  y2={t.y}
                  stroke="var(--border)"
                  strokeWidth={1}
                  opacity={0.5}
                />
                <text
                  x={PAD.left - 6}
                  y={t.y + 3}
                  textAnchor="end"
                  className="fill-muted-foreground font-mono"
                  fontSize={9}
                >
                  {Math.round(t.v)}
                </text>
              </g>
            ))}

            {/* Effective terrain (curvature-corrected) fill + outline */}
            <path d={geom.areaPath} fill="var(--secondary)" opacity={0.9} />
            <path
              d={geom.terrainLine}
              fill="none"
              stroke="var(--muted-foreground)"
              strokeWidth={1.5}
            />
            {/* Raw ground elevation reference */}
            <path
              d={geom.groundLine}
              fill="none"
              stroke="var(--muted-foreground)"
              strokeWidth={1}
              strokeDasharray="1 3"
              opacity={0.5}
            />

            {/* Line-of-sight (dashed) */}
            <path
              d={geom.losPath}
              fill="none"
              stroke={
                clearance?.obstructed ? "var(--destructive)" : "var(--prob-high)"
              }
              strokeWidth={2}
              strokeDasharray="6 4"
            />

            {/* Worst-peak clearance marker */}
            {clearance?.obstructed && (
              <line
                x1={geom.worst.x}
                x2={geom.worst.x}
                y1={geom.worst.yTerrain}
                y2={geom.worst.yLos}
                stroke="var(--destructive)"
                strokeWidth={1.5}
                strokeDasharray="2 2"
              />
            )}

            {/* Antenna endpoints */}
            <circle cx={geom.homeXY.x} cy={geom.homeXY.y} r={4} fill="var(--primary)" />
            <circle cx={geom.dxXY.x} cy={geom.dxXY.y} r={4} fill="var(--chart-5)" />

            {/* X axis labels */}
            <text
              x={PAD.left}
              y={H - 8}
              textAnchor="start"
              className="fill-primary font-mono"
              fontSize={9}
            >
              HOME
            </text>
            <text
              x={W - PAD.right}
              y={H - 8}
              textAnchor="end"
              className="fill-chart-5 font-mono"
              fontSize={9}
            >
              DX
            </text>
            <text
              x={(PAD.left + W - PAD.right) / 2}
              y={H - 8}
              textAnchor="middle"
              className="fill-muted-foreground font-mono"
              fontSize={9}
            >
effective terrain (m ASL, Earth-curvature corrected)
            </text>
          </svg>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-secondary ring-1 ring-muted-foreground" />
              effective terrain
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-0 w-4 border-t border-dotted border-muted-foreground" />
              raw ground
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block h-0 w-4 border-t-2 border-dashed"
                style={{
                  borderColor: clearance?.obstructed
                    ? "var(--destructive)"
                    : "var(--prob-high)",
                }}
              />
              line of sight
            </span>
            {clearance && (
              <span>
                HOME {clearance.homeAsl.toFixed(0)} m · DX {clearance.dxAsl.toFixed(0)} m
                ASL
              </span>
            )}
          </div>
        </>
      )}
    </section>
  )
}
