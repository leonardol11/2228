/**
 * A famous historical game featured as one week on 2228.
 *
 * `fen` is where ranked games start that week.
 * `moves` is the full move list in SAN — add as many as you like while researching.
 * When `positionAfterPly` is set, it marks which ply in `moves` produces `fen`
 * (ply 0 = before any move, ply 28 = after 14... move in a 14-move line).
 */
export type WeeklyHistoricalGame = {
  weekNumber: number
  /** When this position is live on 2228, e.g. "Jun 29 – Jul 5, 2026" */
  dateRange: string
  /** UI label, e.g. "This week's position" */
  label: string

  /** Short name for the game or moment, e.g. "The Marshall Attack" */
  title: string
  white: string
  black: string
  year: number
  /** Tournament, city, or match name */
  event: string
  /** Optional exact date, e.g. "1918-04-21" */
  playedOn?: string
  /** Optional venue or platform, e.g. "New York" or "Chess.com INT" */
  site?: string
  /** Game result from White's perspective, e.g. "1-0" */
  result?: string
  /** Optional historical ratings for the game record UI */
  whiteRating?: number
  blackRating?: number
  description: string
  toMove: "White" | "Black"

  fen: string
  moves: string[]

  /** Ply index in `moves` after which the position equals `fen`. Optional until filled in. */
  positionAfterPly?: number

  comingSoon?: boolean
}
