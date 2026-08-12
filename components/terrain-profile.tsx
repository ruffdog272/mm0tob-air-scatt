"use client"

import { useMemo } from "react"
import { Mountain } from "lucide-react"

import type { ClearanceResult, TerrainProfile } from "@/lib/terrain"
import type { AnalyzedAircraft, Probability } from "@/lib/scatter"
import { type AltUnit, toDisplayAlt } from "@/lib/units"

const W = 800
const H = 300
const PAD = { top: 16, right: 16, bottom: 52, left: 52 }

// Display ceiling for the Y (altitude) axis, so a near-zero take-off angle can't
// send the common-volume apex to infinity. Comfortably above typical cruise.
const Y_CEILING_M = 13000

const PROB_COLOR: Record<Probability, string> = {
  high: "var(--prob-high)",
  marginal: "var(--prob-marginal)",
  unlikely: "var(--prob-unlikely)",
}

// Data-viz colors requested by spec: green/brown ground, pink common volume.
const TERRAIN_FILL = "#6b7250"
const TERRAIN_LINE = "#8a9166"
const PINK_FILL = "rgba(244, 114, 182, 0.16)"
const PINK_LINE = "rgba(244, 114, 182, 0.55)"

export function TerrainProfileChart({
  profile,
  clearance,
  aircraft,
  unit,
  loading,
  error,
}: {
  profile: TerrainProfile | null
  clearance: ClearanceResult | null
  aircraft: AnalyzedAircraft[]
  unit: AltUnit
  loading: boolean
  error: boolean
}) {
  const geom = useMemo(() => {
    if (!profile || !clearance) return null
    const { distances, totalKm } = profile
    const eff = clearance.effectiveTerrain
    const plotW = W - PAD.left - PAD.right
    const plotH = H - PAD.top - PAD.bottom

    const x = (km: number) => PAD.left + (totalKm > 0 ? km / totalKm : 0) * plotW

    const tanH = Math.tan((clearance.homeTakeoffDeg * Math.PI) / 180)
    const tanD = Math.tan((clearance.dxTakeoffDeg * Math.PI) / 180)

    // Take-off beam endpoints (heights where each beam grazes its worst hill).
    const homeBeamEnd =
      clearance.homeAsl + tanH * clearance.homeObstructionKm * 1000
    const dxBeamEnd = clearance.dxAsl + tanD * clearance.dxObstructionKm * 1000

    // --- Common-volume triangle apex (where the two take-off beams meet) ---
    // Solve homeAsl + tanH*x*1000 = dxAsl + tanD*(totalKm - x)*1000 for x (km).
    let apexKm = totalKm / 2
    let apexM = Y_CEILING_M
    const denom = 1000 * (tanH + tanD)
    if (denom > 1e-6) {
      apexKm =
        (clearance.dxAsl - clearance.homeAsl + tanD * totalKm * 1000) / denom
      apexM = clearance.homeAsl + tanH * apexKm * 1000
    }
    if (!Number.isFinite(apexKm) || apexKm < 0 || apexKm > totalKm) {
      apexKm = totalKm / 2
    }
    if (!Number.isFinite(apexM) || apexM <= 0) apexM = Y_CEILING_M

    const maxAcAltM = aircraft.reduce((m, a) => Math.max(m, a.altM), 0)

    // Y range: terrain up to the scatter zone. The funnel opens ABOVE the apex,
    // so the ceiling must sit well above the crossover — otherwise the apex is
    // pinned to the top and the funnel collapses to a sliver. Give the apex
    // ~60% headroom, keep a sensible floor near typical cruise altitude so the
    // view is stable with or without live aircraft, and cap for readability.
    const yMin = Math.min(0, ...eff, clearance.homeAsl, clearance.dxAsl)
    const yTop = Math.max(
      apexM * 1.6, // headroom so the funnel visibly opens above the crossover
      maxAcAltM * 1.12, // keep the highest plane on-scale
      homeBeamEnd * 1.2,
      dxBeamEnd * 1.2,
      12_000, // floor: typical airliner cruise, stable empty-feed view
    )
    const yMax = Math.min(Y_CEILING_M, yTop) || Y_CEILING_M

    const y = (m: number) =>
      PAD.top + plotH - ((m - yMin) / (yMax - yMin || 1)) * plotH

    // Effective-terrain area (filled to baseline) + outline.
    const effTop = eff.map((e, i) => `${x(distances[i])},${y(e)}`)
    const areaPath =
      `M ${x(0)},${y(yMin)} ` +
      effTop.map((p) => `L ${p}`).join(" ") +
      ` L ${x(totalKm)},${y(yMin)} Z`
    const terrainLine = `M ${effTop.map((p) => `L ${p}`).join(" ").slice(2)}`

    // Where each take-off beam, continued UPWARD past the apex, reaches the top
    // of the chart. The HOME beam climbs to the right; the DX beam climbs to the
    // left. (Off-plot values are trimmed by the clip path.)
    const homeTopKm =
      tanH > 1e-6 ? (yMax - clearance.homeAsl) / (tanH * 1000) : totalKm * 20
    const dxTopKm =
      tanD > 1e-6
        ? totalKm - (yMax - clearance.dxAsl) / (tanD * 1000)
        : -totalKm * 20

    // Common-volume OPEN FUNNEL: shade the sky ABOVE the beam crossover. Point
    // at the apex, widening upward to the chart ceiling between the two beams.
    const trianglePath =
      `M ${x(apexKm)},${y(apexM)} ` +
      `L ${x(homeTopKm)},${y(yMax)} ` +
      `L ${x(dxTopKm)},${y(yMax)} Z`

    // Take-off beam rays drawn full-length: from each antenna up over its local
    // hill, through the apex, and on to the top of the chart (funnel edges).
    const homeBeam = `M ${x(0)},${y(clearance.homeAsl)} L ${x(homeTopKm)},${y(yMax)}`
    const dxBeam = `M ${x(totalKm)},${y(clearance.dxAsl)} L ${x(dxTopKm)},${y(yMax)}`

    // Plotted aircraft: X = along-track distance from HOME, Y = altitude ASL.
    const planes = aircraft.map((a) => ({
      hex: a.hex,
      callsign: a.callsign,
      cx: x(a.alongTrackKm),
      cy: y(Math.min(a.altM, yMax)),
      clipped: a.altM > yMax,
      color: PROB_COLOR[a.probability],
      rot: a.headingDeg,
    }))

    // Y ticks (altitude).
    const yTicks = Array.from({ length: 5 }, (_, i) => {
      const v = yMin + ((yMax - yMin) * i) / 4
      return { v, y: y(v) }
    })
    // X ticks (distance from HOME).
    const xTicks = Array.from({ length: 5 }, (_, i) => {
      const km = (totalKm * i) / 4
      return { km, x: x(km) }
    })

    return {
      areaPath,
      terrainLine,
      trianglePath,
      homeBeam,
      dxBeam,
      planes,
      yTicks,
      xTicks,
      apex: { x: x(apexKm), y: y(apexM), km: apexKm, m: apexM },
      homeXY: { x: x(0), y: y(clearance.homeAsl) },
      dxXY: { x: x(totalKm), y: y(clearance.dxAsl) },
      totalKm,
      plotY0: PAD.top,
      plotYH: plotH,
    }
  }, [profile, clearance, aircraft])
  // Note: `unit` only affects tick/axis LABELS, not the geometry, so it is not
  // a memo dependency — the pixel layout is identical in meters or feet.

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <Mountain className="h-4 w-4 text-primary" />
          Terrain Profile & Common Volume
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
            — so hills between the stations do{" "}
            <span className="text-foreground">not</span> block the contact. Each
            station beams up over its own local horizon; where the two beams
            overlap is the{" "}
            <span style={{ color: PINK_LINE }} className="font-semibold">
              common volume
            </span>{" "}
            scatter zone. HOME take-off{" "}
            <span className="font-mono text-primary">
              {clearance.homeTakeoffDeg.toFixed(1)}°
            </span>
            , DX take-off{" "}
            <span className="font-mono text-chart-5">
              {clearance.dxTakeoffDeg.toFixed(1)}°
            </span>
            .
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
            aria-label="Terrain elevation profile with common-volume scatter zone and live aircraft"
          >
            <defs>
              <clipPath id="plotClip">
                <rect
                  x={PAD.left}
                  y={geom.plotY0}
                  width={W - PAD.left - PAD.right}
                  height={geom.plotYH}
                />
              </clipPath>
            </defs>

            {/* Grid + Y ticks (altitude, m) */}
            {geom.yTicks.map((t, i) => (
              <g key={`y${i}`}>
                <line
                  x1={PAD.left}
                  x2={W - PAD.right}
                  y1={t.y}
                  y2={t.y}
                  stroke="var(--border)"
                  strokeWidth={1}
                  opacity={0.4}
                />
                <text
                  x={PAD.left - 6}
                  y={t.y + 3}
                  textAnchor="end"
                  className="fill-muted-foreground font-mono"
                  fontSize={9}
                >
                  {Math.round(toDisplayAlt(t.v, unit)).toLocaleString("en-US")}
                </text>
              </g>
            ))}

            {/* X ticks (distance from HOME, km) */}
            {geom.xTicks.map((t, i) => (
              <g key={`x${i}`}>
                <line
                  x1={t.x}
                  x2={t.x}
                  y1={geom.plotY0}
                  y2={geom.plotY0 + geom.plotYH}
                  stroke="var(--border)"
                  strokeWidth={1}
                  opacity={0.25}
                />
                <text
                  x={t.x}
                  y={geom.plotY0 + geom.plotYH + 14}
                  textAnchor="middle"
                  className="fill-muted-foreground font-mono"
                  fontSize={9}
                >
                  {Math.round(t.km)}
                </text>
              </g>
            ))}

            <g clipPath="url(#plotClip)">
              {/* Common-volume triangle (pink) */}
              <path d={geom.trianglePath} fill={PINK_FILL} stroke="none" />
              <path
                d={geom.homeBeam}
                fill="none"
                stroke={PINK_LINE}
                strokeWidth={1.5}
              />
              <path
                d={geom.dxBeam}
                fill="none"
                stroke={PINK_LINE}
                strokeWidth={1.5}
              />

              {/* Effective terrain (curvature-corrected) fill + outline */}
              <path d={geom.areaPath} fill={TERRAIN_FILL} opacity={0.92} />
              <path
                d={geom.terrainLine}
                fill="none"
                stroke={TERRAIN_LINE}
                strokeWidth={1.5}
              />

              {/* Live aircraft plotted at (along-track distance, altitude) */}
              {geom.planes.map((p) => (
                <g key={p.hex} transform={`translate(${p.cx}, ${p.cy})`}>
                  <circle r={5} fill={p.color} fillOpacity={0.25} />
                  <g transform={`rotate(${p.rot})`}>
                    <path
                      d="M 0,-4 L 3,4 L 0,2 L -3,4 Z"
                      fill={p.color}
                      stroke="var(--card)"
                      strokeWidth={0.5}
                    />
                  </g>
                </g>
              ))}
            </g>

            {/* Antenna endpoints */}
            <circle cx={geom.homeXY.x} cy={geom.homeXY.y} r={4} fill="var(--primary)" />
            <circle cx={geom.dxXY.x} cy={geom.dxXY.y} r={4} fill="var(--chart-5)" />

            {/* Station labels on X axis */}
            <text
              x={PAD.left}
              y={geom.plotY0 + geom.plotYH + 14}
              textAnchor="start"
              className="fill-primary font-mono"
              fontSize={9}
            >
              0 · HOME
            </text>
            <text
              x={W - PAD.right}
              y={geom.plotY0 + geom.plotYH + 14}
              textAnchor="end"
              className="fill-chart-5 font-mono"
              fontSize={9}
            >
              {Math.round(geom.totalKm)} · DX
            </text>

            {/* Axis titles */}
            <text
              x={(PAD.left + W - PAD.right) / 2}
              y={H - 6}
              textAnchor="middle"
              className="fill-foreground font-mono"
              fontSize={10}
            >
              Distance between Stations (km)
            </text>
            <text
              x={14}
              y={PAD.top + geom.plotYH / 2}
              textAnchor="middle"
              className="fill-foreground font-mono"
              fontSize={10}
              transform={`rotate(-90, 14, ${PAD.top + geom.plotYH / 2})`}
            >
              Altitude ({unit})
            </text>
          </svg>

          {/* Legend */}
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 font-mono text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block h-2 w-3 rounded-sm"
                style={{ background: TERRAIN_FILL, outline: `1px solid ${TERRAIN_LINE}` }}
              />
              Ground terrain
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block h-2 w-3 rounded-sm"
                style={{ background: PINK_FILL, outline: `1px solid ${PINK_LINE}` }}
              />
              Common volume (mutual visibility)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-primary" />
              HOME / DX antenna
            </span>
            <span className="flex items-center gap-1.5">
              <svg width="12" height="12" viewBox="-6 -6 12 12" aria-hidden>
                <path d="M 0,-4 L 3,4 L 0,2 L -3,4 Z" fill="var(--prob-high)" />
              </svg>
              Live aircraft (by probability)
            </span>
            {geom.apex.m >= Y_CEILING_M && (
              <span className="text-muted-foreground/70">
                (apex clipped at{" "}
                {Math.round(toDisplayAlt(Y_CEILING_M, unit)).toLocaleString("en-US")}{" "}
                {unit})
              </span>
            )}
          </div>
        </>
      )}
    </section>
  )
}
