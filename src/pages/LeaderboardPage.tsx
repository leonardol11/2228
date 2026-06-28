import { useEffect } from "react"
import { useAuth } from "../context/AuthContext"
import { formatRatingDisplay } from "../lib/glicko"

export function LeaderboardPage() {
  const { user, leaderboard, leaderboardLoaded, refreshLeaderboard } = useAuth()

  useEffect(() => {
    void refreshLeaderboard()
  }, [refreshLeaderboard])

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-2xl flex-col overflow-hidden px-1">
      <header className="shrink-0 pb-4">
        <p className="text-[10px] tracking-[0.28em] text-gold uppercase">Rankings</p>
        <h1 className="mt-1 font-display text-3xl text-ink">Leaderboard</h1>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {leaderboardLoaded && leaderboard.length === 0 ? (
          <p className="py-8 text-sm text-muted">No players yet.</p>
        ) : leaderboard.length > 0 ? (
          <ol className="divide-y divide-white/40 border-t border-white/40">
            {leaderboard.map((player, index) => {
              const rank = index + 1
              const isCurrentUser = user?.id === player.id

              return (
                <li
                  key={player.id}
                  className={`flex items-center justify-between gap-4 py-3.5 ${
                    isCurrentUser ? "bg-gold/8 -mx-2 rounded-lg px-2" : ""
                  }`}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span
                      className={`w-6 shrink-0 text-center font-display text-lg tabular-nums ${
                        rank <= 3 ? "text-gold" : "text-muted"
                      }`}
                    >
                      {rank}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">
                        @{player.username}
                        {isCurrentUser && (
                          <span className="ml-1.5 text-[10px] font-normal tracking-[0.12em] text-gold uppercase">
                            You
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 font-display text-lg tabular-nums text-ink">
                    {formatRatingDisplay(player.rating, player.rating_deviation)}
                  </span>
                </li>
              )
            })}
          </ol>
        ) : null}
      </div>
    </div>
  )
}
