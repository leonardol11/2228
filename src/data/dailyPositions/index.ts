export type { DailyHistoricalGame } from "./types"
export { dailyPositionCatalog } from "./catalog"

import { dailyPositionCatalog } from "./catalog"

/** Calendar day (America/New_York) that maps to catalog index 0. */
const ROTATION_ANCHOR_UTC = Date.UTC(2026, 6, 1) // Jul 1, 2026

const MS_PER_DAY = 24 * 60 * 60 * 1000

const ROTATION_TIME_ZONE = "America/New_York"

const nyCalendarFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: ROTATION_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

/** Midnight UTC of the calendar date `date` falls on in New York (handles EST/EDT). */
function nyCalendarUtcMidnight(date: Date): number {
  const parts = nyCalendarFormatter.formatToParts(date)
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value)
  return Date.UTC(get("year"), get("month") - 1, get("day"))
}

function daysSinceAnchor(date: Date): number {
  return Math.floor((nyCalendarUtcMidnight(date) - ROTATION_ANCHOR_UTC) / MS_PER_DAY)
}

/** Which catalog entry is "today's position" for the given date (defaults to now). */
export function getDailyIndex(date: Date = new Date()): number {
  const length = dailyPositionCatalog.length
  if (length === 0) {
    return -1
  }

  return ((daysSinceAnchor(date) % length) + length) % length
}

/**
 * How many days back from `date` you can navigate before hitting the
 * rotation's launch day. Zero once `date` is on or before the anchor day.
 */
export function daysAvailableBefore(date: Date = new Date()): number {
  return Math.max(0, daysSinceAnchor(date))
}

export const currentDayIndex = getDailyIndex()
