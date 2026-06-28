import { supabase } from "./supabase"
import {
  BOT_OPPONENT_RD,
  isProvisionalRating,
  scoreFromResult,
  updateRatingAfterGame,
} from "./glicko"
import type { GameResult } from "../types/profile"

type RecordGameInput = {
  userId: string
  opponentName: string
  result: GameResult
  userRating: number
  userRatingDeviation: number
  opponentRating: number
  positionTitle: string
  positionDate: string
}

export type RecordGameResult = {
  error: string | null
  previousRating: number | null
  newRating: number | null
  ratingChange: number | null
  newRatingDeviation: number | null
  isProvisional: boolean
}

function formatRecordGameError(message: string): string {
  if (message.includes("games") && message.includes("does not exist")) {
    return "Database not set up. Run supabase/migrations/005_rating_persistence_fix.sql in Supabase."
  }
  if (message.includes("permission denied") || message.includes("42501")) {
    return "Database permissions missing. Run supabase/migrations/005_rating_persistence_fix.sql in Supabase."
  }
  if (message.includes("rating_deviation")) {
    return "Database needs an update. Run supabase/migrations/005_rating_persistence_fix.sql in Supabase."
  }
  return "Could not save game result."
}

function formatProfileUpdateError(message: string): string {
  if (message.includes("permission denied") || message.includes("42501")) {
    return "Rating could not be saved. Run supabase/migrations/005_rating_persistence_fix.sql in Supabase."
  }
  if (message.includes("rating_deviation")) {
    return "Rating saved partially. Run supabase/migrations/005_rating_persistence_fix.sql in Supabase."
  }
  return "Game saved but rating could not be updated."
}

export async function recordGame({
  userId,
  opponentName,
  result,
  userRating,
  userRatingDeviation,
  opponentRating,
  positionTitle,
  positionDate,
}: RecordGameInput): Promise<RecordGameResult> {
  const { rating: newRating, deviation: newRatingDeviation, change } =
    updateRatingAfterGame(
      { rating: userRating, deviation: userRatingDeviation },
      { rating: opponentRating, deviation: BOT_OPPONENT_RD },
      scoreFromResult(result),
    )

  const gameRow = {
    user_id: userId,
    opponent_name: opponentName,
    result,
    rating_change: change,
    position_title: positionTitle,
    position_date: positionDate,
  }

  let { error: gameError } = await supabase.from("games").insert(gameRow)

  if (
    gameError?.message.includes("position_title") ||
    gameError?.message.includes("position_date")
  ) {
    const fallback = await supabase.from("games").insert({
      user_id: userId,
      opponent_name: opponentName,
      result,
      rating_change: change,
    })
    gameError = fallback.error
  }

  if (gameError) {
    console.error("Failed to record game:", gameError.message)
    return {
      error: formatRecordGameError(gameError.message),
      previousRating: null,
      newRating: null,
      ratingChange: null,
      newRatingDeviation: null,
      isProvisional: false,
    }
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ rating: newRating, rating_deviation: newRatingDeviation })
    .eq("id", userId)

  if (profileError?.message.includes("rating_deviation")) {
    const { error: ratingOnlyError } = await supabase
      .from("profiles")
      .update({ rating: newRating })
      .eq("id", userId)

    if (ratingOnlyError) {
      console.error("Failed to update rating:", ratingOnlyError.message)
      return {
        error: formatProfileUpdateError(ratingOnlyError.message),
        previousRating: userRating,
        newRating: null,
        ratingChange: change,
        newRatingDeviation: null,
        isProvisional: isProvisionalRating(userRatingDeviation),
      }
    }

    return {
      error: null,
      previousRating: userRating,
      newRating,
      ratingChange: change,
      newRatingDeviation,
      isProvisional: isProvisionalRating(newRatingDeviation),
    }
  }

  if (profileError) {
    console.error("Failed to update rating:", profileError.message)
    return {
      error: formatProfileUpdateError(profileError.message),
      previousRating: userRating,
      newRating: null,
      ratingChange: change,
      newRatingDeviation: null,
      isProvisional: isProvisionalRating(userRatingDeviation),
    }
  }

  return {
    error: null,
    previousRating: userRating,
    newRating,
    ratingChange: change,
    newRatingDeviation,
    isProvisional: isProvisionalRating(newRatingDeviation),
  }
}
