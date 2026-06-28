import { useAuth } from "../context/AuthContext"

type HeaderProps = {
  onLeaderboard: () => void
  onStartGame: () => void
  onSignIn: () => void
}

const ghostClass =
  "cursor-pointer rounded-full px-3 py-2 text-[10px] font-medium tracking-[0.14em] text-ink/65 uppercase transition-all duration-300 hover:bg-white/60 hover:text-ink hover:shadow-[inset_0_0_0_1px_rgba(154,123,60,0.2)] sm:px-4 sm:py-2.5 sm:text-[11px]"

export function Header({ onLeaderboard, onStartGame, onSignIn }: HeaderProps) {
  const { user, profile, loading, signOut } = useAuth()

  const displayLabel =
    profile?.username ?? user?.email?.split("@")[0] ?? "Player"

  return (
    <header className="flex shrink-0 items-center justify-between px-6 py-5 md:px-10 md:py-5">
      <h1 className="font-display text-2xl font-medium tracking-[0.2em] text-ink md:text-[1.85rem]">
        2228
      </h1>

      <nav className="flex items-center gap-1 rounded-full border border-white/70 bg-white/35 p-1 shadow-[0_8px_40px_rgba(28,26,23,0.07),inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-2xl sm:gap-2 sm:p-1.5">
        <button type="button" className={ghostClass} onClick={onLeaderboard}>
          Leaderboard
        </button>

        {!loading && user ? (
          <>
            <span className="hidden max-w-[8rem] truncate px-2 text-[10px] tracking-[0.08em] text-ink/70 sm:inline sm:text-[11px]">
              {displayLabel}
            </span>
            <button
              type="button"
              className={ghostClass}
              onClick={() => void signOut()}
            >
              Sign Out
            </button>
          </>
        ) : (
          <button
            type="button"
            className={ghostClass}
            onClick={onSignIn}
            disabled={loading}
          >
            {loading ? "…" : "Sign In"}
          </button>
        )}

        <button
          type="button"
          className="cursor-pointer rounded-full bg-gradient-to-b from-[#d4b76a] via-[#b8973c] to-[#8f6f2e] px-4 py-2 text-[10px] font-medium tracking-[0.14em] text-white uppercase shadow-[0_4px_24px_rgba(154,123,60,0.38),inset_0_1px_0_rgba(255,255,255,0.35)] transition-all duration-300 hover:shadow-[0_6px_32px_rgba(154,123,60,0.5),inset_0_1px_0_rgba(255,255,255,0.45)] hover:brightness-105 sm:px-5 sm:py-2.5 sm:text-[11px]"
          onClick={onStartGame}
        >
          Start Game
        </button>
      </nav>
    </header>
  )
}
