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
  type Profile,
  type SignUpProfile,
} from "../types/profile"

type AuthContextValue = {
  user: User | null
  profile: Profile | null
  session: Session | null
  loading: boolean
  signUp: (
    email: string,
    password: string,
    profile: SignUpProfile,
  ) => Promise<{ error: string | null; needsEmailConfirmation: boolean }>
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  checkUsernameAvailable: (username: string) => Promise<boolean>
}

const AuthContext = createContext<AuthContextValue | null>(null)

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

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, username, created_at")
    .eq("id", userId)
    .maybeSingle()

  if (error) {
    console.error("Failed to load profile:", error.message)
    return null
  }

  return data
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (userId: string | undefined) => {
    if (!userId) {
      setProfile(null)
      return
    }

    const nextProfile = await fetchProfile(userId)
    setProfile(nextProfile)
  }, [])

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

  const checkUsernameAvailable = useCallback(async (username: string) => {
    const normalized = normalizeUsername(username)
    if (!normalized) return false

    const { data, error } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", normalized)
      .maybeSingle()

    if (error) {
      console.error("Username check failed:", error.message)
      return false
    }

    return data === null
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
          },
        },
      })

      if (error) {
        return { error: formatAuthError(error.message), needsEmailConfirmation: false }
      }

      if (data.session && data.user) {
        await loadProfile(data.user.id)
      }

      return {
        error: null,
        needsEmailConfirmation: data.session === null,
      }
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
  }, [])

  const value = useMemo(
    () => ({
      user: session?.user ?? null,
      profile,
      session,
      loading,
      signUp,
      signIn,
      signOut,
      checkUsernameAvailable,
    }),
    [session, profile, loading, signUp, signIn, signOut, checkUsernameAvailable],
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
