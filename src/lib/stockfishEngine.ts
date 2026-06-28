import {
  blunderParamsForRating,
  STOCKFISH_MIN_ELO,
  type BlunderParams,
} from "./botRating"

const ENGINE_SCRIPT = "/engines/stockfish-18-lite-single.js"

type SearchOptions = {
  fen: string
  targetRating: number
  movetimeMs?: number
}

type ParsedMove = {
  uci: string
  scoreCp: number
}

function parseMultiPvLine(line: string): ParsedMove | null {
  if (!line.includes(" multipv ") || !line.includes(" pv ")) {
    return null
  }

  const scoreMatch = line.match(/ score cp (-?\d+)/)
  const pvMatch = line.match(/ pv ([a-h][1-8][a-h][1-8][qrbn]?)/)
  if (!pvMatch) {
    return null
  }

  return {
    uci: pvMatch[1],
    scoreCp: scoreMatch ? Number.parseInt(scoreMatch[1], 10) : 0,
  }
}

function pickMoveFromCandidates(moves: ParsedMove[], params: BlunderParams): string {
  const uniqueMoves = [...new Map(moves.map((move) => [move.uci, move])).values()]
  const pool = uniqueMoves.slice(0, Math.min(params.pickFromTop, uniqueMoves.length))

  if (pool.length <= 1) {
    return pool[0]?.uci ?? moves[0].uci
  }

  if (Math.random() < params.blunderChance) {
    const weakerMoves = pool.slice(1)
    return weakerMoves[Math.floor(Math.random() * weakerMoves.length)].uci
  }

  return pool[0].uci
}

export class StockfishEngine {
  private worker: Worker | null = null
  private readyPromise: Promise<void> | null = null
  private outputBuffer: string[] = []
  private pending:
    | {
        resolve: (move: string | ParsedMove[]) => void
        reject: (error: Error) => void
        collectMultiPv: boolean
        collected: ParsedMove[]
      }
    | null = null

  init(): Promise<void> {
    if (this.readyPromise) {
      return this.readyPromise
    }

    this.readyPromise = new Promise((resolve, reject) => {
      try {
        this.worker = new Worker(ENGINE_SCRIPT)
      } catch (error) {
        reject(error instanceof Error ? error : new Error("Could not start Stockfish worker."))
        return
      }

      this.worker.onmessage = (event: MessageEvent<string>) => {
        this.handleMessage(event.data)
      }

      this.worker.onerror = () => {
        reject(new Error("Stockfish worker failed to load."))
      }

      this.waitForToken("uciok")
        .then(() => resolve())
        .catch(reject)

      this.send("uci")
    })

    return this.readyPromise
  }

  dispose() {
    if (this.worker) {
      this.send("quit")
      this.worker.terminate()
      this.worker = null
    }
    this.readyPromise = null
    this.pending = null
    this.outputBuffer = []
  }

  async getBotMove({ fen, targetRating, movetimeMs = 900 }: SearchOptions): Promise<string> {
    await this.init()

    const blunderParams = blunderParamsForRating(targetRating)
    if (blunderParams) {
      return this.searchWithBlunders(fen, blunderParams)
    }

    const cappedRating = Math.max(STOCKFISH_MIN_ELO, Math.min(3190, targetRating))
    this.send("setoption name UCI_LimitStrength value true")
    this.send(`setoption name UCI_Elo value ${cappedRating}`)
    this.send("setoption name MultiPV value 1")
    this.send(`position fen ${fen}`)
    const move = await this.runSearch(`go movetime ${movetimeMs}`)
    if (typeof move !== "string") {
      throw new Error("Expected a single best move from Stockfish.")
    }
    return move
  }

  private async searchWithBlunders(fen: string, params: BlunderParams): Promise<string> {
    this.send("setoption name UCI_LimitStrength value false")
    this.send(`setoption name MultiPV value ${params.multiPv}`)
    this.send(`position fen ${fen}`)

    const result = await this.runSearch(`go depth ${params.depth}`, {
      collectMultiPv: true,
    })

    if (Array.isArray(result) && result.length > 0) {
      return pickMoveFromCandidates(result, params)
    }

    if (typeof result === "string") {
      return result
    }

    throw new Error("Stockfish returned no candidate moves.")
  }

  private send(command: string) {
    this.worker?.postMessage(command)
  }

  private waitForToken(token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        reject(new Error(`Timed out waiting for ${token}.`))
      }, 15000)

      const check = () => {
        const index = this.outputBuffer.findIndex((line) => line.includes(token))
        if (index === -1) {
          window.setTimeout(check, 20)
          return
        }

        window.clearTimeout(timeout)
        this.outputBuffer = this.outputBuffer.slice(index + 1)
        resolve()
      }

      check()
    })
  }

  private handleMessage(line: string) {
    this.outputBuffer.push(line)

    if (!this.pending) {
      return
    }

    if (this.pending.collectMultiPv) {
      const parsed = parseMultiPvLine(line)
      if (parsed) {
        this.pending.collected.push(parsed)
      }
    }

    if (!line.startsWith("bestmove ")) {
      return
    }

    const bestMove = line.split(" ")[1]
    if (!bestMove || bestMove === "(none)") {
      this.pending.reject(new Error("Stockfish returned no legal move."))
      this.pending = null
      return
    }

    if (this.pending.collectMultiPv && this.pending.collected.length > 0) {
      this.pending.resolve([...this.pending.collected])
    } else {
      this.pending.resolve(bestMove)
    }

    this.pending = null
  }

  private runSearch(
    command: string,
    options?: { collectMultiPv: boolean },
  ): Promise<string | ParsedMove[]> {
    return new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        this.pending = null
        reject(new Error("Stockfish search timed out."))
      }, 20000)

      this.pending = {
        resolve: (value) => {
          window.clearTimeout(timeout)
          resolve(value)
        },
        reject: (error) => {
          window.clearTimeout(timeout)
          reject(error)
        },
        collectMultiPv: options?.collectMultiPv ?? false,
        collected: [],
      }

      this.send(command)
    })
  }
}

let sharedEngine: StockfishEngine | null = null

export function getStockfishEngine(): StockfishEngine {
  if (!sharedEngine) {
    sharedEngine = new StockfishEngine()
  }
  return sharedEngine
}
