import { supabase } from "./supabase"
import { ratingDeviationForSkillLevel } from "../types/profile"

export type LeaderboardPlayer = {
  id: string
  username: string
  first_name: string
  last_name: string
  rating: number
  rating_deviation: number
}

const LEADERBOARD_FIELDS =
  "id, username, first_name, last_name, rating, skill_level, rating_deviation"

export async function fetchLeaderboard(): Promise<LeaderboardPlayer[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select(LEADERBOARD_FIELDS)
    .order("rating", { ascending: false })
    .limit(100)

  if (error) {
    if (error.message.includes("rating_deviation")) {
      const fallback = await supabase
        .from("profiles")
        .select("id, username, first_name, last_name, rating, skill_level")
        .order("rating", { ascending: false })
        .limit(100)

      if (fallback.error) {
        console.error("Failed to load leaderboard:", fallback.error.message)
        return []
      }

      return (fallback.data ?? []).map((row) => ({
        id: row.id,
        username: row.username,
        first_name: row.first_name,
        last_name: row.last_name,
        rating: row.rating,
        rating_deviation: ratingDeviationForSkillLevel(row.skill_level),
      }))
    }

    console.error("Failed to load leaderboard:", error.message)
    return []
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    username: row.username,
    first_name: row.first_name,
    last_name: row.last_name,
    rating: row.rating,
    rating_deviation:
      row.rating_deviation ?? ratingDeviationForSkillLevel(row.skill_level),
  }))
}
