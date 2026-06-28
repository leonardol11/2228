import { useAuth } from "../context/AuthContext"

type HeaderProps = {
  onLeaderboard: () => void
  onStartGame: () => void
  onSignIn: () => void
  onProfile: () => void
  onLogo: () => void
}

const primaryClass =
  "cursor-pointer shrink-0 rounded-full bg-gradient-to-b from-[#d4b76a] via-[#b8973c] to-[#8f6f2e] px-2.5 py-1.5 text-[9px] font-medium tracking-[0.08em] text-white uppercase shadow-[0_4px_24px_rgba(154,123,60,0.38),inset_0_1px_0_rgba(255,255,255,0.35)] transition-all duration-300 hover:shadow-[0_6px_32px_rgba(154,123,60,0.5),inset_0_1px_0_rgba(255,255,255,0.45)] hover:brightness-105 sm:px-5 sm:py-2.5 sm:text-[11px] sm:tracking-[0.14em]"

const ghostClass =
  "cursor-pointer shrink-0 rounded-full px-2 py-1.5 text-[9px] font-medium tracking-[0.08em] text-ink/65 uppercase transition-all duration-300 hover:bg-white/60 hover:text-ink hover:shadow-[inset_0_0_0_1px_rgba(154,123,60,0.2)] sm:px-4 sm:py-2.5 sm:text-[11px] sm:tracking-[0.14em]"

export function Header({
  onLeaderboard,
  onStartGame,
  onSignIn,
  onProfile,
  onLogo,
}: HeaderProps) {
  const { user, loading, signOut } = useAuth()

  return (
    <header className="flex shrink-0 flex-col items-center gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between md:px-10 md:py-5">
      <button
        type="button"
        onClick={onLogo}
        className="cursor-pointer font-display text-2xl font-medium tracking-[0.2em] text-ink transition-opacity duration-300 hover:opacity-75 md:text-[1.85rem]"
      >
        2228
      </button>

      <nav className="flex max-w-full flex-nowrap items-center justify-center gap-0.5 rounded-full border border-white/70 bg-white/35 p-0.5 shadow-[0_8px_40px_rgba(28,26,23,0.07),inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-2xl sm:gap-2 sm:p-1.5">
        <button type="button" className={primaryClass} onClick={onStartGame}>
          <span className="sm:hidden">Play</span>
          <span className="hidden sm:inline">Start Game</span>
        </button>

        <button type="button" className={ghostClass} onClick={onLeaderboard}>
          <span className="sm:hidden">Ranks</span>
          <span className="hidden sm:inline">Leaderboard</span>
        </button>

        {!loading && user ? (
          <>
            <button type="button" className={ghostClass} onClick={onProfile}>
              Profile
            </button>
            <button
              type="button"
              className={ghostClass}
              onClick={() => void signOut()}
            >
              <span className="sm:hidden">Out</span>
              <span className="hidden sm:inline">Sign Out</span>
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
      </nav>
    </header>
  )
}
