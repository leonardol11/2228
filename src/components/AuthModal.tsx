import { useEffect, useState, type FormEvent } from "react"
import { useAuth } from "../context/AuthContext"
import {
  SKILL_LEVELS,
  validateUsername,
  type SkillLevel,
} from "../types/profile"

type AuthModalProps = {
  open: boolean
  initialMode?: Mode
  onClose: () => void
}

export type Mode = "sign-in" | "sign-up"
type SignUpStep = 1 | 2 | 3

const inputClass =
  "w-full rounded-xl border border-white/60 bg-white/70 px-4 py-3 text-base text-ink placeholder:text-muted/70 shadow-[inset_0_1px_2px_rgba(28,26,23,0.04)] outline-none transition-all duration-300 focus:border-gold/50 focus:bg-white/90 focus:shadow-[0_0_0_3px_rgba(154,123,60,0.12)] sm:text-sm"

const labelClass =
  "text-[10px] font-medium tracking-[0.18em] text-muted uppercase"

export function AuthModal({ open, initialMode = "sign-in", onClose }: AuthModalProps) {
  const { signIn, signUp, checkUsernameAvailable } = useAuth()
  const [mode, setMode] = useState<Mode>("sign-in")
  const [signUpStep, setSignUpStep] = useState<SignUpStep>(1)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [skillLevel, setSkillLevel] = useState<SkillLevel>("casual")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [username, setUsername] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setMode(initialMode)
    }
  }, [open, initialMode])

  if (!open) return null

  function resetForm() {
    setEmail("")
    setPassword("")
    setSkillLevel("casual")
    setFirstName("")
    setLastName("")
    setUsername("")
    setSignUpStep(1)
    setError(null)
    setSuccess(null)
    setSubmitting(false)
  }

  function handleClose() {
    resetForm()
    setMode("sign-in")
    onClose()
  }

  function switchMode(next: Mode) {
    setMode(next)
    setSignUpStep(1)
    setError(null)
    setSuccess(null)
  }

  function handleContinueFromCredentials(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSuccess(null)

    if (!email.trim()) {
      setError("Please enter your email.")
      return
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.")
      return
    }

    setSignUpStep(2)
  }

  function handleContinueFromSkillLevel(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSignUpStep(3)
  }

  async function handleSignUp(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSuccess(null)
    setSubmitting(true)

    const trimmedFirst = firstName.trim()
    const trimmedLast = lastName.trim()

    if (!trimmedFirst) {
      setError("Please enter your first name.")
      setSubmitting(false)
      return
    }

    if (!trimmedLast) {
      setError("Please enter your last name.")
      setSubmitting(false)
      return
    }

    const usernameError = validateUsername(username)
    if (usernameError) {
      setError(usernameError)
      setSubmitting(false)
      return
    }

    const usernameCheck = await checkUsernameAvailable(username)
    if (usernameCheck.error) {
      setError(usernameCheck.error)
      setSubmitting(false)
      return
    }
    if (!usernameCheck.available) {
      setError("That username is already taken.")
      setSubmitting(false)
      return
    }

    const result = await signUp(email.trim().toLowerCase(), password, {
      firstName: trimmedFirst,
      lastName: trimmedLast,
      username,
      skillLevel,
    })

    setSubmitting(false)

    if (result.error) {
      setError(result.error)
      return
    }

    handleClose()
  }

  async function handleSignIn(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSuccess(null)
    setSubmitting(true)

    const result = await signIn(email.trim().toLowerCase(), password)
    setSubmitting(false)

    if (result.error) {
      setError(result.error)
      return
    }

    handleClose()
  }

  const title =
    mode === "sign-in"
      ? "Sign In"
      : signUpStep === 1
        ? "Create Account"
        : signUpStep === 2
          ? "Your Level"
          : "Your Profile"

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/15 p-4 backdrop-blur-md"
      onClick={handleClose}
    >
      <aside
        className="w-full max-w-sm overflow-hidden rounded-2xl border border-white/60 bg-white/50 shadow-[0_24px_80px_rgba(28,26,23,0.12),inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/50 px-6 py-5">
          <h3 className="text-[11px] font-medium tracking-[0.22em] text-gold uppercase">
            {title}
          </h3>
          <button
            type="button"
            className="cursor-pointer rounded-full px-3 py-1.5 text-[11px] font-medium tracking-[0.12em] text-muted uppercase transition-all duration-300 hover:bg-white/50 hover:text-ink"
            onClick={handleClose}
          >
            Close
          </button>
        </div>

        {mode === "sign-in" ? (
          <form className="space-y-4 px-6 py-6" onSubmit={handleSignIn}>
            <div className="space-y-1.5">
              <label htmlFor="auth-email" className={labelClass}>
                Email
              </label>
              <input
                id="auth-email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@gmail.com"
                className={inputClass}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="auth-password" className={labelClass}>
                Password
              </label>
              <input
                id="auth-password"
                type="password"
                autoComplete="current-password"
                required
                minLength={6}
                placeholder="At least 6 characters"
                className={inputClass}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && <ErrorMessage message={error} />}
            {success && <SuccessMessage message={success} />}

            <SubmitButton submitting={submitting} label="Sign In" />

            <ModeToggle mode={mode} onSwitch={switchMode} />
          </form>
        ) : signUpStep === 1 ? (
          <form className="space-y-4 px-6 py-6" onSubmit={handleContinueFromCredentials}>
            <div className="space-y-1.5">
              <label htmlFor="signup-email" className={labelClass}>
                Email
              </label>
              <input
                id="signup-email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@gmail.com"
                className={inputClass}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="signup-password" className={labelClass}>
                Password
              </label>
              <input
                id="signup-password"
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                placeholder="At least 6 characters"
                className={inputClass}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && <ErrorMessage message={error} />}

            <SubmitButton submitting={false} label="Continue" />

            <ModeToggle mode={mode} onSwitch={switchMode} />
          </form>
        ) : signUpStep === 2 ? (
          <form className="space-y-4 px-6 py-6" onSubmit={handleContinueFromSkillLevel}>
            <p className="text-xs leading-relaxed text-muted">
              Pick the level that best matches your chess experience. This sets your
              starting rating.
            </p>

            <div className="space-y-2">
              {SKILL_LEVELS.map((level) => {
                const selected = skillLevel === level.id
                return (
                  <button
                    key={level.id}
                    type="button"
                    onClick={() => setSkillLevel(level.id)}
                    className={`w-full cursor-pointer rounded-xl border px-4 py-3 text-left transition-all duration-300 ${
                      selected
                        ? "border-gold/50 bg-gold/10 shadow-[0_0_0_3px_rgba(154,123,60,0.12)]"
                        : "border-white/70 bg-white/40 hover:bg-white/65"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-ink">{level.label}</p>
                        <p className="mt-0.5 text-xs text-muted">{level.description}</p>
                      </div>
                      <span className="font-display text-xl tabular-nums text-gold">
                        {level.rating}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>

            {error && <ErrorMessage message={error} />}

            <div className="flex gap-2">
              <button
                type="button"
                className="cursor-pointer rounded-full border border-white/70 bg-white/40 px-4 py-3 text-[11px] font-medium tracking-[0.14em] text-ink/70 uppercase transition-all duration-300 hover:bg-white/70 hover:text-ink"
                onClick={() => {
                  setSignUpStep(1)
                  setError(null)
                }}
              >
                Back
              </button>
              <SubmitButton submitting={false} label="Continue" className="flex-1" />
            </div>

            <ModeToggle mode={mode} onSwitch={switchMode} />
          </form>
        ) : (
          <form className="space-y-4 px-6 py-6" onSubmit={handleSignUp}>
            <p className="text-xs leading-relaxed text-muted">
              Signed up as{" "}
              <span className="font-medium text-ink/80">{email}</span>
              {" · "}
              Starting at{" "}
              <span className="font-medium text-gold">
                {SKILL_LEVELS.find((level) => level.id === skillLevel)?.rating}
              </span>
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="signup-first-name" className={labelClass}>
                  First Name
                </label>
                <input
                  id="signup-first-name"
                  type="text"
                  autoComplete="given-name"
                  required
                  placeholder="Bobby"
                  className={inputClass}
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="signup-last-name" className={labelClass}>
                  Last Name
                </label>
                <input
                  id="signup-last-name"
                  type="text"
                  autoComplete="family-name"
                  required
                  placeholder="Fischer"
                  className={inputClass}
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="signup-username" className={labelClass}>
                Username
              </label>
              <input
                id="signup-username"
                type="text"
                autoComplete="username"
                required
                minLength={3}
                maxLength={20}
                placeholder="bobby_fischer"
                className={inputClass}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
              <p className="text-[10px] text-muted/90">
                Letters, numbers, and underscores only.
              </p>
            </div>

            {error && <ErrorMessage message={error} />}

            <div className="flex gap-2">
              <button
                type="button"
                className="cursor-pointer rounded-full border border-white/70 bg-white/40 px-4 py-3 text-[11px] font-medium tracking-[0.14em] text-ink/70 uppercase transition-all duration-300 hover:bg-white/70 hover:text-ink"
                onClick={() => {
                  setSignUpStep(2)
                  setError(null)
                }}
                disabled={submitting}
              >
                Back
              </button>
              <SubmitButton
                submitting={submitting}
                label="Sign Up"
                className="flex-1"
              />
            </div>

            <ModeToggle mode={mode} onSwitch={switchMode} />
          </form>
        )}
      </aside>
    </div>
  )
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <p className="rounded-xl border border-red-200/80 bg-red-50/80 px-3 py-2.5 text-xs leading-relaxed text-red-800/90">
      {message}
    </p>
  )
}

function SuccessMessage({ message }: { message: string }) {
  return (
    <p className="rounded-xl border border-emerald-200/80 bg-emerald-50/80 px-3 py-2.5 text-xs leading-relaxed text-emerald-800/90">
      {message}
    </p>
  )
}

function SubmitButton({
  submitting,
  label,
  className = "w-full",
}: {
  submitting: boolean
  label: string
  className?: string
}) {
  return (
    <button
      type="submit"
      disabled={submitting}
      className={`${className} cursor-pointer rounded-full bg-gradient-to-b from-[#d4b76a] via-[#b8973c] to-[#8f6f2e] px-4 py-3 text-[11px] font-medium tracking-[0.14em] text-white uppercase shadow-[0_4px_24px_rgba(154,123,60,0.38),inset_0_1px_0_rgba(255,255,255,0.35)] transition-all duration-300 hover:brightness-105 disabled:cursor-default disabled:opacity-60`}
    >
      {submitting ? "Please wait…" : label}
    </button>
  )
}

function ModeToggle({
  mode,
  onSwitch,
}: {
  mode: Mode
  onSwitch: (mode: Mode) => void
}) {
  return (
    <p className="text-center text-xs text-muted">
      {mode === "sign-in" ? (
        <>
          No account?{" "}
          <button
            type="button"
            className="cursor-pointer font-medium text-gold underline-offset-2 hover:underline"
            onClick={() => onSwitch("sign-up")}
          >
            Sign up
          </button>
        </>
      ) : (
        <>
          Already have an account?{" "}
          <button
            type="button"
            className="cursor-pointer font-medium text-gold underline-offset-2 hover:underline"
            onClick={() => onSwitch("sign-in")}
          >
            Sign in
          </button>
        </>
      )}
    </p>
  )
}
