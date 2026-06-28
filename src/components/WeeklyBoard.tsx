import { useCallback, useEffect, useState } from "react"
import { Chessboard } from "react-chessboard"
import { currentWeekIndex, weeklyPositions } from "../data/mockData"
import {
  fenAtPly,
  replayPlyCap,
  sideToMoveAtPly,
} from "../lib/weeklyGameReplay"
import { HistoricalGameRecord } from "./HistoricalGameRecord"

const boardStyles = {
  darkSquareStyle: { backgroundColor: "#b8966e" },
  lightSquareStyle: { backgroundColor: "#f0e8dc" },
}

const notationStyles = {
  darkSquareNotationStyle: { color: "#f0e8dc" },
  lightSquareNotationStyle: { color: "#8a6d4f" },
  alphaNotationStyle: {
    fontSize: "9px",
    position: "absolute" as const,
    bottom: 1,
    right: 3,
    userSelect: "none" as const,
  },
  numericNotationStyle: {
    fontSize: "9px",
    position: "absolute" as const,
    top: 1,
    left: 2,
    userSelect: "none" as const,
  },
}

const boardSize = "min(70vmin, 580px)"

const navButtonClass =
  "flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-border bg-white/50 text-ink/50 transition-all duration-300 hover:border-border-strong hover:bg-white/80 hover:text-ink disabled:cursor-default disabled:opacity-30 disabled:hover:border-border disabled:hover:bg-white/50 disabled:hover:text-ink/50"

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  const tag = target.tagName
  return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable
}

export function WeeklyBoard() {
  const [weekIndex, setWeekIndex] = useState(
    currentWeekIndex >= 0 ? currentWeekIndex : 0,
  )
  const position = weeklyPositions[weekIndex]
  const isComingSoon = position.comingSoon === true
  const maxPly = isComingSoon ? 0 : replayPlyCap(position)

  const [currentPly, setCurrentPly] = useState(maxPly)

  const goToWeek = useCallback((index: number) => {
    const nextPosition = weeklyPositions[index]
    const nextMaxPly = nextPosition.comingSoon
      ? 0
      : replayPlyCap(nextPosition)
    setWeekIndex(index)
    setCurrentPly(nextMaxPly)
  }, [])

  const stepBackward = useCallback(() => {
    setCurrentPly((ply) => Math.max(0, ply - 1))
  }, [])

  const stepForward = useCallback(() => {
    setCurrentPly((ply) => Math.min(maxPly, ply + 1))
  }, [maxPly])

  useEffect(() => {
    if (isComingSoon) {
      return
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (isTypingTarget(event.target)) {
        return
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault()
        stepBackward()
      } else if (event.key === "ArrowRight") {
        event.preventDefault()
        stepForward()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isComingSoon, stepBackward, stepForward])

  const canGoPrev = weekIndex > 0
  const canGoNext = weekIndex < weeklyPositions.length - 1
  const boardFen = isComingSoon ? position.fen : fenAtPly(position.moves, currentPly)
  const toMoveLabel = isComingSoon
    ? position.toMove
    : sideToMoveAtPly(currentPly)

  return (
    <section className="flex w-full max-w-6xl flex-col px-4">
      <div className="-mt-2 mb-7 flex items-center justify-center gap-4 md:-mt-3 md:mb-9">
        <button
          type="button"
          className={navButtonClass}
          disabled={!canGoPrev}
          onClick={() => goToWeek(weekIndex - 1)}
          aria-label="Previous week"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M9 2L4 7L9 12"
              stroke="currentColor"
              strokeWidth="1.25"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        <p className="min-w-[12rem] text-center text-xs tracking-[0.3em] text-gold uppercase">
          Week {position.weekNumber} · {position.dateRange}
        </p>

        <button
          type="button"
          className={navButtonClass}
          disabled={!canGoNext}
          onClick={() => goToWeek(weekIndex + 1)}
          aria-label="Next week"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M5 2L10 7L5 12"
              stroke="currentColor"
              strokeWidth="1.25"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      <div className="grid w-full grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:grid-rows-[auto_minmax(0,1fr)] lg:items-stretch lg:gap-x-16 lg:gap-y-5">
        <p
          className={`text-left text-xs tracking-[0.3em] uppercase lg:col-start-1 lg:row-start-1 ${isComingSoon ? "text-gold/50" : "text-gold"}`}
        >
          {position.label}
        </p>

        <div
          className="relative mx-auto shrink-0 border border-border bg-surface p-2 shadow-[0_8px_40px_rgba(28,26,23,0.08)] lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:mx-0"
          style={{
            width: boardSize,
            height: boardSize,
          }}
        >
          <Chessboard
            key={position.weekNumber}
            options={{
              position: boardFen,
              allowDragging: false,
              showAnimations: true,
              animationDurationInMs: 120,
              boardStyle: {
                borderRadius: "0",
                width: "100%",
                height: "100%",
              },
              ...boardStyles,
              ...notationStyles,
            }}
          />
          {isComingSoon && (
            <div className="absolute inset-2 flex flex-col items-center justify-center bg-cream/72 backdrop-blur-[2px]">
              <p className="font-display text-3xl tracking-[0.08em] text-ink/45 md:text-4xl">
                Coming Soon
              </p>
              <p className="mt-2 text-[10px] tracking-[0.28em] text-gold/70 uppercase">
                Jul 6
              </p>
            </div>
          )}
        </div>

        <div className="flex h-full min-h-0 w-full max-w-md flex-col overflow-hidden text-center lg:col-start-1 lg:row-start-2 lg:max-w-lg lg:text-left">
          <h2
            className={`shrink-0 font-display text-4xl md:text-5xl ${isComingSoon ? "text-ink/35" : "text-ink"}`}
          >
            {position.title}
          </h2>
          {!isComingSoon && (
            <p className="mt-3 shrink-0 text-sm tracking-[0.12em] text-gold uppercase">
              {toMoveLabel} to move
              {currentPly < maxPly && (
                <span className="ml-2 text-muted normal-case tracking-normal">
                  · move {currentPly} of {maxPly}
                </span>
              )}
            </p>
          )}
          <p
            className={`mt-5 shrink-0 font-display text-lg leading-[1.75] font-light md:text-xl md:leading-[1.7] ${isComingSoon ? "text-muted" : "text-ink/75"}`}
          >
            {position.description}
          </p>
          {!isComingSoon && (
            <HistoricalGameRecord
              game={position}
              currentPly={currentPly}
              fillHeight
              onStepBack={stepBackward}
              onStepForward={stepForward}
              canStepBack={currentPly > 0}
              canStepForward={currentPly < maxPly}
            />
          )}
        </div>
      </div>
    </section>
  )
}
