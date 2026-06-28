import type { ReactNode } from "react"
import { MoveList } from "./MoveList"

type ClockBlockProps = {
  name: string
  title: string
  rating: number
  clockMs: number
  isActive: boolean
  isUser?: boolean
}

function ClockBlock({ name, title, rating, clockMs, isActive, isUser }: ClockBlockProps) {
  const isLowTime = clockMs > 0 && clockMs <= 30_000

  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 transition-colors ${
        isActive
          ? "bg-white/60 shadow-[inset_0_0_0_1px_rgba(154,123,60,0.35)]"
          : "bg-white/35"
      }`}
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
    <div className="flex h-full min-h-0 w-full flex-col gap-2">
      <ClockBlock
        name={opponentName}
        title={opponentTitle}
        rating={opponentRating}
        clockMs={opponentClockMs}
        isActive={opponentActive}
      />

      <div className="min-h-0 flex-1">
        <MoveList moves={moves} />
      </div>

      <div className="shrink-0 rounded-xl border border-white/55 bg-white/35 p-3">
        <div className="flex items-start gap-2 text-sm text-ink/80">
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
        clockMs={userClockMs}
        isActive={userActive}
        isUser
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
