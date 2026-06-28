/**
 * Glicko-style rating updates inspired by Lichess.
 * High rating deviation (RD) early → large swings; RD narrows as games accumulate.
 * Beating a higher-rated opponent yields more points than beating a lower-rated one.
 */

const Q = Math.log(10) / 400

export const MIN_RATING = 100
export const MAX_RATING = 3000
export const MIN_RD = 50
export const MAX_RD = 500
/** Lichess marks ratings provisional while RD stays above this threshold. */
export const PROVISIONAL_RD = 110
/** Established bot opponents use a low RD (rating is well known). */
export const BOT_OPPONENT_RD = 80

export type GlickoRating = {
  rating: number
  deviation: number
}

function g(rd: number): number {
  return 1 / Math.sqrt(1 + (3 * Q * Q * rd * rd) / (Math.PI * Math.PI))
}

function expectedScore(
  playerRating: number,
  opponentRating: number,
  opponentRd: number,
): number {
  return 1 / (1 + 10 ** ((-g(opponentRd) * (playerRating - opponentRating)) / 400))
}

export function isProvisionalRating(deviation: number): boolean {
  return deviation > PROVISIONAL_RD
}

export function formatRatingDisplay(rating: number, deviation: number): string {
  const rounded = Math.round(rating)
  return isProvisionalRating(deviation) ? `${rounded}?` : `${rounded}`
}

export function formatRatingChange(change: number): string {
  if (change > 0) return `+${change}`
  return `${change}`
}

export function scoreFromResult(result: "win" | "loss" | "draw"): number {
  if (result === "win") return 1
  if (result === "draw") return 0.5
  return 0
}

export function updateRatingAfterGame(
  player: GlickoRating,
  opponent: GlickoRating,
  score: number,
): { rating: number; deviation: number; change: number } {
  const { rating, deviation } = player
  const opponentRd = opponent.deviation
  const opponentRating = opponent.rating

  const gi = g(opponentRd)
  const expected = expectedScore(rating, opponentRating, opponentRd)

  const invD2 = Q * Q * gi * gi * expected * (1 - expected)
  const invVar = 1 / (deviation * deviation) + invD2

  const rawRating = rating + (Q / invVar) * gi * (score - expected)
  const roundedPrevious = Math.round(rating)
  const roundedRating = Math.max(
    MIN_RATING,
    Math.min(MAX_RATING, Math.round(rawRating)),
  )

  const newDeviation = Math.sqrt(1 / invVar)
  const clampedDeviation = Math.max(MIN_RD, Math.min(MAX_RD, newDeviation))

  return {
    rating: roundedRating,
    deviation: clampedDeviation,
    change: roundedRating - roundedPrevious,
  }
}
