import { supabase } from "./supabase"
import { ratingChange, scoreFromResult } from "./elo"
import type { GameResult } from "../types/profile"

type RecordGameInput = {
  userId: string
  opponentName: string
  result: GameResult
  userRating: number
  opponentRating: number
}

export async function recordGame({
  userId,
  opponentName,
  result,
  userRating,
  opponentRating,
}: RecordGameInput): Promise<{ error: string | null; newRating: number | null }> {
  const delta = ratingChange(userRating, opponentRating, scoreFromResult(result))
  const newRating = Math.max(100, Math.min(3000, userRating + delta))

  const { error: gameError } = await supabase.from("games").insert({
    user_id: userId,
    opponent_name: opponentName,
    result,
    rating_change: delta,
  })

  if (gameError) {
    console.error("Failed to record game:", gameError.message)
    return { error: "Could not save game result.", newRating: null }
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ rating: newRating })
    .eq("id", userId)

  if (profileError) {
    console.error("Failed to update rating:", profileError.message)
    return { error: "Game saved but rating could not be updated.", newRating: null }
  }

  return { error: null, newRating }
}
