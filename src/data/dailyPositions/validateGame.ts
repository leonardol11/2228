import { Chess } from "chess.js"
import type { DailyHistoricalGame } from "./types"

/** Returns an error message when `fen` does not match `moves` at `positionAfterPly`. */
export function validateDailyGame(game: DailyHistoricalGame): string | null {
  if (game.moves.length === 0) {
    return null
  }

  const chess = new Chess()

  for (const move of game.moves) {
    if (!chess.move(move)) {
      return `Illegal move "${move}" in "${game.title}"`
    }
  }

  if (game.positionAfterPly === undefined) {
    return null
  }

  const positionChess = new Chess()
  for (let ply = 0; ply < game.positionAfterPly; ply++) {
    if (!positionChess.move(game.moves[ply])) {
      return `Could not reach ply ${game.positionAfterPly} in "${game.title}"`
    }
  }

  const expected = positionChess.fen()
  if (expected !== game.fen) {
    return `FEN mismatch in "${game.title}".\nExpected: ${expected}\nGot:      ${game.fen}`
  }

  return null
}
