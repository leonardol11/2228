export type WeeklyPosition = {
  fen: string
  weekNumber: number
  dateRange: string
  label: string
  title: string
  toMove: string
  description: string
  comingSoon?: boolean
}

export const weeklyPositions: WeeklyPosition[] = [
  {
    fen: "r2q1rk1/4bppp/pnp5/1p6/3P2b1/1BP5/PP3PPP/RNBQR1K1 w - - 3 14",
    weekNumber: 1,
    dateRange: "Jun 29 – Jul 5, 2026",
    label: "This week's position",
    title: "The Marshall Attack",
    toMove: "White",
    description:
      "Capablanca vs Marshall, New York 1918. Marshall had kept this pawn sacrifice secret for years, then sprung it on the reigning world champion. Capablanca took the pawn, and the game turned into a knife fight. White has the extra material; Black has a raging attack and open lines toward the king. Neither side can relax. Every ranked game this week starts from this exact position.",
  },
  {
    fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    weekNumber: 2,
    dateRange: "Jul 6 – Jul 12, 2026",
    label: "Next week's position",
    title: "Coming Soon",
    toMove: "",
    comingSoon: true,
    description:
      "A new famous position drops when the week begins. Another historic game, another even fight, another chance to climb the board.",
  },
]

export const currentWeekIndex = weeklyPositions.findIndex((week) => !week.comingSoon)

export type LeaderboardEntry = {
  rank: number
  name: string
  rating: number
}

export const leaderboard: LeaderboardEntry[] = []
