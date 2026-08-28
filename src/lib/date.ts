import { format } from 'date-fns'

/**
 * Parse a SQLite datetime string (YYYY-MM-DD HH:MM:SS, stored as UTC).
 * Appends 'Z' so JS engine treats it as UTC, then date-fns format()
 * displays it in the system/browser local timezone automatically.
 */
export function parseDbDate(str: string | null | undefined): Date {
  if (!str) return new Date(0)
  // If already has timezone info (Z or offset), parse as-is
  const iso = /Z|[+-]\d{2}:?\d{2}$/.test(str) ? str : str.replace(' ', 'T') + 'Z'
  return new Date(iso)
}

/** Format a SQLite timestamp as date only */
export function fmtDate(str: string | null | undefined): string {
  if (!str) return '—'
  return format(parseDbDate(str), 'd MMM yyyy')
}

/** Format a SQLite timestamp as date + time */
export function fmtDateTime(str: string | null | undefined): string {
  if (!str) return '—'
  return format(parseDbDate(str), 'd MMM HH:mm')
}

/** Format a SQLite timestamp as date + time with seconds */
export function fmtDateTimeSec(str: string | null | undefined): string {
  if (!str) return '—'
  return format(parseDbDate(str), 'd MMM HH:mm:ss')
}

/** Format today's date using system local time */
export function fmtToday(fmt: string): string {
  return format(new Date(), fmt)
}
