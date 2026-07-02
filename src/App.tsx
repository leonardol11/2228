import { useEffect, useState } from "react"
import { AuthModal } from "./components/AuthModal"
import { Header } from "./components/Header"
import { DailyBoard } from "./components/DailyBoard"
import { GamePage } from "./pages/GamePage"
import { LeaderboardPage } from "./pages/LeaderboardPage"
import { ProfilePage } from "./pages/ProfilePage"

type Page = "home" | "game" | "profile" | "leaderboard"

const HASH_PAGES: Page[] = ["game", "profile", "leaderboard"]

function pageFromHash(hash: string): Page {
  const candidate = hash.replace(/^#/, "")
  return (HASH_PAGES as string[]).includes(candidate) ? (candidate as Page) : "home"
}

function App() {
  const [page, setPage] = useState<Page>(() => pageFromHash(window.location.hash))
  const [authOpen, setAuthOpen] = useState(false)

  useEffect(() => {
    function handleHashChange() {
      setPage(pageFromHash(window.location.hash))
    }

    window.addEventListener("hashchange", handleHashChange)
    return () => window.removeEventListener("hashchange", handleHashChange)
  }, [])

  function goHome() {
    window.location.hash = ""
    setPage("home")
  }

  function goGame() {
    window.location.hash = "game"
    setPage("game")
  }

  function goProfile() {
    window.location.hash = "profile"
    setPage("profile")
  }

  function goLeaderboard() {
    window.location.hash = "leaderboard"
    setPage("leaderboard")
  }

  const isFixedPage = page === "game" || page === "profile" || page === "leaderboard"

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-cream">
      <Header
        onLeaderboard={goLeaderboard}
        onStartGame={goGame}
        onSignIn={() => setAuthOpen(true)}
        onProfile={goProfile}
        onLogo={goHome}
      />

      <main
        className={`flex min-h-0 flex-1 justify-center ${
          page === "game"
            ? "items-start overflow-y-auto px-4 pb-3 pt-1 md:items-center md:overflow-hidden md:px-6 md:pb-2 lg:px-10 sm:pb-3"
            : isFixedPage
              ? "items-stretch overflow-hidden bg-cream px-5 pb-4 pt-2 md:px-10 md:pt-3"
              : "items-start overflow-y-auto px-5 pb-8 pt-2 md:px-10 md:pb-10 md:pt-3"
        }`}
      >
        {page === "home" ? (
          <DailyBoard />
        ) : page === "game" ? (
          <GamePage onExit={goHome} onSignIn={() => setAuthOpen(true)} />
        ) : page === "profile" ? (
          <ProfilePage onBack={goHome} />
        ) : (
          <LeaderboardPage />
        )}
      </main>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </div>
  )
}

export default App
