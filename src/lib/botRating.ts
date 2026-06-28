export const STOCKFISH_MIN_ELO = 1320
export const BOT_RATING_OFFSET = 100

export type BlunderParams = {
  pickFromTop: number
  blunderChance: number
  depth: number
  multiPv: number
}

type RatingTier = {
  min: number
  title: string
  botName: string
}

const RATING_TIERS: RatingTier[] = [
  { min: 0, title: "Novice", botName: "Jamie Chen" },
  { min: 400, title: "Beginner", botName: "Chris Rivera" },
  { min: 800, title: "Intermediate", botName: "Taylor Brooks" },
  { min: 1000, title: "Club Player", botName: "Jordan Hayes" },
  { min: 1200, title: "Strong Club", botName: "Elena Vasquez" },
  { min: 1400, title: "Expert", botName: "Marcus Webb" },
  { min: 1600, title: "Master", botName: "Sofia Laurent" },
  { min: 1800, title: "International Master", botName: "David Okonkwo" },
  { min: 2000, title: "Grandmaster", botName: "Anna Berg" },
]

export function ratingTierFor(rating: number): RatingTier {
  let tier = RATING_TIERS[0]
  for (const candidate of RATING_TIERS) {
    if (rating >= candidate.min) {
      tier = candidate
    }
  }
  return tier
}

export function ratingTitle(rating: number): string {
  return ratingTierFor(rating).title
}

export function botNameForRating(rating: number): string {
  return ratingTierFor(rating).botName
}

export function botRatingForUser(userRating: number): number {
  return Math.min(3000, Math.max(100, userRating + BOT_RATING_OFFSET))
}

export function blunderParamsForRating(targetRating: number): BlunderParams | null {
  if (targetRating >= STOCKFISH_MIN_ELO) {
    return null
  }

  if (targetRating < 600) {
    return { pickFromTop: 5, blunderChance: 0.35, depth: 5, multiPv: 5 }
  }

  if (targetRating < 900) {
    return { pickFromTop: 4, blunderChance: 0.22, depth: 6, multiPv: 4 }
  }

  if (targetRating < 1100) {
    return { pickFromTop: 3, blunderChance: 0.15, depth: 7, multiPv: 3 }
  }

  return { pickFromTop: 3, blunderChance: 0.08, depth: 8, multiPv: 3 }
}

export function botAcceptsDraw(moveCount: number): boolean {
  if (moveCount < 4) {
    return false
  }

  const acceptChance = moveCount > 24 ? 0.6 : moveCount > 12 ? 0.4 : 0.25
  return Math.random() < acceptChance
}
