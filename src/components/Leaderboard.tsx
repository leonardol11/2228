import { leaderboard } from "../data/mockData"

type LeaderboardProps = {
  open: boolean
  onClose: () => void
}

export function Leaderboard({ open, onClose }: LeaderboardProps) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/15 p-4 backdrop-blur-md"
      onClick={onClose}
    >
      <aside
        className="w-full max-w-sm overflow-hidden rounded-2xl border border-white/60 bg-white/50 shadow-[0_24px_80px_rgba(28,26,23,0.12),inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/50 px-6 py-5">
          <h3 className="text-[11px] font-medium tracking-[0.22em] text-gold uppercase">
            Leaderboard
          </h3>
          <button
            type="button"
            className="cursor-pointer rounded-full px-3 py-1.5 text-[11px] font-medium tracking-[0.12em] text-muted uppercase transition-all duration-300 hover:bg-white/50 hover:text-ink"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        {leaderboard.length === 0 ? (
          <div className="px-6 py-14 text-center text-[11px] tracking-[0.18em] text-muted/80 uppercase">
            No players yet
          </div>
        ) : (
          <ol className="overflow-y-auto px-6">
            {leaderboard.map((entry) => (
              <li
                key={entry.rank}
                className="flex items-center justify-between border-b border-white/40 py-3.5 last:border-b-0"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-5 text-center font-display text-lg ${
                      entry.rank <= 3 ? "text-gold" : "text-muted"
                    }`}
                  >
                    {entry.rank}
                  </span>
                  <span className="text-sm text-ink">{entry.name}</span>
                </div>
                <span className="text-xs tabular-nums text-muted">
                  {entry.rating}
                </span>
              </li>
            ))}
          </ol>
        )}
      </aside>
    </div>
  )
}
