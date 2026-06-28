const K_FACTOR = 32

export function expectedScore(playerRating: number, opponentRating: number): number {
  return 1 / (1 + 10 ** ((opponentRating - playerRating) / 400))
}

export function ratingChange(
  playerRating: number,
  opponentRating: number,
  score: number,
): number {
  const delta = K_FACTOR * (score - expectedScore(playerRating, opponentRating))
  return Math.round(delta)
}

export function scoreFromResult(result: "win" | "loss" | "draw"): number {
  if (result === "win") return 1
  if (result === "draw") return 0.5
  return 0
}
