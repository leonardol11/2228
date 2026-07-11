import { useEffect, useRef, useState } from "react"

export type ChatMessage = {
  id: string
  sender: "user" | "bot" | "system"
  text: string
}

/** Wire to a live opponent; when absent the local bot answers instead. */
export type RemoteChat = {
  send: (text: string) => void
  subscribe: (onMessage: (text: string) => void) => () => void
}

type GameChatProps = {
  botName: string
  userName: string
  clockLabel: string
  signedIn: boolean
  onSignIn: () => void
  gameOver: boolean
  remoteChat?: RemoteChat | null
}

const QUICK_MESSAGES = ["HI", "GL", "HF", "U2"] as const

const BOT_REPLIES: Record<string, string[]> = {
  HI: ["Hi!", "Hello!", "Hey there."],
  GL: ["Good luck!", "You too!", "May the best player win."],
  HF: ["Thanks!", "Have fun!", "Enjoy the game."],
  U2: ["Thanks!", "Likewise!", "Appreciate it."],
}

function pickReply(key: string) {
  const options = BOT_REPLIES[key]
  if (!options) return "👍"
  return options[Math.floor(Math.random() * options.length)]
}

export function GameChat({
  botName,
  userName,
  clockLabel,
  signedIn,
  onSignIn,
  gameOver,
  remoteChat = null,
}: GameChatProps) {
  const [enabled, setEnabled] = useState(true)
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      sender: "system",
      text: `${clockLabel} ${signedIn ? "rated" : "casual"} game vs ${botName}`,
    },
  ])
  const [draft, setDraft] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)
  const replyTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages])

  useEffect(() => {
    return () => {
      if (replyTimeoutRef.current !== null) {
        window.clearTimeout(replyTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!remoteChat) {
      return
    }

    return remoteChat.subscribe((text) => {
      setMessages((prev) => [
        ...prev,
        { id: `${Date.now()}-${Math.random()}`, sender: "bot", text },
      ])
    })
  }, [remoteChat])

  function pushMessage(sender: ChatMessage["sender"], text: string) {
    setMessages((prev) => [
      ...prev,
      { id: `${Date.now()}-${Math.random()}`, sender, text },
    ])
  }

  function sendUserMessage(text: string) {
    const trimmed = text.trim()
    if (!trimmed || !signedIn || !enabled || gameOver) {
      return
    }

    pushMessage("user", trimmed)
    setDraft("")

    if (remoteChat) {
      remoteChat.send(trimmed)
      return
    }

    const quickKey = QUICK_MESSAGES.find((key) => key.toLowerCase() === trimmed.toLowerCase())
    replyTimeoutRef.current = window.setTimeout(() => {
      pushMessage("bot", quickKey ? pickReply(quickKey) : "Interesting…")
    }, 600 + Math.random() * 800)
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    sendUserMessage(draft)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-white/55 bg-white/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]">
      <div className="shrink-0 border-b border-white/50 px-3 py-2.5">
        <p className="text-xs font-medium text-ink">
          {clockLabel} · {signedIn ? "Rated" : "Casual"}
        </p>
        <p className="mt-0.5 text-[11px] text-muted">
          {userName} vs {botName}
        </p>
      </div>

      <div className="flex shrink-0 items-center justify-between border-b border-white/50 px-3 py-2">
        <p className="text-[10px] tracking-[0.16em] text-muted uppercase">Chat room</p>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Toggle chat"
          onClick={() => setEnabled((value) => !value)}
          className={`relative h-5 w-9 cursor-pointer rounded-full transition-colors duration-200 ${
            enabled ? "bg-emerald-600/85" : "bg-ink/15"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${
              enabled ? "translate-x-4" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-3 text-sm"
      >
        {messages.map((message) => (
          <div
            key={message.id}
            className={
              message.sender === "system"
                ? "text-center text-[11px] text-muted"
                : message.sender === "user"
                  ? "text-right text-ink"
                  : "text-left text-ink/80"
            }
          >
            {message.sender === "bot" && (
              <span className="mr-1.5 text-[10px] font-medium text-gold">{botName}</span>
            )}
            {message.sender === "user" && (
              <span className="mr-1.5 text-[10px] font-medium text-muted">You</span>
            )}
            <span>{message.text}</span>
          </div>
        ))}
      </div>

      <div className="shrink-0 border-t border-white/50 p-2.5">
        {signedIn ? (
          <form onSubmit={handleSubmit}>
            <input
              type="text"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={enabled ? "Write a message…" : "Chat is disabled"}
              disabled={!enabled || gameOver}
              className="w-full rounded-lg border border-white/60 bg-white/55 px-3 py-2 text-base text-ink placeholder:text-muted/70 focus:border-gold/50 focus:outline-none disabled:opacity-50 sm:text-sm"
            />
          </form>
        ) : (
          <button
            type="button"
            onClick={onSignIn}
            className="w-full cursor-pointer rounded-lg border border-white/60 bg-white/45 px-3 py-2 text-left text-sm text-muted transition-colors hover:bg-white/65 hover:text-ink"
          >
            Sign in to chat
          </button>
        )}

        <div className="mt-2 flex gap-1">
          {QUICK_MESSAGES.map((phrase) => (
            <button
              key={phrase}
              type="button"
              disabled={!signedIn || !enabled || gameOver}
              onClick={() => sendUserMessage(phrase)}
              className="flex-1 cursor-pointer rounded-md border border-white/55 bg-white/40 px-1 py-1.5 text-[10px] font-medium tracking-[0.08em] text-ink/70 transition-colors hover:bg-white/65 hover:text-ink disabled:cursor-default disabled:opacity-35"
            >
              {phrase}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
