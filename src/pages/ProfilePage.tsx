import { useEffect, useRef, useState, type ChangeEvent } from "react"
import { useAuth } from "../context/AuthContext"
import { formatRatingDisplay } from "../lib/glicko"
import {
  displayName,
  initials,
  skillLevelLabel,
  type GameResult,
} from "../types/profile"

type ProfilePageProps = {
  onBack: () => void
}

const cardClass =
  "overflow-hidden rounded-2xl border border-white/65 bg-white/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-2xl"

function resultLabel(result: GameResult) {
  if (result === "win") return "Win"
  if (result === "loss") return "Loss"
  return "Draw"
}

function resultStyles(result: GameResult) {
  if (result === "win") return "text-emerald-700"
  if (result === "loss") return "text-red-700"
  return "text-muted"
}

function formatPlayedAt(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value))
}

function formatMemberSince(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "long",
    year: "numeric",
  }).format(new Date(value))
}

export function ProfilePage({ onBack }: ProfilePageProps) {
  const {
    user,
    profile,
    games,
    gamesLoading,
    uploadAvatar,
    deleteAccount,
    refreshProfile,
    refreshGames,
  } = useAuth()

  useEffect(() => {
    void refreshProfile()
    void refreshGames()
  }, [refreshProfile, refreshGames])

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  if (!user || !profile) {
    return (
      <div className="flex min-h-[60vh] w-full items-center justify-center">
        <div className={`${cardClass} w-full max-w-md px-8 py-12 text-center`}>
          <p className="font-display text-3xl text-ink">Profile</p>
          <p className="mt-2 text-sm text-muted">Sign in to view your account.</p>
        </div>
      </div>
    )
  }

  const wins = games.filter((game) => game.result === "win").length
  const losses = games.filter((game) => game.result === "loss").length
  const draws = games.filter((game) => game.result === "draw").length

  async function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return

    setAvatarError(null)
    setAvatarUploading(true)

    const result = await uploadAvatar(file)
    setAvatarUploading(false)

    if (result.error) {
      setAvatarError(result.error)
    }
  }

  async function handleDeleteAccount() {
    setDeleteError(null)
    setDeleting(true)

    const result = await deleteAccount()
    setDeleting(false)

    if (result.error) {
      setDeleteError(result.error)
      return
    }

    onBack()
  }

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-2xl flex-col gap-4 overflow-hidden bg-cream">
      {/* Identity */}
      <section className={`${cardClass} relative shrink-0`}>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-gold/10 to-transparent" />

        <div className="relative px-6 py-8 sm:px-8">
          <div className="flex items-center gap-5 sm:gap-6">
            <div className="relative shrink-0">
              <div className="rounded-full bg-gradient-to-b from-gold/30 to-gold/8 p-0.5 shadow-[0_8px_28px_rgba(154,123,60,0.15)]">
                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-white/80 bg-white sm:h-24 sm:w-24">
                  {profile.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="font-display text-3xl text-gold sm:text-4xl">
                      {initials(profile)}
                    </span>
                  )}
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />

              <button
                type="button"
                disabled={avatarUploading}
                onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-0.5 -right-0.5 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-white/80 bg-white text-ink/60 shadow-sm transition-all duration-300 hover:text-ink disabled:opacity-60"
                aria-label="Change profile photo"
              >
                {avatarUploading ? (
                  <span className="text-[9px]">…</span>
                ) : (
                  <svg width="13" height="13" viewBox="0 0 15 15" fill="none" aria-hidden="true">
                    <path
                      d="M10.5 2.5L12.5 4.5M2 11.5V13.5H4L11.2 6.3C11.4 6.1 11.4 5.7 11.2 5.5L9.5 3.8C9.3 3.6 8.9 3.6 8.7 3.8L2 10.5Z"
                      stroke="currentColor"
                      strokeWidth="1.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </button>
            </div>

            <div className="min-w-0 flex-1">
              <h1 className="truncate font-display text-2xl font-medium tracking-[0.02em] text-ink sm:text-3xl">
                {displayName(profile)}
              </h1>
              <p className="mt-0.5 truncate text-sm text-muted">@{profile.username}</p>
              <p className="mt-1 truncate text-xs text-muted/70">
                Member since {formatMemberSince(profile.created_at)}
              </p>
            </div>
          </div>

          {avatarError && (
            <p className="mt-4 rounded-lg border border-red-200/80 bg-red-50/80 px-3 py-2 text-xs text-red-800/90">
              {avatarError}
            </p>
          )}

          <div className="mt-7 grid grid-cols-3 divide-x divide-white/60 rounded-xl border border-white/55 bg-white/30">
            <div className="px-3 py-4 text-center sm:px-5">
              <p className="font-display text-2xl tabular-nums text-ink sm:text-3xl">
                {formatRatingDisplay(profile.rating, profile.rating_deviation)}
              </p>
              <p className="mt-1 text-[10px] font-medium tracking-[0.16em] text-muted uppercase">
                Rating
              </p>
            </div>
            <div className="px-3 py-4 text-center sm:px-5">
              <p className="font-display text-2xl tabular-nums text-ink sm:text-3xl">
                {games.length > 0 ? `${wins}–${losses}` : "—"}
              </p>
              <p className="mt-1 text-[10px] font-medium tracking-[0.16em] text-muted uppercase">
                {draws > 0 ? `${draws} draw${draws === 1 ? "" : "s"}` : "Record"}
              </p>
            </div>
            <div className="px-3 py-4 text-center sm:px-5">
              <p className="font-display text-2xl text-ink sm:text-3xl">
                {skillLevelLabel(profile.skill_level)}
              </p>
              <p className="mt-1 text-[10px] font-medium tracking-[0.16em] text-muted uppercase">
                Level
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Match history */}
      <section className={`${cardClass} flex min-h-0 flex-1 flex-col overflow-hidden`}>
        <div className="shrink-0 border-b border-white/50 px-6 py-4 sm:px-8">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-xl text-ink">Match History</h2>
            {gamesLoading && (
              <span className="text-[10px] tracking-[0.12em] text-muted uppercase">
                Loading…
              </span>
            )}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {games.length === 0 && !gamesLoading ? (
            <div className="px-6 py-14 text-center sm:px-8">
              <p className="text-sm text-muted">No games played yet.</p>
              <p className="mt-1 text-xs text-muted/70">
                Results will show up here after your first match.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-white/40">
              {games.map((game) => (
                <li
                  key={game.id}
                  className="flex items-center justify-between gap-4 px-6 py-3.5 sm:px-8"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-ink">
                      {game.position_title ? (
                        <>
                          <span className="font-medium">{game.position_title}</span>
                          <span className="text-muted">
                            {" "}
                            · {game.position_date ?? formatPlayedAt(game.played_at)} ·
                            vs {game.opponent_name}
                          </span>
                        </>
                      ) : (
                        <>
                          vs {game.opponent_name}
                          <span className="text-muted">
                            {" "}
                            · {formatPlayedAt(game.played_at)}
                          </span>
                        </>
                      )}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-4">
                    <span
                      className={`text-xs font-medium tracking-wide uppercase ${resultStyles(game.result)}`}
                    >
                      {resultLabel(game.result)}
                    </span>
                    {game.rating_change !== 0 ? (
                      <span
                        className={`w-10 text-right text-sm tabular-nums ${
                          game.rating_change > 0 ? "text-emerald-700" : "text-red-700"
                        }`}
                      >
                        {game.rating_change > 0 ? "+" : ""}
                        {game.rating_change}
                      </span>
                    ) : (
                      <span className="w-10 text-right text-sm text-muted">—</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Account */}
      <div className="shrink-0 px-1">
        {!showDeleteConfirm ? (
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="cursor-pointer text-xs text-muted/70 transition-colors duration-300 hover:text-red-700/80"
          >
            Delete account
          </button>
        ) : (
          <div className="rounded-xl border border-red-200/60 bg-red-50/40 px-5 py-4">
            <p className="text-sm text-red-900/90">
              Permanently delete your account and all game history?
            </p>
            {deleteError && (
              <p className="mt-2 text-xs text-red-800/90">{deleteError}</p>
            )}
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                disabled={deleting}
                onClick={() => {
                  setShowDeleteConfirm(false)
                  setDeleteError(null)
                }}
                className="cursor-pointer rounded-full border border-white/70 bg-white/70 px-4 py-2 text-[11px] font-medium tracking-[0.12em] text-ink/70 uppercase"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => void handleDeleteAccount()}
                className="cursor-pointer rounded-full bg-red-700 px-4 py-2 text-[11px] font-medium tracking-[0.12em] text-white uppercase disabled:opacity-60"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
