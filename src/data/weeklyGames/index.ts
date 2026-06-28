export type { WeeklyHistoricalGame } from "./types"
export { weeklyGameCatalog } from "./catalog"

import { weeklyGameCatalog } from "./catalog"

export const currentWeekIndex = weeklyGameCatalog.findIndex((week) => !week.comingSoon)

export function getWeekGame(weekNumber: number) {
  return weeklyGameCatalog.find((week) => week.weekNumber === weekNumber)
}
