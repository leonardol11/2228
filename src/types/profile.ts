export type SkillLevel = "beginner" | "casual" | "advanced"

export type Profile = {
  id: string
  first_name: string
  last_name: string
  username: string
  rating: number
  rating_deviation: number
  skill_level: SkillLevel
  avatar_url: string | null
  created_at: string
}

export type SignUpProfile = {
  firstName: string
  lastName: string
  username: string
  skillLevel: SkillLevel
}

export type GameResult = "win" | "loss" | "draw"

export type Game = {
  id: string
  user_id: string
  opponent_name: string
  result: GameResult
  rating_change: number
  played_at: string
  position_title: string | null
  position_date: string | null
}

export const SKILL_LEVELS: {
  id: SkillLevel
  label: string
  description: string
  rating: number
}[] = [
  {
    id: "beginner",
    label: "Beginner",
    description: "Just learning the game",
    rating: 400,
  },
  {
    id: "casual",
    label: "Casual",
    description: "Know the rules, play for fun",
    rating: 1200,
  },
  {
    id: "advanced",
    label: "Advanced",
    description: "Strong tactics and strategy",
    rating: 1600,
  },
]

export function ratingForSkillLevel(skillLevel: SkillLevel) {
  return SKILL_LEVELS.find((level) => level.id === skillLevel)?.rating ?? 1200
}

export function ratingDeviationForSkillLevel(skillLevel: SkillLevel) {
  if (skillLevel === "beginner") return 450
  if (skillLevel === "advanced") return 250
  return 350
}

export function playerRatingSnapshot(
  profile: Pick<Profile, "rating" | "rating_deviation" | "skill_level"> | null,
): { rating: number; deviation: number } {
  const skillLevel = profile?.skill_level ?? "casual"
  return {
    rating: profile?.rating ?? 1200,
    deviation:
      profile?.rating_deviation ?? ratingDeviationForSkillLevel(skillLevel),
  }
}

export function skillLevelLabel(skillLevel: SkillLevel) {
  return SKILL_LEVELS.find((level) => level.id === skillLevel)?.label ?? "Casual"
}

const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,20}$/

export function normalizeUsername(username: string) {
  return username.trim().toLowerCase()
}

export function validateUsername(username: string): string | null {
  const trimmed = username.trim()
  if (trimmed.length < 3) {
    return "Username must be at least 3 characters."
  }
  if (trimmed.length > 20) {
    return "Username must be 20 characters or fewer."
  }
  if (!USERNAME_PATTERN.test(trimmed)) {
    return "Use only letters, numbers, and underscores."
  }
  return null
}

export function displayName(profile: Pick<Profile, "first_name" | "last_name">) {
  return `${profile.first_name} ${profile.last_name}`.trim()
}

export function initials(profile: Pick<Profile, "first_name" | "last_name">) {
  const first = profile.first_name.trim()[0] ?? ""
  const last = profile.last_name.trim()[0] ?? ""
  return (first + last).toUpperCase() || "?"
}
