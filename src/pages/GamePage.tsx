import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Chessboard } from "react-chessboard"
import { Chess, type Color } from "chess.js"
import { GameChat } from "../components/GameChat"
import { GameSidebar } from "../components/GameSidebar"
import { useAuth } from "../context/AuthContext"
import {
  botAcceptsDraw,
  botNameForRating,
  botRatingForUser,
  ratingTitle,
} from "../lib/botRating"
import {
  boardStyles,
  notationStyles,
} from "../lib/chessBoardStyles"
import { CLOCK_LABEL, useChessClock } from "../lib/chessClock"
import {
  BOT_OPPONENT_RD,
  formatRatingChange,
  isProvisionalRating,
  scoreFromResult,
  updateRatingAfterGame,
} from "../lib/glicko"
import { recordGame } from "../lib/recordGame"
import { getStockfishEngine } from "../lib/stockfishEngine"
import {
  currentDayIndex,
  dailyPositionCatalog,
} from "../data/dailyPositions"
import { playerRatingSnapshot, type GameResult } from "../types/profile"

type GamePageProps = {
  onExit: () => void
  onSignIn: () => void
}

type GamePhase = "loading" | "playing" | "game_over"

type GameOutcome = {
  result: GameResult
  reason: string
}

const ghostButtonClass =
  "cursor-pointer rounded-full border border-white/70 bg-white/50 px-4 py-2 text-[10px] font-medium tracking-[0.14em] text-ink/70 uppercase transition-all duration-300 hover:bg-white/80 hover:text-ink sm:px-5 sm:py-2.5 sm:text-[11px]"

function randomUserColor(): Color {
  return Math.random() < 0.5 ? "w" : "b"
}

function resultFromChess(chess: Chess, userColor: Color): GameOutcome {
  if (chess.isCheckmate()) {
    const winner = chess.turn() === "w" ? "b" : "w"
    return {
      result: winner === userColor ? "win" : "loss",
      reason: winner === userColor ? "Checkmate" : "Checkmated",
    }
  }

  if (chess.isStalemate()) {
    return { result: "draw", reason: "Stalemate" }
  }

  if (chess.isThreefoldRepetition()) {
    return { result: "draw", reason: "Threefold repetition" }
  }

  if (chess.isInsufficientMaterial()) {
    return { result: "draw", reason: "Insufficient material" }
  }

  return { result: "draw", reason: "Draw" }
}

function applyUciMove(chess: Chess, uci: string): boolean {
  const from = uci.slice(0, 2)
  const to = uci.slice(2, 4)
  const promotion = uci.length > 4 ? uci[4] : undefined

  try {
    const move = chess.move({ from, to, promotion })
    return move !== null
  } catch {
    return false
  }
}

export function GamePage({ onExit, onSignIn }: GamePageProps) {
  const { user, profile, refreshGames, refreshProfile, refreshLeaderboard, patchProfileRating, loading: authLoading } = useAuth()
  const position = dailyPositionCatalog[currentDayIndex >= 0 ? currentDayIndex : 0]
  const [userColor, setUserColor] = useState<Color>(randomUserColor)
  const userColorRef = useRef(userColor)
  const botColorRef = useRef<Color>(userColor === "w" ? "b" : "w")
  const botColor: Color = userColor === "w" ? "b" : "w"
  const userRating = profile?.rating ?? 1200
  const botRating = botRatingForUser(userRating)
  const botName = botNameForRating(botRating)
  const userName = profile?.username ?? "You"
  const userTitle = ratingTitle(userRating)
  const botTitle = ratingTitle(botRating)
  const userColorLabel = userColor === "w" ? "white" : "black"

  const chessRef = useRef(new Chess(position.fen))
  const [fen, setFen] = useState(position.fen)
  const [moves, setMoves] = useState<string[]>([])
  const [phase, setPhase] = useState<GamePhase>("loading")
  const [botThinking, setBotThinking] = useState(false)
  const [controlMessage, setControlMessage] = useState<string | null>(null)
  const [engineError, setEngineError] = useState<string | null>(null)
  const [outcome, setOutcome] = useState<GameOutcome | null>(null)
  const [ratingResult, setRatingResult] = useState<{
    previousRating: number
    newRating: number
    ratingChange: number
    isProvisional: boolean
  } | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [showGameOverCard, setShowGameOverCard] = useState(true)
  const gameRecordedRef = useRef(false)
  const drawTimeoutRef = useRef<number | null>(null)

  const assignUserColor = useCallback((color: Color) => {
    userColorRef.current = color
    botColorRef.current = color === "w" ? "b" : "w"
    setUserColor(color)
  }, [])

  const boardOrientation = (userColor === "w" ? "white" : "black") as "white" | "black"
  const activeColor = phase === "playing" ? chessRef.current.turn() : null

  const finishGame = useCallback(
    async (nextOutcome: GameOutcome) => {
      setOutcome(nextOutcome)
      setPhase("game_over")
      setShowGameOverCard(true)
      setControlMessage(null)

      if (drawTimeoutRef.current !== null) {
        window.clearTimeout(drawTimeoutRef.current)
        drawTimeoutRef.current = null
      }

      if (!user || gameRecordedRef.current) {
        return
      }

      const player = playerRatingSnapshot(profile)

      const preview = updateRatingAfterGame(
        player,
        { rating: botRating, deviation: BOT_OPPONENT_RD },
        scoreFromResult(nextOutcome.result),
      )

      setRatingResult({
        previousRating: player.rating,
        newRating: preview.rating,
        ratingChange: preview.change,
        isProvisional: isProvisionalRating(preview.deviation),
      })

      gameRecordedRef.current = true
      setSaving(true)

      const result = await recordGame({
        userId: user.id,
        opponentName: botName,
        result: nextOutcome.result,
        userRating: player.rating,
        userRatingDeviation: player.deviation,
        opponentRating: botRating,
        positionTitle: position.title,
        positionDate: new Date().toISOString().slice(0, 10),
      })

      setSaving(false)

      if (result.error) {
        setSaveError(result.error)
        gameRecordedRef.current = false
        return
      }

      if (
        result.newRating !== null &&
        result.ratingChange !== null &&
        result.previousRating !== null
      ) {
        setRatingResult({
          previousRating: result.previousRating,
          newRating: result.newRating,
          ratingChange: result.ratingChange,
          isProvisional: result.isProvisional,
        })
      }

      if (result.newRating !== null && result.newRatingDeviation !== null) {
        patchProfileRating(result.newRating, result.newRatingDeviation)
      }

      await refreshGames()
      await refreshProfile()
      void refreshLeaderboard()
    },
    [botName, botRating, patchProfileRating, position.title, profile, refreshGames, refreshLeaderboard, refreshProfile, user],
  )

  const handleFlag = useCallback(
    (flaggedColor: Color) => {
      if (phase === "game_over") {
        return
      }

      void finishGame({
        result: flaggedColor === userColor ? "loss" : "win",
        reason: "Time forfeit",
      })
    },
    [finishGame, phase, userColor],
  )

  const { times, applyMove, revertMove, reset: resetClock } = useChessClock({
    activeColor,
    running: phase === "playing",
    onFlag: handleFlag,
  })

  const syncMoves = useCallback(() => {
    setMoves(chessRef.current.history())
  }, [])

  const requestBotMove = useCallback(async () => {
    const chess = chessRef.current
    const activeBotColor = botColorRef.current
    const activeUserColor = userColorRef.current

    if (chess.isGameOver() || chess.turn() !== activeBotColor) {
      return
    }

    setBotThinking(true)

    try {
      const engine = getStockfishEngine()
      const uci = await engine.getBotMove({
        fen: chess.fen(),
        targetRating: botRating,
      })

      if (!applyUciMove(chess, uci)) {
        throw new Error("Bot played an illegal move.")
      }

      applyMove(activeBotColor)
      setFen(chess.fen())
      syncMoves()

      if (chess.isGameOver()) {
        setBotThinking(false)
        await finishGame(resultFromChess(chess, activeUserColor))
        return
      }

      setBotThinking(false)
    } catch (error) {
      console.error(error)
      setEngineError("The bot could not find a move. Try refreshing.")
      setBotThinking(false)
    }
  }, [applyMove, botRating, finishGame, syncMoves])

  const requestBotMoveRef = useRef(requestBotMove)
  requestBotMoveRef.current = requestBotMove

  useEffect(() => {
    let cancelled = false

    void getStockfishEngine()
      .init()
      .then(() => {
        if (cancelled) return

        setEngineError(null)
        setPhase("playing")

        if (chessRef.current.turn() === botColorRef.current) {
          void requestBotMoveRef.current()
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return
        console.error(error)
        setEngineError("Could not load the chess engine.")
        setPhase("playing")
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    return () => {
      if (drawTimeoutRef.current !== null) {
        window.clearTimeout(drawTimeoutRef.current)
      }
    }
  }, [])

  const onPieceDrop = useCallback(
    ({
      sourceSquare,
      targetSquare,
    }: {
      sourceSquare: string
      targetSquare: string | null
    }) => {
      if (phase !== "playing" || botThinking || !targetSquare) {
        return false
      }

      const chess = chessRef.current
      if (chess.turn() !== userColor) {
        return false
      }

      try {
        const move = chess.move({
          from: sourceSquare,
          to: targetSquare,
          promotion: "q",
        })

        if (!move) {
          return false
        }

        setControlMessage(
          chessRef.current.turn() === userColor ? "Your move" : `${botName} is thinking…`,
        )
        applyMove(userColor)
        setFen(chess.fen())
        syncMoves()

        if (chess.isGameOver()) {
          void finishGame(resultFromChess(chess, userColor))
          return true
        }

        void requestBotMove()
        return true
      } catch {
        return false
      }
    },
    [applyMove, botThinking, botName, finishGame, phase, requestBotMove, syncMoves, userColor],
  )

  const canDragPiece = useCallback(
    ({ piece }: { piece: { pieceType: string } }) => {
      if (phase !== "playing" || botThinking) {
        return false
      }

      const pieceColor = piece.pieceType[0]
      return pieceColor === userColor && chessRef.current.turn() === userColor
    },
    [botThinking, phase, userColor],
  )

  const chessboardOptions = useMemo(
    () => ({
      position: fen,
      boardOrientation,
      allowDragging: phase === "playing",
      showAnimations: true,
      animationDurationInMs: 200,
      canDragPiece,
      onPieceDrop,
      boardStyle: {
        borderRadius: "0",
        width: "100%",
        height: "100%",
      },
      ...boardStyles,
      ...notationStyles,
    }),
    [boardOrientation, canDragPiece, fen, onPieceDrop, phase],
  )

  function handleResign() {
    if (phase === "game_over") {
      return
    }

    void finishGame({ result: "loss", reason: "Resignation" })
  }

  function handleOfferDraw() {
    if (phase !== "playing" || botThinking || moves.length < 4) {
      return
    }

    setControlMessage(`${botName} is considering your draw offer…`)

    drawTimeoutRef.current = window.setTimeout(() => {
      drawTimeoutRef.current = null

      if (botAcceptsDraw(moves.length)) {
        void finishGame({ result: "draw", reason: "Draw by agreement" })
        return
      }

      setControlMessage(`${botName} declined the draw`)
      window.setTimeout(() => setControlMessage(null), 2500)
    }, 900)
  }

  function handleTakeBack() {
    if (phase !== "playing" || botThinking) {
      return
    }

    const chess = chessRef.current
    if (chess.turn() !== userColor || chess.history().length < 2) {
      return
    }

    chess.undo()
    chess.undo()
    revertMove(botColor)
    revertMove(userColor)
    setFen(chess.fen())
    syncMoves()
    setControlMessage("Move taken back")
    window.setTimeout(() => setControlMessage(null), 2000)
  }

  function resetGame() {
    const nextUserColor = randomUserColor()
    const nextBotColor = nextUserColor === "w" ? "b" : "w"

    assignUserColor(nextUserColor)
    chessRef.current = new Chess(position.fen)
    setFen(position.fen)
    setMoves([])
    setOutcome(null)
    setRatingResult(null)
    setSaveError(null)
    setShowGameOverCard(true)
    setBotThinking(false)
    setControlMessage(null)
    gameRecordedRef.current = false
    resetClock()
    setPhase("loading")

    void getStockfishEngine()
      .init()
      .then(() => {
        setPhase("playing")
        if (chessRef.current.turn() === nextBotColor) {
          void requestBotMove()
        }
      })
  }

  const opponentClockMs = times[botColor]
  const userClockMs = times[userColor]
  const isOpponentTurn = activeColor === botColor
  const isUserTurn = activeColor === userColor
  const controlsDisabled = phase !== "playing" || botThinking
  const canOfferDraw = moves.length >= 4
  const canTakeBack =
    moves.length >= 2 && chessRef.current.turn() === userColor

  const gameOverRating = useMemo(() => {
    if (ratingResult) {
      return ratingResult
    }

    if (!user || phase !== "game_over" || !outcome) {
      return null
    }

    const player = playerRatingSnapshot(profile)
    const preview = updateRatingAfterGame(
      player,
      { rating: botRating, deviation: BOT_OPPONENT_RD },
      scoreFromResult(outcome.result),
    )

    return {
      previousRating: player.rating,
      newRating: preview.rating,
      ratingChange: preview.change,
      isProvisional: isProvisionalRating(preview.deviation),
    }
  }, [botRating, outcome, phase, profile, ratingResult, user])

  const statusMessage =
    controlMessage ??
    (phase === "game_over" && gameOverRating
      ? `${gameOverRating.newRating}${gameOverRating.isProvisional ? "?" : ""} (${formatRatingChange(gameOverRating.ratingChange)})`
      : botThinking && phase === "playing"
        ? `${botName} is thinking…`
        : phase === "playing" && isUserTurn
          ? "Your move"
          : null)

  if (!authLoading && !user) {
    return (
      <section className="flex w-full max-w-lg flex-col items-center px-4 text-center">
        <p className="font-display text-3xl text-ink md:text-4xl">Start a ranked game</p>
        <p className="mt-3 max-w-sm text-sm leading-relaxed text-ink/75">
          Sign in to play a rated game and track your progress.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button type="button" className={ghostButtonClass} onClick={onSignIn}>
            Sign In
          </button>
          <button type="button" className={ghostButtonClass} onClick={onExit}>
            Back
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="flex h-full w-full min-h-0 flex-col">
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto lg:grid-cols-[1fr_auto_1fr] lg:items-center lg:overflow-hidden">
        <aside className="hidden h-[min(calc(100dvh-7rem),820px)] min-h-0 min-w-0 flex-col lg:flex">
          <GameChat
            botName={botName}
            userName={userName}
            clockLabel={CLOCK_LABEL}
            signedIn={Boolean(user)}
            onSignIn={onSignIn}
            gameOver={phase === "game_over"}
          />
        </aside>

        <div className="flex min-h-0 min-w-0 shrink-0 items-center justify-center justify-self-center pt-10 lg:shrink lg:pt-0">
          <div className="relative aspect-square h-[min(calc(100vw-2.5rem),calc(100dvh-16rem))] w-[min(calc(100vw-2.5rem),calc(100dvh-16rem))] shrink-0 md:h-[min(calc(100vw-5rem),calc(100dvh-30rem),820px)] md:w-[min(calc(100vw-5rem),calc(100dvh-30rem),820px)] lg:h-[min(calc(100dvh-7rem),820px)] lg:w-[min(calc(100dvh-7rem),820px)]">
            <div className="absolute inset-0 border border-border bg-surface p-1 shadow-[0_8px_40px_rgba(28,26,23,0.08)]">
              <Chessboard options={chessboardOptions} />
            </div>

            {phase === "loading" && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-cream/55 backdrop-blur-[1px]">
                <p className="text-[10px] tracking-[0.28em] text-gold uppercase">
                  Loading engine
                </p>
              </div>
            )}

            {phase === "game_over" && outcome && showGameOverCard && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-cream/75 p-4 backdrop-blur-[3px]">
                <div className="relative mx-auto flex w-[22rem] max-w-full flex-col items-center overflow-hidden rounded-2xl border border-white/70 bg-white/55 px-7 py-3 text-center shadow-[0_20px_70px_rgba(28,26,23,0.14),inset_0_1px_0_rgba(255,255,255,0.95)] backdrop-blur-2xl">
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-gold/14 to-transparent" />

                  <button
                    type="button"
                    onClick={() => setShowGameOverCard(false)}
                    aria-label="Close"
                    className="absolute right-2.5 top-2.5 z-10 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full text-ink/35 transition-colors duration-200 hover:bg-white/70 hover:text-ink/65"
                  >
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 10 10"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d="M1.5 1.5L8.5 8.5M8.5 1.5L1.5 8.5"
                        stroke="currentColor"
                        strokeWidth="1.15"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>

                  <p
                    className={`relative w-full font-display text-xl tracking-[0.04em] ${
                      outcome.result === "win"
                        ? "text-emerald-700"
                        : outcome.result === "loss"
                          ? "text-red-700"
                          : "text-ink"
                    }`}
                  >
                    {outcome.result === "win"
                      ? "Victory"
                      : outcome.result === "loss"
                        ? "Defeated"
                        : "Draw"}
                  </p>

                  {gameOverRating && (
                    <p className="relative mt-1.5 font-display text-2xl tabular-nums tracking-tight text-ink">
                      {gameOverRating.newRating}
                      {gameOverRating.isProvisional && (
                        <span className="text-gold/80">?</span>
                      )}
                      <span
                        className={`ml-1.5 text-lg ${
                          gameOverRating.ratingChange > 0
                            ? "text-emerald-700"
                            : gameOverRating.ratingChange < 0
                              ? "text-red-700"
                              : "text-muted"
                        }`}
                      >
                        ({formatRatingChange(gameOverRating.ratingChange)})
                      </span>
                    </p>
                  )}

                  {saving && (
                    <p className="relative mt-2 text-[10px] tracking-[0.22em] text-muted uppercase">
                      Saving
                    </p>
                  )}
                  {saveError && (
                    <p className="relative mt-2 text-[11px] leading-relaxed text-red-800/80">
                      {saveError}
                    </p>
                  )}

                  <button
                    type="button"
                    className={`${ghostButtonClass} relative mt-3 w-full`}
                    onClick={resetGame}
                  >
                    Play Again
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <aside className="flex w-full min-h-0 min-w-0 shrink-0 flex-col pb-2 lg:h-[min(calc(100dvh-7rem),820px)] lg:pb-0">
          <GameSidebar
            opponentName={botName}
            opponentTitle={botTitle}
            opponentRating={botRating}
            opponentClockMs={opponentClockMs}
            opponentActive={isOpponentTurn && phase === "playing"}
            userName={userName}
            userTitle={userTitle}
            userRating={gameOverRating?.newRating ?? userRating}
            userRatingChange={gameOverRating?.ratingChange ?? null}
            userClockMs={userClockMs}
            userActive={isUserTurn && phase === "playing"}
            userColorLabel={userColorLabel}
            moves={moves}
            statusMessage={statusMessage}
            phase={phase}
            controlsDisabled={controlsDisabled}
            canOfferDraw={canOfferDraw}
            canTakeBack={canTakeBack}
            onOfferDraw={handleOfferDraw}
            onTakeBack={handleTakeBack}
            onResign={handleResign}
          />
        </aside>
      </div>

      {engineError && (
        <p className="mt-2 shrink-0 rounded-lg border border-red-200/80 bg-red-50/80 px-3 py-2 text-center text-xs text-red-800/90">
          {engineError}
        </p>
      )}
    </section>
  )
}
