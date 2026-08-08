"use client"

import { useMemo } from "react"
import { Mountain } from "lucide-react"

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

    const x = (km: number) => PAD.left + (totalKm > 0 ? km / totalKm : 0) * plotW

    // Take-off beam endpoints (heights where each beam grazes its worst hill).
    const homeBeamEnd =
      clearance.homeAsl +
      Math.tan((clearance.homeTakeoffDeg * Math.PI) / 180) *
        clearance.homeObstructionKm *
        1000
    const dxBeamEnd =
      clearance.dxAsl +
      Math.tan((clearance.dxTakeoffDeg * Math.PI) / 180) *
        clearance.dxObstructionKm *
        1000

    // Curvature-corrected view: effective terrain is the primary curve.
    const allY = [...eff, clearance.homeAsl, clearance.dxAsl, homeBeamEnd, dxBeamEnd]
    const yMin = Math.min(0, ...allY)
    const yMax = Math.max(...allY) * 1.08 || 100

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
      "M " + elevations.map((e, i) => `${x(distances[i])},${y(e)}`).join(" L ")

    // Direct A-to-B path — reference only (NOT the scatter path).
    const losPath = `M ${x(0)},${y(clearance.losLine[0])} L ${x(totalKm)},${y(
      clearance.losLine[clearance.losLine.length - 1],
    )}`

    // Take-off beam rays from each antenna up to their limiting hill.
    const homeBeam = `M ${x(0)},${y(clearance.homeAsl)} L ${x(
      clearance.homeObstructionKm,
    )},${y(homeBeamEnd)}`
    const dxBeam = `M ${x(totalKm)},${y(clearance.dxAsl)} L ${x(
      totalKm - clearance.dxObstructionKm,
    )},${y(dxBeamEnd)}`

    // Y-axis ticks (4 divisions).
    const ticks = Array.from({ length: 4 }, (_, i) => {
      const v = yMin + ((yMax - yMin) * i) / 3
      return { v, y: y(v) }
    })

    return {
      areaPath,
      terrainLine,
      groundLine,
      losPath,
      homeBeam,
      dxBeam,
      ticks,
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
          Terrain Profile & Take-off Angle
        </h2>
        {clearance && !loading && (
          <span className="font-mono text-[11px] text-muted-foreground">
            {profile ? `${profile.totalKm.toFixed(0)} km` : ""} · HOME{" "}
            <span className="text-primary">
              {clearance.homeTakeoffDeg.toFixed(1)}°
            </span>{" "}
            · DX{" "}
            <span className="text-chart-5">{clearance.dxTakeoffDeg.toFixed(1)}°</span>
          </span>
        )}
      </div>

      {/* Explanatory note: scatter uses a sky reflection point, not direct LOS. */}
      {clearance && !loading && (
        <div className="mb-3 rounded-md border border-border bg-secondary/40 px-3 py-2.5 leading-relaxed">
          <p className="text-[11px] text-muted-foreground">
            <span className="font-semibold text-foreground">
              Aircraft scatter reflects off a point in the sky
            </span>{" "}
            — an aircraft at altitude — so hills between the stations do{" "}
            <span className="text-foreground">not</span> block the contact. What
            matters is each station clearing its own local horizon. HOME needs a
            minimum take-off angle of{" "}
            <span className="font-mono text-primary">
              {clearance.homeTakeoffDeg.toFixed(1)}°
            </span>{" "}
            (hill {clearance.homeObstructionKm.toFixed(1)} km out); DX needs{" "}
            <span className="font-mono text-chart-5">
              {clearance.dxTakeoffDeg.toFixed(1)}°
            </span>{" "}
            (hill {clearance.dxObstructionKm.toFixed(1)} km out).
          </p>
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
            aria-label="Terrain elevation profile with per-station take-off angles"
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

            {/* Direct A-to-B path — faint reference (not the scatter path) */}
            <path
              d={geom.losPath}
              fill="none"
              stroke="var(--muted-foreground)"
              strokeWidth={1}
              strokeDasharray="4 4"
              opacity={0.4}
            />

            {/* Take-off beams from each station up over their local hill */}
            <path
              d={geom.homeBeam}
              fill="none"
              stroke="var(--primary)"
              strokeWidth={2}
            />
            <path
              d={geom.dxBeam}
              fill="none"
              stroke="var(--chart-5)"
              strokeWidth={2}
            />

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
              <span className="inline-block h-0 w-4 border-t-2 border-primary" />
              HOME take-off
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block h-0 w-4 border-t-2"
                style={{ borderColor: "var(--chart-5)" }}
              />
              DX take-off
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
