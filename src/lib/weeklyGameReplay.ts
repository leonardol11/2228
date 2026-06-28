import { Chess } from "chess.js"
import type { WeeklyHistoricalGame } from "../data/weeklyGames"

const START_FEN = new Chess().fen()

export function replayPlyCap(game: WeeklyHistoricalGame): number {
  if (game.positionAfterPly !== undefined) {
    return game.positionAfterPly
  }

  return game.moves.length
}

export function movesUpToKeyPosition(game: WeeklyHistoricalGame): string[] {
  return game.moves.slice(0, replayPlyCap(game))
}

export function fenAtPly(moves: string[], ply: number): string {
  if (ply <= 0) {
    return START_FEN
  }

  const chess = new Chess()
  for (let i = 0; i < ply && i < moves.length; i++) {
    if (!chess.move(moves[i])) {
      break
    }
  }

  return chess.fen()
}

export function sideToMoveAtPly(ply: number): "White" | "Black" {
  return ply % 2 === 0 ? "White" : "Black"
}
