import type { ReactNode } from "react"
import { MoveList } from "./MoveList"

type ClockBlockProps = {
  name: string
  title: string
  rating: number
  ratingChange?: number | null
  clockMs: number
  isActive: boolean
  isUser?: boolean
  className?: string
}

function ClockBlock({
  name,
  title,
  rating,
  ratingChange = null,
  clockMs,
  isActive,
  isUser,
  className = "",
}: ClockBlockProps) {
  const isLowTime = clockMs > 0 && clockMs <= 30_000
  const showRatingChange = ratingChange !== null

  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 transition-colors ${
        isActive
          ? "bg-white/60 shadow-[inset_0_0_0_1px_rgba(154,123,60,0.35)]"
          : "bg-white/35"
      } ${className}`}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${
            isUser ? "bg-emerald-500" : "bg-ink/25"
          }`}
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">{name}</p>
          <p className="truncate text-[11px] text-muted">
            {title} · {rating}
            {showRatingChange && (
              <span
                className={
                  ratingChange > 0
                    ? "text-emerald-700"
                    : ratingChange < 0
                      ? "text-red-700"
                      : "text-muted"
                }
              >
                {" "}
                {ratingChange > 0 ? "+" : ""}
                {ratingChange}
              </span>
            )}
          </p>
        </div>
      </div>
      <p
        className={`shrink-0 font-mono text-2xl font-medium tabular-nums leading-none ${
          isLowTime ? "text-red-700" : "text-ink"
        }`}
      >
        {formatClockDisplay(clockMs)}
      </p>
    </div>
  )
}

function formatClockDisplay(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, "0")}`
}

type GameSidebarProps = {
  opponentName: string
  opponentTitle: string
  opponentRating: number
  opponentClockMs: number
  opponentActive: boolean
  userName: string
  userTitle: string
  userRating: number
  userRatingChange?: number | null
  userClockMs: number
  userActive: boolean
  userColorLabel: string
  moves: string[]
  statusMessage: string | null
  phase: "loading" | "playing" | "game_over"
  controlsDisabled: boolean
  canOfferDraw: boolean
  canTakeBack: boolean
  onOfferDraw: () => void
  onTakeBack: () => void
  onResign: () => void
}

export function GameSidebar({
  opponentName,
  opponentTitle,
  opponentRating,
  opponentClockMs,
  opponentActive,
  userName,
  userTitle,
  userRating,
  userRatingChange = null,
  userClockMs,
  userActive,
  userColorLabel,
  moves,
  statusMessage,
  phase,
  controlsDisabled,
  canOfferDraw,
  canTakeBack,
  onOfferDraw,
  onTakeBack,
  onResign,
}: GameSidebarProps) {
  const defaultStatus =
    phase === "loading"
      ? "Loading engine…"
      : phase === "game_over"
        ? "Game over"
        : `You play the ${userColorLabel} pieces.`

  const displayStatus = statusMessage ?? defaultStatus

  return (
    <div className="flex w-full flex-col gap-2 lg:h-full lg:min-h-0">
      <ClockBlock
        name={opponentName}
        title={opponentTitle}
        rating={opponentRating}
        clockMs={opponentClockMs}
        isActive={opponentActive}
        className="hidden lg:flex"
      />

      <div className="hidden h-36 min-h-0 shrink-0 lg:block lg:h-auto lg:min-h-0 lg:flex-1">
        <MoveList moves={moves} />
      </div>

      <div className="shrink-0 rounded-xl border border-white/55 bg-white/35 p-3">
        <div className="mb-3 flex items-center justify-between gap-3 lg:hidden">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink">{opponentName}</p>
            <p
              className={`font-mono text-lg tabular-nums leading-none ${
                opponentClockMs > 0 && opponentClockMs <= 30_000
                  ? "text-red-700"
                  : "text-ink"
              } ${opponentActive ? "font-medium" : "text-ink/70"}`}
            >
              {formatClockDisplay(opponentClockMs)}
            </p>
          </div>
          <div className="min-w-0 text-right">
            <p className="truncate text-sm font-medium text-ink">{userName}</p>
            <p
              className={`font-mono text-lg tabular-nums leading-none ${
                userClockMs > 0 && userClockMs <= 30_000 ? "text-red-700" : "text-ink"
              } ${userActive ? "font-medium" : "text-ink/70"}`}
            >
              {formatClockDisplay(userClockMs)}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-2 text-base text-ink/80 lg:text-sm">
          <span className="mt-0.5 shrink-0 text-muted">ⓘ</span>
          <p className="leading-snug">{displayStatus}</p>
        </div>

        <div className="mt-3 flex items-center justify-center gap-2">
          <SidebarAction
            label="Take back"
            onClick={onTakeBack}
            disabled={controlsDisabled || !canTakeBack}
          >
            ↩
          </SidebarAction>
          <SidebarAction
            label="Offer draw"
            onClick={onOfferDraw}
            disabled={controlsDisabled || !canOfferDraw}
          >
            ½
          </SidebarAction>
          <SidebarAction
            label="Resign"
            onClick={onResign}
            disabled={controlsDisabled}
            danger
          >
            ⚑
          </SidebarAction>
        </div>
      </div>

      <ClockBlock
        name={userName}
        title={userTitle}
        rating={userRating}
        ratingChange={phase === "game_over" ? userRatingChange : null}
        clockMs={userClockMs}
        isActive={userActive}
        isUser
        className="hidden lg:flex"
      />
    </div>
  )
}

function SidebarAction({
  children,
  label,
  onClick,
  disabled,
  danger,
}: {
  children: ReactNode
  label: string
  onClick: () => void
  disabled?: boolean
  danger?: boolean
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={`flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border text-lg transition-all duration-200 disabled:cursor-default disabled:opacity-35 ${
        danger
          ? "border-red-200/70 bg-red-50/50 text-red-800/80 hover:bg-red-50"
          : "border-white/60 bg-white/45 text-ink/75 hover:bg-white/70 hover:text-ink"
      }`}
    >
      {children}
    </button>
  )
}
