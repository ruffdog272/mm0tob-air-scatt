"use client"

import { useEffect, useMemo } from "react"
import {
  Circle,
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"

import type { LatLon } from "@/lib/maidenhead"
import { greatCirclePoints, midpoint } from "@/lib/geo"
import type { AnalyzedAircraft, Probability } from "@/lib/scatter"

const PROB_VAR: Record<Probability, string> = {
  high: "var(--prob-high)",
  marginal: "var(--prob-marginal)",
  unlikely: "var(--prob-unlikely)",
}

/** Format a live ETA (seconds) as M:SS, matching the flight-panel format. */
function fmtEta(seconds: number | null): string {
  if (seconds == null) return "—"
  if (seconds <= 0) return "NOW"
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, "0")}`
}

function stationIcon(label: string, color: string) {
  return L.divIcon({
    className: "",
    html: `<div style="display:flex;flex-direction:column;align-items:center;transform:translateY(-4px)">
      <div style="width:14px;height:14px;border-radius:9999px;background:${color};box-shadow:0 0 0 4px ${color}33,0 0 12px ${color}"></div>
      <span style="margin-top:3px;font:600 10px/1 var(--font-mono,monospace);letter-spacing:.08em;color:${color};text-shadow:0 1px 3px #000">${label}</span>
    </div>`,
    iconSize: [40, 32],
    iconAnchor: [20, 7],
  })
}

function planeIcon(track: number, color: string) {
  return L.divIcon({
    className: "",
    html: `<div style="transform:rotate(${track}deg);color:${color};filter:drop-shadow(0 0 3px ${color})">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 2c-.6 0-1 .8-1 2v5.2L3 14v2l8-2.2V19l-2 1.3V22l3-1 3 1v-1.7L13 19v-5.2l8 2.2v-2l-8-4.8V4c0-1.2-.4-2-1-2z"/>
      </svg>
    </div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  })
}

function FitBounds({ home, dx }: { home: LatLon; dx: LatLon }) {
  const map = useMap()
  useEffect(() => {
    const bounds = L.latLngBounds([home.lat, home.lon], [dx.lat, dx.lon])
    map.fitBounds(bounds, { padding: [70, 70], maxZoom: 9 })
  }, [home.lat, home.lon, dx.lat, dx.lon, map])
  return null
}

export default function ScatterMap({
  home,
  dx,
  aircraft,
  dataTimestamp,
  now,
  onSelect,
}: {
  home: LatLon
  dx: LatLon
  aircraft: AnalyzedAircraft[]
  /** timestamp (ms) of the latest feed reception, for live ETA elapsed math */
  dataTimestamp?: number | null
  /** current clock (ms), ticked 1 Hz by the parent, drives the ETA countdown */
  now?: number
  /** open the shared detail card for the given aircraft hex */
  onSelect?: (hex: string) => void
}) {
  const path = useMemo(() => greatCirclePoints(home, dx, 96), [home, dx])
  const mid = useMemo(() => midpoint(home, dx), [home, dx])

  // Seconds elapsed since the feed snapshot, used to age each aircraft's ETA so
  // the map tooltip counts down in step with the flight panel.
  const elapsed = dataTimestamp && now ? (now - dataTimestamp) / 1000 : 0

  return (
    <MapContainer
      center={[mid.lat, mid.lon]}
      zoom={6}
      scrollWheelZoom
      className="h-full w-full"
      worldCopyJump
    >
      <TileLayer
        attribution='&copy; OpenStreetMap &copy; CARTO'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        subdomains="abcd"
      />
      <FitBounds home={home} dx={dx} />

      {/* 250 NM search ring around the path midpoint */}
      <Circle
        center={[mid.lat, mid.lon]}
        radius={250 * 1852}
        pathOptions={{
          color: "oklch(0.74 0.13 214)",
          weight: 1,
          opacity: 0.5,
          fillOpacity: 0.04,
          dashArray: "2 6",
        }}
      />

      {/* Great-circle signal path */}
      <Polyline
        positions={path}
        pathOptions={{ color: "oklch(0.74 0.13 214)", weight: 2.5, opacity: 0.9 }}
      />

      <Marker position={[home.lat, home.lon]} icon={stationIcon("HOME", "oklch(0.74 0.13 214)")} />
      <Marker position={[dx.lat, dx.lon]} icon={stationIcon("DX", "oklch(0.6 0.12 300)")} />

      {/* Predicted crossing points for aircraft whose trajectory will
          intersect the bounded path segment. */}
      {aircraft
        .filter((a) => a.crossingPoint)
        .map((a) => (
          <CircleMarker
            key={`x-${a.hex}`}
            center={[a.crossingPoint!.lat, a.crossingPoint!.lon]}
            radius={4}
            pathOptions={{
              color: PROB_VAR[a.probability],
              weight: 2,
              fillOpacity: 0.9,
            }}
          >
            <Tooltip direction="top" offset={[0, -4]} opacity={1}>
              <span className="font-mono text-xs">{a.callsign} crossing</span>
            </Tooltip>
          </CircleMarker>
        ))}

      {aircraft.map((a) => {
        const remainingEta =
          a.etaSeconds != null ? a.etaSeconds - elapsed : null
        return (
          <Marker
            key={a.hex}
            position={[a.pos.lat, a.pos.lon]}
            icon={planeIcon(a.track, PROB_VAR[a.probability])}
            eventHandlers={{ click: () => onSelect?.(a.hex) }}
          >
            <Tooltip direction="top" offset={[0, -8]} opacity={1}>
              <div className="flex flex-col gap-0.5 font-mono text-xs leading-tight">
                <span className="font-semibold">{a.callsign}</span>
                <span>{Math.round(a.altFt).toLocaleString("en-US")} ft</span>
                <span style={{ color: PROB_VAR[a.probability] }}>
                  {a.willIntersect
                    ? `ETA ${fmtEta(remainingEta)}`
                    : `${a.distToSegmentKm.toFixed(0)} km off · no cross`}
                </span>
                <span className="opacity-70">click for details</span>
              </div>
            </Tooltip>
          </Marker>
        )
      })}
    </MapContainer>
  )
}
