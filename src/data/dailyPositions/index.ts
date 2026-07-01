export type { DailyHistoricalGame } from "./types"
export { dailyPositionCatalog } from "./catalog"

import { dailyPositionCatalog } from "./catalog"

/** Calendar day (UTC) that maps to catalog index 0. */
const ROTATION_ANCHOR_UTC = Date.UTC(2026, 5, 29) // Jun 29, 2026

const MS_PER_DAY = 24 * 60 * 60 * 1000

/** Which catalog entry is "today's position" for the given date (defaults to now). */
export function getDailyIndex(date: Date = new Date()): number {
  const length = dailyPositionCatalog.length
  if (length === 0) {
    return -1
  }

  const todayUtc = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  )
  const daysSinceAnchor = Math.floor(
    (todayUtc - ROTATION_ANCHOR_UTC) / MS_PER_DAY,
  )

  return ((daysSinceAnchor % length) + length) % length
}

export const currentDayIndex = getDailyIndex()
