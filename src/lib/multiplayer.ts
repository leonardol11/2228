import type { RealtimeChannel } from "@supabase/supabase-js"
import { supabase } from "./supabase"

export type LiveGameRow = {
  id: string
  white_id: string
  black_id: string
  white_username: string
  black_username: string
  white_rating: number
  black_rating: number
  white_rd: number
  black_rd: number
  start_fen: string
  fen: string
  moves: string
  turn: "w" | "b"
  initial_ms: number
  increment_ms: number
  white_ms: number
  black_ms: number
  last_move_at: string
  status: "active" | "finished"
  winner: "w" | "b" | null
  end_reason: string | null
  position_title: string | null
  position_date: string | null
  created_at: string
}

export type MatchmakingParams = {
  startFen: string
  turn: "w" | "b"
  initialMs: number
  incrementMs: number
  positionTitle: string
  positionDate: string
}

export function parseMoves(moves: string): string[] {
  return moves === "" ? [] : moves.split(" ")
}

/**
 * Try to pair with a waiting player. Returns the live game id once matched,
 * or null while still waiting. Call on join, then every few seconds.
 */
export async function pollMatchmaking(
  params: MatchmakingParams,
): Promise<string | null> {
  const { data, error } = await supabase.rpc("join_matchmaking", {
    p_start_fen: params.startFen,
    p_turn: params.turn,
    p_initial_ms: params.initialMs,
    p_increment_ms: params.incrementMs,
    p_position_title: params.positionTitle,
    p_position_date: params.positionDate,
  })

  if (error) {
    // Concurrent polls can collide on locks; the next poll retries cleanly.
    console.error("Matchmaking poll failed:", error.message)
    return null
  }

  return (data as string | null) ?? null
}

/**
 * Leave the queue. Returns a game id if we were matched in the same instant
 * we cancelled, so the caller can still enter that game.
 */
export async function leaveMatchmaking(): Promise<string | null> {
  const { data, error } = await supabase.rpc("leave_matchmaking")
  if (error) {
    console.error("Failed to leave matchmaking:", error.message)
    return null
  }
  return (data as string | null) ?? null
}

/**
 * Realtime notification for the waiting player: fires with the game id when
 * a joining player pairs with our queue row.
 */
export function subscribeToMatch(
  userId: string,
  onMatch: (gameId: string) => void,
): () => void {
  const channel = supabase
    .channel(`queue-${userId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "matchmaking_queue",
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        const gameId = (payload.new as { game_id: string | null }).game_id
        if (gameId) {
          onMatch(gameId)
        }
      },
    )
    .subscribe()

  return () => {
    void supabase.removeChannel(channel)
  }
}

export async function fetchLiveGame(gameId: string): Promise<LiveGameRow | null> {
  const { data, error } = await supabase
    .from("live_games")
    .select("*")
    .eq("id", gameId)
    .maybeSingle()

  if (error) {
    console.error("Failed to fetch live game:", error.message)
    return null
  }

  return data as LiveGameRow | null
}

/** Resume an unfinished game after a refresh or accidental navigation. */
export async function fetchActiveGameFor(
  userId: string,
): Promise<LiveGameRow | null> {
  const { data, error } = await supabase
    .from("live_games")
    .select("*")
    .eq("status", "active")
    .or(`white_id.eq.${userId},black_id.eq.${userId}`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error("Failed to look up active game:", error.message)
    return null
  }

  return data as LiveGameRow | null
}

export function subscribeToLiveGame(
  gameId: string,
  onUpdate: (row: LiveGameRow) => void,
): () => void {
  const channel = supabase
    .channel(`live-game-${gameId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "live_games",
        filter: `id=eq.${gameId}`,
      },
      (payload) => {
        onUpdate(payload.new as LiveGameRow)
      },
    )
    .subscribe()

  return () => {
    void supabase.removeChannel(channel)
  }
}

export async function sendLiveMove(
  gameId: string,
  uci: string,
  fen: string,
): Promise<boolean> {
  const { error } = await supabase.rpc("make_live_move", {
    p_game_id: gameId,
    p_move: uci,
    p_fen: fen,
  })

  if (error) {
    console.error("Failed to send move:", error.message)
    return false
  }

  return true
}

export async function finishLiveGame(
  gameId: string,
  winner: "w" | "b" | null,
  reason: string,
): Promise<void> {
  const { error } = await supabase.rpc("finish_live_game", {
    p_game_id: gameId,
    p_winner: winner,
    p_reason: reason,
  })

  if (error) {
    console.error("Failed to finish game:", error.message)
  }
}

export async function claimTimeout(gameId: string): Promise<void> {
  const { error } = await supabase.rpc("claim_timeout", { p_game_id: gameId })
  if (error) {
    console.error("Failed to claim timeout:", error.message)
  }
}

// ── Player-to-player messages (chat + draw offers) ───────────────────────────

export type GameChannelEvent =
  | { type: "chat"; text: string }
  | { type: "draw-offer" }
  | { type: "draw-accept" }
  | { type: "draw-decline" }

export type GameChannel = {
  send: (event: GameChannelEvent) => void
  close: () => void
}

export function openGameChannel(
  gameId: string,
  userId: string,
  onEvent: (event: GameChannelEvent) => void,
): GameChannel {
  let channel: RealtimeChannel | null = supabase
    .channel(`game-chat-${gameId}`)
    .on("broadcast", { event: "game" }, ({ payload }) => {
      const data = payload as GameChannelEvent & { from: string }
      if (data.from !== userId) {
        onEvent(data)
      }
    })
    .subscribe()

  return {
    send(event) {
      void channel?.send({
        type: "broadcast",
        event: "game",
        payload: { ...event, from: userId },
      })
    },
    close() {
      if (channel) {
        void supabase.removeChannel(channel)
        channel = null
      }
    },
  }
}
