import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import type { Session, User } from "@supabase/supabase-js"
import { supabase } from "../lib/supabase"
import {
  normalizeUsername,
  ratingDeviationForSkillLevel,
  type Game,
  type Profile,
  type SignUpProfile,
} from "../types/profile"

type AuthContextValue = {
  user: User | null
  profile: Profile | null
  session: Session | null
  loading: boolean
  games: Game[]
  gamesLoading: boolean
  signUp: (
    email: string,
    password: string,
    profile: SignUpProfile,
  ) => Promise<{ error: string | null }>
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  checkUsernameAvailable: (
    username: string,
  ) => Promise<{ available: boolean; error: string | null }>
  uploadAvatar: (file: File) => Promise<{ error: string | null }>
  deleteAccount: () => Promise<{ error: string | null }>
  refreshGames: () => Promise<void>
  refreshProfile: () => Promise<void>
  patchProfileRating: (rating: number, ratingDeviation: number) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

const CORE_PROFILE_FIELDS =
  "id, first_name, last_name, username, rating, skill_level, avatar_url, created_at"

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select(`${CORE_PROFILE_FIELDS}, rating_deviation`)
    .eq("id", userId)
    .maybeSingle()

  if (error) {
    if (error.message.includes("rating_deviation")) {
      const fallback = await supabase
        .from("profiles")
        .select(CORE_PROFILE_FIELDS)
        .eq("id", userId)
        .maybeSingle()

      if (fallback.error || !fallback.data) {
        console.error(
          "Failed to load profile:",
          fallback.error?.message ?? error.message,
        )
        return null
      }

      return {
        ...fallback.data,
        rating_deviation: ratingDeviationForSkillLevel(fallback.data.skill_level),
      }
    }

    console.error("Failed to load profile:", error.message)
    return null
  }

  if (!data) {
    return null
  }

  return {
    ...data,
    rating_deviation:
      data.rating_deviation ?? ratingDeviationForSkillLevel(data.skill_level),
  }
}

function formatAuthError(message: string) {
  if (message.includes("Invalid login credentials")) {
    return "Incorrect email or password."
  }
  if (message.includes("User already registered")) {
    return "An account with this email already exists. Try signing in."
  }
  if (message.includes("Password should be at least")) {
    return "Password must be at least 6 characters."
  }
  if (message.includes("Unable to validate email address")) {
    return "Please enter a valid email address."
  }
  if (message.includes("profiles_username_lower_idx")) {
    return "That username is already taken."
  }
  if (message.includes("username is required")) {
    return "Please choose a username."
  }
  return message
}

async function fetchGames(userId: string): Promise<Game[]> {
  const { data, error } = await supabase
    .from("games")
    .select("id, user_id, opponent_name, result, rating_change, played_at")
    .eq("user_id", userId)
    .order("played_at", { ascending: false })

  if (error) {
    console.error("Failed to load games:", error.message)
    return []
  }

  return data ?? []
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [gamesLoading, setGamesLoading] = useState(false)

  const loadProfile = useCallback(async (userId: string | undefined) => {
    if (!userId) {
      setProfile(null)
      return
    }

    const nextProfile = await fetchProfile(userId)
    setProfile(nextProfile)
  }, [])

  const refreshProfile = useCallback(async () => {
    await loadProfile(session?.user.id)
  }, [loadProfile, session?.user.id])

  const patchProfileRating = useCallback(
    (rating: number, ratingDeviation: number) => {
      setProfile((current) =>
        current ? { ...current, rating, rating_deviation: ratingDeviation } : current,
      )
    },
    [],
  )

  const refreshGames = useCallback(async () => {
    const userId = session?.user.id
    if (!userId) {
      setGames([])
      return
    }

    setGamesLoading(true)
    const nextGames = await fetchGames(userId)
    setGames(nextGames)
    setGamesLoading(false)
  }, [session?.user.id])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: current } }) => {
      setSession(current)
      void loadProfile(current?.user.id).finally(() => setLoading(false))
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      void loadProfile(nextSession?.user.id).finally(() => setLoading(false))
    })

    return () => subscription.unsubscribe()
  }, [loadProfile])

  useEffect(() => {
    if (!session?.user.id) {
      setGames([])
      return
    }

    void refreshGames()
  }, [session?.user.id, refreshGames])

  const checkUsernameAvailable = useCallback(async (username: string) => {
    const normalized = normalizeUsername(username)
    if (!normalized) {
      return { available: false, error: "Please choose a valid username." }
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", normalized)
      .maybeSingle()

    if (error) {
      console.error("Username check failed:", error.message)
      if (error.code === "PGRST205") {
        return {
          available: false,
          error: "Database not set up yet. Run supabase/migrations/001_profiles.sql in the Supabase SQL Editor.",
        }
      }
      if (error.code === "42501") {
        return {
          available: false,
          error: "Database permissions missing. Run the GRANT lines from supabase/migrations/001_profiles.sql in the Supabase SQL Editor.",
        }
      }
      return {
        available: false,
        error: "Could not check username availability. Please try again.",
      }
    }

    return { available: data === null, error: null }
  }, [])

  const signUp = useCallback(
    async (email: string, password: string, signUpProfile: SignUpProfile) => {
      const normalizedUsername = normalizeUsername(signUpProfile.username)

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: signUpProfile.firstName.trim(),
            last_name: signUpProfile.lastName.trim(),
            username: normalizedUsername,
            skill_level: signUpProfile.skillLevel,
          },
        },
      })

      if (error) {
        return { error: formatAuthError(error.message) }
      }

      if (data.session && data.user) {
        await loadProfile(data.user.id)
        return { error: null }
      }

      const { data: signInData, error: signInError } =
        await supabase.auth.signInWithPassword({ email, password })

      if (signInError) {
        return { error: formatAuthError(signInError.message) }
      }

      if (signInData.user) {
        await loadProfile(signInData.user.id)
      }

      return { error: null }
    },
    [loadProfile],
  )

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      return { error: formatAuthError(error.message) }
    }

    if (data.user) {
      await loadProfile(data.user.id)
    }

    return { error: null }
  }, [loadProfile])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setProfile(null)
    setGames([])
  }, [])

  const uploadAvatar = useCallback(
    async (file: File) => {
      const userId = session?.user.id
      if (!userId) {
        return { error: "You must be signed in to upload a photo." }
      }

      if (!file.type.startsWith("image/")) {
        return { error: "Please choose an image file." }
      }

      if (file.size > 2 * 1024 * 1024) {
        return { error: "Image must be 2 MB or smaller." }
      }

      const extension = file.name.split(".").pop()?.toLowerCase() || "jpg"
      const path = `${userId}/avatar.${extension}`

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type })

      if (uploadError) {
        console.error("Avatar upload failed:", uploadError.message)
        return { error: "Could not upload photo. Make sure avatar storage is set up in Supabase." }
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(path)

      const avatarUrl = `${publicUrl}?v=${Date.now()}`

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: avatarUrl })
        .eq("id", userId)

      if (updateError) {
        console.error("Avatar profile update failed:", updateError.message)
        return { error: "Photo uploaded but profile could not be updated." }
      }

      await loadProfile(userId)
      return { error: null }
    },
    [session?.user.id, loadProfile],
  )

  const deleteAccount = useCallback(async () => {
    const { error } = await supabase.rpc("delete_own_account")

    if (error) {
      console.error("Delete account failed:", error.message)
      return { error: "Could not delete account. Try again or contact support." }
    }

    await supabase.auth.signOut()
    setProfile(null)
    setGames([])
    return { error: null }
  }, [])

  const value = useMemo(
    () => ({
      user: session?.user ?? null,
      profile,
      session,
      loading,
      games,
      gamesLoading,
      signUp,
      signIn,
      signOut,
      checkUsernameAvailable,
      uploadAvatar,
      deleteAccount,
      refreshGames,
      refreshProfile,
      patchProfileRating,
    }),
    [
      session,
      profile,
      loading,
      games,
      gamesLoading,
      signUp,
      signIn,
      signOut,
      checkUsernameAvailable,
      uploadAvatar,
      deleteAccount,
      refreshGames,
      refreshProfile,
      patchProfileRating,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
