import { useState } from "react"
import { AuthModal } from "./components/AuthModal"
import { Header } from "./components/Header"
import { Leaderboard } from "./components/Leaderboard"
import { WeeklyBoard } from "./components/WeeklyBoard"
import { ProfilePage } from "./pages/ProfilePage"

type Page = "home" | "profile"

function App() {
  const [page, setPage] = useState<Page>("home")
  const [leaderboardOpen, setLeaderboardOpen] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)

  function goHome() {
    setPage("home")
  }

  function goProfile() {
    setPage("profile")
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-cream">
      <Header
        onLeaderboard={() => setLeaderboardOpen(true)}
        onStartGame={goHome}
        onSignIn={() => setAuthOpen(true)}
        onProfile={goProfile}
        onLogo={goHome}
      />

      <main
        className="flex min-h-0 flex-1 items-start justify-center overflow-y-auto px-5 pb-8 pt-2 md:px-10 md:pb-10 md:pt-3"
      >
        {page === "home" ? <WeeklyBoard /> : <ProfilePage onBack={goHome} />}
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
