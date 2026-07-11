import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Chessboard } from "react-chessboard"
import { Chess, type Color } from "chess.js"
import { GameChat, type RemoteChat } from "../components/GameChat"
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
import {
  CLOCK_INCREMENT_MS,
  CLOCK_INITIAL_MS,
  CLOCK_LABEL,
  useChessClock,
} from "../lib/chessClock"
import {
  BOT_OPPONENT_RD,
  formatRatingChange,
  isProvisionalRating,
  scoreFromResult,
  updateRatingAfterGame,
} from "../lib/glicko"
import {
  claimTimeout,
  fetchActiveGameFor,
  fetchLiveGame,
  finishLiveGame,
  leaveMatchmaking,
  openGameChannel,
  parseMoves,
  pollMatchmaking,
  sendLiveMove,
  subscribeToLiveGame,
  subscribeToMatch,
  type GameChannel,
  type GameChannelEvent,
  type LiveGameRow,
} from "../lib/multiplayer"
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

type GamePhase = "matchmaking" | "loading" | "playing" | "game_over"

type GameOutcome = {
  result: GameResult
  reason: string
}

type Opponent =
  | { kind: "bot" }
  | {
      kind: "human"
      gameId: string
      id: string
      name: string
      rating: number
      deviation: number
    }

const ghostButtonClass =
  "cursor-pointer rounded-full border border-white/70 bg-white/50 px-4 py-2 text-[10px] font-medium tracking-[0.14em] text-ink/70 uppercase transition-all duration-300 hover:bg-white/80 hover:text-ink sm:px-5 sm:py-2.5 sm:text-[11px]"

// Guests get a taste of the board before we ask them to sign in.
const ANONYMOUS_MOVE_LIMIT = 4

const MATCHMAKING_POLL_MS = 4000
const MATCHMAKING_TIMEOUT_MS = 60_000
const MATCH_BANNER_MS = 1400

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

function winnerForOutcome(outcome: GameOutcome, userColor: Color): Color | null {
  if (outcome.result === "draw") return null
  const opponentColor: Color = userColor === "w" ? "b" : "w"
  return outcome.result === "win" ? userColor : opponentColor
}

function outcomeFromRow(row: LiveGameRow, userColor: Color): GameOutcome {
  if (row.winner === null) {
    return { result: "draw", reason: row.end_reason ?? "Draw" }
  }
  return {
    result: row.winner === userColor ? "win" : "loss",
    reason: row.end_reason ?? "Game over",
  }
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

function formatSearchTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return `${minutes}:${rest.toString().padStart(2, "0")}`
}

export function GamePage({ onExit, onSignIn }: GamePageProps) {
  const {
    user,
    profile,
    games,
    gamesLoading,
    refreshGames,
    refreshProfile,
    refreshLeaderboard,
    patchProfileRating,
    loading: authLoading,
  } = useAuth()
  const position = dailyPositionCatalog[currentDayIndex >= 0 ? currentDayIndex : 0]
  const todayStr = new Date().toISOString().slice(0, 10)
  const alreadyPlayedToday = games.some((game) => game.position_date === todayStr)
  const [userColor, setUserColor] = useState<Color>(randomUserColor)
  const userColorRef = useRef(userColor)
  const botColorRef = useRef<Color>(userColor === "w" ? "b" : "w")
  const botColor: Color = userColor === "w" ? "b" : "w"
  const userRating = profile?.rating ?? 1200
  const botRating = botRatingForUser(userRating)
  const botName = botNameForRating(botRating)
  const userName = profile?.username ?? "You"
  const userTitle = ratingTitle(userRating)
  const userColorLabel = userColor === "w" ? "white" : "black"

  const chessRef = useRef(new Chess(position.fen))
  const [fen, setFen] = useState(position.fen)
  const [moves, setMoves] = useState<string[]>([])
  const [phase, setPhase] = useState<GamePhase>("loading")
  const phaseRef = useRef(phase)
  phaseRef.current = phase
  const [opponent, setOpponent] = useState<Opponent | null>(null)
  const opponentRef = useRef<Opponent | null>(null)
  const [engineReady, setEngineReady] = useState(false)
  const [botThinking, setBotThinking] = useState(false)
  const [controlMessage, setControlMessage] = useState<string | null>(null)
  const [engineError, setEngineError] = useState<string | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [outcome, setOutcome] = useState<GameOutcome | null>(null)
  const [searchSeconds, setSearchSeconds] = useState(0)
  const [matchBanner, setMatchBanner] = useState<string | null>(null)
  const [incomingDrawOffer, setIncomingDrawOffer] = useState(false)
  const [ratingResult, setRatingResult] = useState<{
    previousRating: number
    newRating: number
    ratingChange: number
    isProvisional: boolean
  } | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [showGameOverCard, setShowGameOverCard] = useState(true)
  const [anonMoveCount, setAnonMoveCount] = useState(0)
  const gameRecordedRef = useRef(false)
  const drawTimeoutRef = useRef<number | null>(null)
  const controlMessageTimeoutRef = useRef<number | null>(null)
  const authPromptedRef = useRef(false)
  const unsubGameRef = useRef<(() => void) | null>(null)
  const gameChannelRef = useRef<GameChannel | null>(null)
  const chatListenersRef = useRef(new Set<(text: string) => void>())
  const authGateReached = !user && anonMoveCount >= ANONYMOUS_MOVE_LIMIT

  const assignUserColor = useCallback((color: Color) => {
    userColorRef.current = color
    botColorRef.current = color === "w" ? "b" : "w"
    setUserColor(color)
  }, [])

  const boardOrientation = (userColor === "w" ? "white" : "black") as "white" | "black"
  const activeColor = phase === "playing" ? chessRef.current.turn() : null

  const opponentDisplay =
    opponent?.kind === "human"
      ? {
          name: opponent.name,
          rating: opponent.rating,
          title: ratingTitle(opponent.rating),
        }
      : opponent?.kind === "bot"
        ? { name: botName, rating: botRating, title: ratingTitle(botRating) }
        : { name: "Opponent", rating: userRating, title: ratingTitle(userRating) }

  const finishGame = useCallback(
    async (nextOutcome: GameOutcome) => {
      if (phaseRef.current === "game_over") {
        return
      }

      setOutcome(nextOutcome)
      setPhase("game_over")
      setShowGameOverCard(true)
      setControlMessage(null)
      setIncomingDrawOffer(false)

      if (drawTimeoutRef.current !== null) {
        window.clearTimeout(drawTimeoutRef.current)
        drawTimeoutRef.current = null
      }

      if (!user || gameRecordedRef.current) {
        return
      }

      const currentOpponent = opponentRef.current
      const isHuman = currentOpponent?.kind === "human"
      const opponentName = isHuman ? currentOpponent.name : botName
      const opponentRating = isHuman ? currentOpponent.rating : botRating
      const opponentRd = isHuman ? currentOpponent.deviation : BOT_OPPONENT_RD

      const player = playerRatingSnapshot(profile)

      const preview = updateRatingAfterGame(
        player,
        { rating: opponentRating, deviation: opponentRd },
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
        opponentName,
        result: nextOutcome.result,
        userRating: player.rating,
        userRatingDeviation: player.deviation,
        opponentRating,
        opponentRatingDeviation: opponentRd,
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

  const finishGameRef = useRef(finishGame)
  finishGameRef.current = finishGame

  const handleFlag = useCallback(
    (flaggedColor: Color) => {
      if (phaseRef.current === "game_over") {
        return
      }

      const currentOpponent = opponentRef.current
      if (currentOpponent?.kind === "human") {
        // The server double-checks the clocks before recording the timeout.
        void claimTimeout(currentOpponent.gameId)
      }

      void finishGameRef.current({
        result: flaggedColor === userColorRef.current ? "loss" : "win",
        reason: "Time forfeit",
      })
    },
    [],
  )

  const { times, applyMove, revertMove, reset: resetClock, syncTimes } = useChessClock({
    activeColor,
    running: phase === "playing",
    onFlag: handleFlag,
  })

  const syncMoves = useCallback(() => {
    setMoves(chessRef.current.history())
  }, [])

  const syncClocksFromRow = useCallback(
    (row: LiveGameRow) => {
      const lastMoveAt = new Date(row.last_move_at).getTime()
      const elapsed =
        row.status === "active" ? Math.max(0, Date.now() - lastMoveAt) : 0

      syncTimes({
        w: row.turn === "w" ? row.white_ms - elapsed : row.white_ms,
        b: row.turn === "b" ? row.black_ms - elapsed : row.black_ms,
      })
    },
    [syncTimes],
  )

  const flashControlMessage = useCallback((message: string, durationMs = 2500) => {
    setControlMessage(message)
    if (controlMessageTimeoutRef.current !== null) {
      window.clearTimeout(controlMessageTimeoutRef.current)
    }
    controlMessageTimeoutRef.current = window.setTimeout(() => {
      controlMessageTimeoutRef.current = null
      setControlMessage(null)
    }, durationMs)
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
      setControlMessage(null)

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

  // ── Live game sync ──────────────────────────────────────────────────────────

  const applyRemoteMoves = useCallback(
    (row: LiveGameRow) => {
      const chess = chessRef.current
      const uciMoves = parseMoves(row.moves)
      let applied = false

      for (let i = chess.history().length; i < uciMoves.length; i++) {
        if (!applyUciMove(chess, uciMoves[i])) {
          console.error("Received an illegal move from the server:", uciMoves[i])
          break
        }
        applied = true
      }

      if (applied) {
        setFen(chess.fen())
        syncMoves()
        setControlMessage(null)
      }

      syncClocksFromRow(row)
    },
    [syncClocksFromRow, syncMoves],
  )

  const handleLiveGameUpdate = useCallback(
    (row: LiveGameRow) => {
      if (phaseRef.current === "game_over") {
        return
      }

      applyRemoteMoves(row)

      if (row.status === "finished") {
        void finishGameRef.current(outcomeFromRow(row, userColorRef.current))
        return
      }

      const chess = chessRef.current
      if (chess.isGameOver()) {
        const nextOutcome = resultFromChess(chess, userColorRef.current)
        const currentOpponent = opponentRef.current
        if (currentOpponent?.kind === "human") {
          void finishLiveGame(
            currentOpponent.gameId,
            winnerForOutcome(nextOutcome, userColorRef.current),
            nextOutcome.reason,
          )
        }
        void finishGameRef.current(nextOutcome)
      }
    },
    [applyRemoteMoves],
  )

  const handleLiveGameUpdateRef = useRef(handleLiveGameUpdate)
  handleLiveGameUpdateRef.current = handleLiveGameUpdate

  const handleChannelEvent = useCallback(
    (event: GameChannelEvent) => {
      if (event.type === "chat") {
        chatListenersRef.current.forEach((listener) => listener(event.text))
        return
      }

      if (phaseRef.current !== "playing") {
        return
      }

      if (event.type === "draw-offer") {
        setIncomingDrawOffer(true)
        return
      }

      if (event.type === "draw-decline") {
        const name =
          opponentRef.current?.kind === "human" ? opponentRef.current.name : "Opponent"
        flashControlMessage(`${name} declined the draw`)
      }
    },
    [flashControlMessage],
  )

  const handleChannelEventRef = useRef(handleChannelEvent)
  handleChannelEventRef.current = handleChannelEvent

  // ── Engine preload (needed for guests and the 60s bot fallback) ─────────────

  useEffect(() => {
    let cancelled = false

    void getStockfishEngine()
      .init()
      .then(() => {
        if (cancelled) return
        setEngineError(null)
        setEngineReady(true)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        console.error(error)
        setEngineError("Could not load the chess engine.")
        setEngineReady(true)
      })

    return () => {
      cancelled = true
    }
  }, [])

  // Guests skip matchmaking and play the bot directly.
  useEffect(() => {
    if (authLoading || user || opponentRef.current) {
      return
    }
    opponentRef.current = { kind: "bot" }
    setOpponent({ kind: "bot" })
  }, [authLoading, user])

  // Promote a pending bot game to "playing" once the engine is up.
  useEffect(() => {
    if (phase !== "loading" || !engineReady || opponent?.kind !== "bot") {
      return
    }

    setPhase("playing")
    if (chessRef.current.turn() === botColorRef.current) {
      void requestBotMoveRef.current()
    }
  }, [engineReady, opponent, phase])

  // ── Matchmaking ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (authLoading || !user || gamesLoading || alreadyPlayedToday) {
      return
    }
    if (opponentRef.current || phaseRef.current === "game_over") {
      return
    }

    let cancelled = false
    let matched = false
    let pollInterval: number | null = null
    let secondsInterval: number | null = null
    let fallbackTimeout: number | null = null
    let bannerTimeout: number | null = null
    let unsubQueue: (() => void) | null = null

    const params = {
      startFen: position.fen,
      turn: (position.fen.split(" ")[1] === "b" ? "b" : "w") as Color,
      initialMs: CLOCK_INITIAL_MS,
      incrementMs: CLOCK_INCREMENT_MS,
      positionTitle: position.title,
      positionDate: todayStr,
    }

    const stopSearching = () => {
      if (pollInterval !== null) window.clearInterval(pollInterval)
      if (secondsInterval !== null) window.clearInterval(secondsInterval)
      if (fallbackTimeout !== null) window.clearTimeout(fallbackTimeout)
      pollInterval = null
      secondsInterval = null
      fallbackTimeout = null
      unsubQueue?.()
      unsubQueue = null
    }

    const revealOpponent = (label: string, onRevealed: () => void) => {
      setMatchBanner(label)
      bannerTimeout = window.setTimeout(() => {
        bannerTimeout = null
        if (cancelled) return
        setMatchBanner(null)
        onRevealed()
      }, MATCH_BANNER_MS)
    }

    const enterGame = async (gameId: string, knownRow?: LiveGameRow) => {
      if (matched || cancelled) return
      matched = true
      stopSearching()

      const row = knownRow ?? (await fetchLiveGame(gameId))
      if (cancelled) return

      if (!row || row.status !== "active") {
        matched = false
        startBotGame()
        return
      }

      const myColor: Color = row.white_id === user.id ? "w" : "b"
      assignUserColor(myColor)

      const chess = new Chess(row.start_fen)
      for (const uci of parseMoves(row.moves)) {
        applyUciMove(chess, uci)
      }
      chessRef.current = chess
      setFen(chess.fen())
      setMoves(chess.history())

      const nextOpponent: Opponent = {
        kind: "human",
        gameId,
        id: myColor === "w" ? row.black_id : row.white_id,
        name: myColor === "w" ? row.black_username : row.white_username,
        rating: myColor === "w" ? row.black_rating : row.white_rating,
        deviation: myColor === "w" ? row.black_rd : row.white_rd,
      }
      opponentRef.current = nextOpponent
      setOpponent(nextOpponent)

      syncClocksFromRow(row)

      unsubGameRef.current = subscribeToLiveGame(gameId, (updated) => {
        handleLiveGameUpdateRef.current(updated)
      })
      gameChannelRef.current = openGameChannel(gameId, user.id, (event) => {
        handleChannelEventRef.current(event)
      })

      revealOpponent(`${nextOpponent.name} · ${nextOpponent.rating}`, () => {
        setPhase("playing")
      })
    }

    const startBotGame = () => {
      if (matched || cancelled) return
      matched = true
      stopSearching()

      opponentRef.current = { kind: "bot" }
      setOpponent({ kind: "bot" })

      // Same reveal as a human match — the bot plays under a human name.
      revealOpponent(`${botName} · ${botRating}`, () => {
        setPhase("loading")
      })
    }

    const poll = async () => {
      const gameId = await pollMatchmaking(params)
      if (!cancelled && gameId) {
        void enterGame(gameId)
      }
    }

    const run = async () => {
      setPhase("matchmaking")
      setSearchSeconds(0)

      // Resume a game that's still running (e.g. after a refresh).
      const active = await fetchActiveGameFor(user.id)
      if (cancelled) return

      if (active) {
        void enterGame(active.id, active)
        return
      }

      unsubQueue = subscribeToMatch(user.id, (gameId) => {
        void enterGame(gameId)
      })

      void poll()
      pollInterval = window.setInterval(() => void poll(), MATCHMAKING_POLL_MS)
      secondsInterval = window.setInterval(
        () => setSearchSeconds((s) => s + 1),
        1000,
      )
      fallbackTimeout = window.setTimeout(() => {
        void (async () => {
          // A match created in this same instant still wins over the bot.
          const lastChanceGameId = await leaveMatchmaking()
          if (cancelled) return
          if (lastChanceGameId) {
            void enterGame(lastChanceGameId)
          } else {
            startBotGame()
          }
        })()
      }, MATCHMAKING_TIMEOUT_MS)
    }

    void run()

    return () => {
      cancelled = true
      stopSearching()
      if (bannerTimeout !== null) window.clearTimeout(bannerTimeout)
      if (!matched) {
        void leaveMatchmaking()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, gamesLoading, alreadyPlayedToday])

  // Tear down live game wiring when leaving the page.
  useEffect(() => {
    return () => {
      unsubGameRef.current?.()
      unsubGameRef.current = null
      gameChannelRef.current?.close()
      gameChannelRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => {
      if (drawTimeoutRef.current !== null) {
        window.clearTimeout(drawTimeoutRef.current)
      }
      if (controlMessageTimeoutRef.current !== null) {
        window.clearTimeout(controlMessageTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (authGateReached && !authPromptedRef.current) {
      authPromptedRef.current = true
      onSignIn()
    }
  }, [authGateReached, onSignIn])

  const remoteChat = useMemo<RemoteChat | null>(() => {
    if (opponent?.kind !== "human") {
      return null
    }

    return {
      send: (text: string) => {
        gameChannelRef.current?.send({ type: "chat", text })
      },
      subscribe: (onMessage: (text: string) => void) => {
        chatListenersRef.current.add(onMessage)
        return () => {
          chatListenersRef.current.delete(onMessage)
        }
      },
    }
  }, [opponent])

  const onPieceDrop = useCallback(
    ({
      sourceSquare,
      targetSquare,
    }: {
      sourceSquare: string
      targetSquare: string | null
    }) => {
      if (phase !== "playing" || botThinking || !targetSquare || authGateReached) {
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

        setFen(chess.fen())
        syncMoves()

        if (!user) {
          setAnonMoveCount((count) => count + 1)
        }

        const currentOpponent = opponentRef.current

        if (currentOpponent?.kind === "human") {
          const uci = move.from + move.to + (move.promotion ?? "")
          const fenAfterMove = chess.fen()
          const gameOver = chess.isGameOver()
          const nextOutcome = gameOver ? resultFromChess(chess, userColor) : null

          void (async () => {
            const ok = await sendLiveMove(currentOpponent.gameId, uci, fenAfterMove)
            if (!ok) {
              setSyncError(
                "Connection issue — your move may not have reached your opponent.",
              )
              return
            }
            setSyncError(null)
            if (nextOutcome) {
              await finishLiveGame(
                currentOpponent.gameId,
                winnerForOutcome(nextOutcome, userColor),
                nextOutcome.reason,
              )
            }
          })()

          if (nextOutcome) {
            void finishGame(nextOutcome)
          }
          return true
        }

        setControlMessage(
          chess.turn() === userColor ? "Your move" : `${botName} is thinking…`,
        )
        applyMove(userColor)

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
    [applyMove, authGateReached, botThinking, botName, finishGame, phase, requestBotMove, syncMoves, user, userColor],
  )

  const canDragPiece = useCallback(
    ({ piece }: { piece: { pieceType: string } }) => {
      if (phase !== "playing" || botThinking || authGateReached) {
        return false
      }

      const pieceColor = piece.pieceType[0]
      return pieceColor === userColor && chessRef.current.turn() === userColor
    },
    [authGateReached, botThinking, phase, userColor],
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

    const currentOpponent = opponentRef.current
    if (currentOpponent?.kind === "human") {
      void finishLiveGame(
        currentOpponent.gameId,
        userColor === "w" ? "b" : "w",
        "Resignation",
      )
    }

    void finishGame({ result: "loss", reason: "Resignation" })
  }

  function handleOfferDraw() {
    if (phase !== "playing" || botThinking || moves.length < 4) {
      return
    }

    const currentOpponent = opponentRef.current

    if (currentOpponent?.kind === "human") {
      gameChannelRef.current?.send({ type: "draw-offer" })
      flashControlMessage("Draw offer sent")
      return
    }

    setControlMessage(`${botName} is considering your draw offer…`)

    drawTimeoutRef.current = window.setTimeout(() => {
      drawTimeoutRef.current = null

      if (botAcceptsDraw(moves.length)) {
        void finishGame({ result: "draw", reason: "Draw by agreement" })
        return
      }

      flashControlMessage(`${botName} declined the draw`)
    }, 900)
  }

  function handleAcceptDraw() {
    const currentOpponent = opponentRef.current
    if (currentOpponent?.kind !== "human" || phase !== "playing") {
      return
    }

    setIncomingDrawOffer(false)
    void finishLiveGame(currentOpponent.gameId, null, "Draw by agreement")
    void finishGame({ result: "draw", reason: "Draw by agreement" })
  }

  function handleDeclineDraw() {
    setIncomingDrawOffer(false)
    gameChannelRef.current?.send({ type: "draw-decline" })
  }

  function handleTakeBack() {
    // Take-backs only exist in casual guest games.
    if (phase !== "playing" || botThinking || user) {
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
    flashControlMessage("Move taken back", 2000)
  }

  function resetGame() {
    const nextUserColor = randomUserColor()

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
    setSyncError(null)
    setIncomingDrawOffer(false)
    setAnonMoveCount(0)
    gameRecordedRef.current = false
    authPromptedRef.current = false
    unsubGameRef.current?.()
    unsubGameRef.current = null
    gameChannelRef.current?.close()
    gameChannelRef.current = null
    opponentRef.current = { kind: "bot" }
    setOpponent({ kind: "bot" })
    resetClock()
    setPhase("loading")
  }

  const opponentClockMs = times[botColor]
  const userClockMs = times[userColor]
  const isOpponentTurn = activeColor === botColor
  const isUserTurn = activeColor === userColor
  const controlsDisabled = phase !== "playing" || botThinking
  const canOfferDraw = moves.length >= 4
  const canTakeBack =
    !user && moves.length >= 2 && chessRef.current.turn() === userColor

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
      {
        rating: opponentDisplay.rating,
        deviation:
          opponent?.kind === "human" ? opponent.deviation : BOT_OPPONENT_RD,
      },
      scoreFromResult(outcome.result),
    )

    return {
      previousRating: player.rating,
      newRating: preview.rating,
      ratingChange: preview.change,
      isProvisional: isProvisionalRating(preview.deviation),
    }
  }, [opponent, opponentDisplay.rating, outcome, phase, profile, ratingResult, user])

  const statusMessage =
    controlMessage ??
    (phase === "matchmaking"
      ? "Finding an opponent…"
      : phase === "game_over" && gameOverRating
        ? `${gameOverRating.newRating}${gameOverRating.isProvisional ? "?" : ""} (${formatRatingChange(gameOverRating.ratingChange)})`
        : phase === "playing" && isOpponentTurn
          ? `${opponentDisplay.name} is thinking…`
          : phase === "playing" && isUserTurn
            ? "Your move"
            : null)

  if (authLoading) {
    return null
  }

  if (user && gamesLoading) {
    return null
  }

  if (user && alreadyPlayedToday && !gameRecordedRef.current) {
    return (
      <section className="flex w-full max-w-lg flex-col items-center px-4 text-center">
        <p className="font-display text-3xl text-ink md:text-4xl">One game a day</p>
        <p className="mt-3 max-w-sm text-sm leading-relaxed text-ink/75">
          You've already played today's position. Come back tomorrow for a new one.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
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
            key={opponentDisplay.name}
            botName={opponentDisplay.name}
            userName={userName}
            clockLabel={CLOCK_LABEL}
            signedIn={Boolean(user)}
            onSignIn={onSignIn}
            gameOver={phase === "game_over"}
            remoteChat={remoteChat}
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

            {(phase === "matchmaking" || matchBanner) && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-cream/75 p-4 backdrop-blur-[3px]">
                <div className="relative mx-auto flex w-[22rem] max-w-full flex-col items-center overflow-hidden rounded-2xl border border-white/70 bg-white/55 px-7 py-6 text-center shadow-[0_20px_70px_rgba(28,26,23,0.14),inset_0_1px_0_rgba(255,255,255,0.95)] backdrop-blur-2xl">
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-gold/14 to-transparent" />

                  {matchBanner ? (
                    <>
                      <p className="relative text-[10px] tracking-[0.28em] text-gold uppercase">
                        Opponent found
                      </p>
                      <p className="relative mt-2 font-display text-xl text-ink">
                        {matchBanner}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="relative text-[10px] tracking-[0.28em] text-gold uppercase">
                        Finding an opponent
                      </p>
                      <p className="relative mt-2 font-display text-2xl tabular-nums text-ink">
                        {formatSearchTime(searchSeconds)}
                      </p>
                      <p className="relative mt-2 max-w-xs text-xs leading-relaxed text-ink/65">
                        Pairing you with a player near your rating.
                      </p>
                      <button
                        type="button"
                        className={`${ghostButtonClass} relative mt-4`}
                        onClick={onExit}
                      >
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}

            {incomingDrawOffer && phase === "playing" && (
              <div className="absolute inset-x-0 top-3 z-10 flex justify-center px-4">
                <div className="flex items-center gap-3 rounded-full border border-white/70 bg-white/85 px-4 py-2 shadow-[0_10px_35px_rgba(28,26,23,0.14)] backdrop-blur-xl">
                  <p className="text-xs text-ink">
                    {opponentDisplay.name} offers a draw
                  </p>
                  <button
                    type="button"
                    onClick={handleAcceptDraw}
                    className="cursor-pointer rounded-full bg-emerald-600/90 px-3 py-1 text-[10px] font-medium tracking-[0.1em] text-white uppercase transition-colors hover:bg-emerald-600"
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    onClick={handleDeclineDraw}
                    className="cursor-pointer rounded-full border border-ink/15 bg-white/70 px-3 py-1 text-[10px] font-medium tracking-[0.1em] text-ink/70 uppercase transition-colors hover:bg-white"
                  >
                    Decline
                  </button>
                </div>
              </div>
            )}

            {authGateReached && phase === "playing" && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-cream/75 p-4 backdrop-blur-[3px]">
                <div className="relative mx-auto flex w-[22rem] max-w-full flex-col items-center overflow-hidden rounded-2xl border border-white/70 bg-white/55 px-7 py-6 text-center shadow-[0_20px_70px_rgba(28,26,23,0.14),inset_0_1px_0_rgba(255,255,255,0.95)] backdrop-blur-2xl">
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-gold/14 to-transparent" />

                  <p className="relative font-display text-xl text-ink">
                    Sign in to keep playing
                  </p>
                  <p className="relative mt-2 max-w-xs text-sm leading-relaxed text-ink/75">
                    You've played your {ANONYMOUS_MOVE_LIMIT} free moves. Sign in to finish the game and start tracking your rating.
                  </p>
                  <button
                    type="button"
                    className={`${ghostButtonClass} relative mt-4 w-full`}
                    onClick={onSignIn}
                  >
                    Sign In
                  </button>
                </div>
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

                  {user && gameRecordedRef.current ? (
                    <p className="relative mt-3 text-[10px] tracking-[0.14em] text-muted uppercase">
                      That's your game for today — come back tomorrow
                    </p>
                  ) : (
                    <button
                      type="button"
                      className={`${ghostButtonClass} relative mt-3 w-full`}
                      onClick={resetGame}
                    >
                      Play Again
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <aside className="flex w-full min-h-0 min-w-0 shrink-0 flex-col pb-2 lg:h-[min(calc(100dvh-7rem),820px)] lg:pb-0">
          <GameSidebar
            opponentName={opponentDisplay.name}
            opponentTitle={opponentDisplay.title}
            opponentRating={opponentDisplay.rating}
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
            phase={phase === "matchmaking" ? "loading" : phase}
            controlsDisabled={controlsDisabled}
            canOfferDraw={canOfferDraw}
            canTakeBack={canTakeBack}
            onOfferDraw={handleOfferDraw}
            onTakeBack={handleTakeBack}
            onResign={handleResign}
          />
        </aside>
      </div>

      {(engineError || syncError) && (
        <p className="mt-2 shrink-0 rounded-lg border border-red-200/80 bg-red-50/80 px-3 py-2 text-center text-xs text-red-800/90">
          {engineError ?? syncError}
        </p>
      )}
    </section>
  )
}
