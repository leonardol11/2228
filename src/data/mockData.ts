import {
  currentWeekIndex,
  weeklyGameCatalog,
  type WeeklyHistoricalGame,
} from "./weeklyGames"

/** @deprecated Use WeeklyHistoricalGame from ./weeklyGames */
export type WeeklyPosition = WeeklyHistoricalGame

export const weeklyPositions = weeklyGameCatalog

export { currentWeekIndex }

export type LeaderboardEntry = {
  rank: number
  name: string
  rating: number
}

export const leaderboard: LeaderboardEntry[] = []
