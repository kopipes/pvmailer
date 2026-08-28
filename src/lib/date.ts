import { format } from 'date-fns'

const TZ_OFFSET_MS = 7 * 60 * 60 * 1000 // UTC+7 WIB

/**
 * Parse a SQLite datetime string (YYYY-MM-DD HH:MM:SS, stored as UTC)
 * and return a Date object representing that moment in WIB (UTC+7).
 *
 * SQLite's datetime('now') stores UTC without a 'Z' suffix.
 * Appending 'Z' tells the JS engine it's UTC, then we shift to WIB.
 */
export function parseDbDate(str: string | null | undefined): Date {
  if (!str) return new Date(0)
  // Normalise: if already has Z or +, parse as-is; otherwise treat as UTC
  const iso = /Z|[+-]\d{2}:?\d{2}$/.test(str) ? str : str.replace(' ', 'T') + 'Z'
  const utc = new Date(iso)
  // Shift to WIB for display (date-fns format uses local time, we bake offset in)
  return new Date(utc.getTime() + TZ_OFFSET_MS)
}

/** Format a SQLite timestamp as date only — WIB */
export function fmtDate(str: string | null | undefined): string {
  if (!str) return '—'
  return format(parseDbDate(str), 'd MMM yyyy')
}

/** Format a SQLite timestamp as date + time — WIB */
export function fmtDateTime(str: string | null | undefined): string {
  if (!str) return '—'
  return format(parseDbDate(str), 'd MMM HH:mm')
}

/** Format a SQLite timestamp as date + time with seconds — WIB */
export function fmtDateTimeSec(str: string | null | undefined): string {
  if (!str) return '—'
  return format(parseDbDate(str), 'd MMM HH:mm:ss')
}

/** Format today's date in WIB for display */
export function fmtToday(fmt: string): string {
  const now = new Date()
  const wib = new Date(now.getTime() + TZ_OFFSET_MS)
  return format(wib, fmt)
}
