export type Profile = {
  id: string
  first_name: string
  last_name: string
  username: string
  created_at: string
}

export type SignUpProfile = {
  firstName: string
  lastName: string
  username: string
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
