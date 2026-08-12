// Altitude unit handling shared across the app. Internally EVERYTHING is stored
// and computed in meters; these helpers only convert at the display/edit edge.

export type AltUnit = "m" | "ft"

export const M_TO_FT = 3.28084

/** Convert a value in meters to the chosen display unit. */
export function toDisplayAlt(meters: number, unit: AltUnit): number {
  return unit === "ft" ? meters * M_TO_FT : meters
}

/** Convert a value entered in the chosen unit back to meters (canonical). */
export function fromDisplayAlt(value: number, unit: AltUnit): number {
  return unit === "ft" ? value / M_TO_FT : value
}

/** Format a meters value as a rounded, localized string with a unit suffix. */
export function fmtAltUnit(meters: number, unit: AltUnit): string {
  const v = toDisplayAlt(meters, unit)
  return `${Math.round(v).toLocaleString("en-US")} ${unit}`
}

export function isAltUnit(v: unknown): v is AltUnit {
  return v === "m" || v === "ft"
}
