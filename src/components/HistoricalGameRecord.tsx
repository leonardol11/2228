import type { WeeklyHistoricalGame } from "../data/weeklyGames"
import { movesUpToKeyPosition } from "../lib/weeklyGameReplay"

type HistoricalGameRecordProps = {
  game: WeeklyHistoricalGame
  currentPly: number
  fillHeight?: boolean
  onStepBack: () => void
  onStepForward: () => void
  canStepBack: boolean
  canStepForward: boolean
}

const stepButtonClass =
  "flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border border-border bg-white/50 text-ink/50 transition-all duration-300 hover:border-border-strong hover:bg-white/80 hover:text-ink disabled:cursor-default disabled:opacity-30 disabled:hover:border-border disabled:hover:bg-white/50 disabled:hover:text-ink/50"

function formatPlayedDate(game: WeeklyHistoricalGame): string | null {
  if (game.playedOn) {
    const [year, month, day] = game.playedOn.split("-")
    if (year && month && day) {
      return `${day}.${month}.${year}`
    }
    return game.playedOn
  }

  if (game.year > 0) {
    return String(game.year)
  }

  return null
}

function movePairs(moves: string[]): { number: number; white: string; black?: string }[] {
  const pairs: { number: number; white: string; black?: string }[] = []

  for (let i = 0; i < moves.length; i += 2) {
    pairs.push({
      number: Math.floor(i / 2) + 1,
      white: moves[i],
      black: moves[i + 1],
    })
  }

  return pairs
}

function isWhiteHighlighted(pairNumber: number, currentPly: number): boolean {
  return currentPly === (pairNumber - 1) * 2 + 1
}

function isBlackHighlighted(pairNumber: number, currentPly: number): boolean {
  return currentPly === (pairNumber - 1) * 2 + 2
}

export function HistoricalGameRecord({
  game,
  currentPly,
  fillHeight = false,
  onStepBack,
  onStepForward,
  canStepBack,
  canStepForward,
}: HistoricalGameRecordProps) {
  if (game.comingSoon || game.moves.length === 0) {
    return null
  }

  const visibleMoves = movesUpToKeyPosition(game)
  const pairs = movePairs(visibleMoves)
  const playedDate = formatPlayedDate(game)
  const metaLine = [game.event, game.site, playedDate].filter(Boolean).join(" · ")

  return (
    <div
      className={`mt-5 w-full max-w-md rounded-lg border border-border bg-surface-raised/80 px-3 py-2.5 shadow-[0_2px_12px_rgba(28,26,23,0.04)] lg:max-w-lg ${
        fillHeight ? "flex min-h-0 flex-1 flex-col" : ""
      }`}
    >
      <div className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-start gap-2 border-b border-border/70 pb-2">
        <div className="min-w-0 text-left">
          <p className="truncate text-sm font-medium text-ink">{game.white}</p>
          {game.whiteRating !== undefined && (
            <p className="text-[10px] text-muted">{game.whiteRating}</p>
          )}
        </div>

        <div className="text-center">
          {game.result && (
            <p className="font-display text-lg leading-none text-ink">{game.result}</p>
          )}
          {metaLine && (
            <p className="mt-1 max-w-[9rem] text-[9px] leading-snug tracking-[0.04em] text-muted">
              {metaLine}
            </p>
          )}
        </div>

        <div className="min-w-0 text-right">
          <p className="truncate text-sm font-medium text-ink">{game.black}</p>
          {game.blackRating !== undefined && (
            <p className="text-[10px] text-muted">{game.blackRating}</p>
          )}
        </div>
      </div>

      <div
        className={`mt-2 font-mono text-[11px] leading-relaxed text-ink/80 ${
          fillHeight ? "min-h-0 flex-1 overflow-y-auto" : ""
        }`}
      >
        {pairs.map((pair) => (
          <span key={pair.number} className="mr-1.5 inline">
            <span className="text-muted">{pair.number}.</span>{" "}
            <span
              className={
                isWhiteHighlighted(pair.number, currentPly)
                  ? "rounded bg-gold/20 px-0.5 text-ink"
                  : undefined
              }
            >
              {pair.white}
            </span>
            {pair.black && (
              <>
                {" "}
                <span
                  className={
                    isBlackHighlighted(pair.number, currentPly)
                      ? "rounded bg-gold/20 px-0.5 text-ink"
                      : undefined
                  }
                >
                  {pair.black}
                </span>
              </>
            )}
          </span>
        ))}
      </div>

      <div
        className={`mt-2 grid shrink-0 grid-cols-3 items-center text-[9px] tracking-[0.12em] text-muted uppercase ${
          fillHeight ? "mt-auto pt-2" : ""
        }`}
      >
        <div className="flex justify-start">
          <button
            type="button"
            className={stepButtonClass}
            disabled={!canStepBack}
            onClick={onStepBack}
            aria-label="Previous move"
          >
            ←
          </button>
        </div>
        <span className="text-center">step through moves</span>
        <div className="flex justify-end">
          <button
            type="button"
            className={stepButtonClass}
            disabled={!canStepForward}
            onClick={onStepForward}
            aria-label="Next move"
          >
            →
          </button>
        </div>
      </div>
    </div>
  )
}
