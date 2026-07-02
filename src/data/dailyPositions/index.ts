export type { DailyHistoricalGame } from "./types"
export { dailyPositionCatalog } from "./catalog"

import { dailyPositionCatalog } from "./catalog"

/** Calendar day (UTC) that maps to catalog index 0. */
const ROTATION_ANCHOR_UTC = Date.UTC(2026, 6, 1) // Jul 1, 2026

const MS_PER_DAY = 24 * 60 * 60 * 1000

function daysSinceAnchor(date: Date): number {
  const todayUtc = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  )
  return Math.floor((todayUtc - ROTATION_ANCHOR_UTC) / MS_PER_DAY)
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
