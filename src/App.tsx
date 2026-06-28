import { useState } from "react"
import { AuthModal } from "./components/AuthModal"
import { Header } from "./components/Header"
import { Leaderboard } from "./components/Leaderboard"
import { WeeklyBoard } from "./components/WeeklyBoard"

function App() {
  const [leaderboardOpen, setLeaderboardOpen] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-cream">
      <Header
        onLeaderboard={() => setLeaderboardOpen(true)}
        onStartGame={() => {}}
        onSignIn={() => setAuthOpen(true)}
      />

      <main className="flex min-h-0 flex-1 items-start justify-center overflow-y-auto px-5 pb-10 pt-2 md:pt-3">
        <WeeklyBoard />
      </main>

      <Leaderboard
        open={leaderboardOpen}
        onClose={() => setLeaderboardOpen(false)}
      />

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </div>
  )
}

export default App
