# 2228 Chess

Play ranked chess against a bot that scales to your rating. Sign in to track your Glicko rating, climb the leaderboard, and replay famous positions from chess history.

## Features

- **Ranked bot games** — Stockfish-powered opponent with strength tied to your rating (5+2 clock)
- **Glicko ratings** — Provisional ratings for new players, with rating changes saved after each game
- **Leaderboard** — Live rankings from Supabase
- **Profiles** — Game history and rating stats for signed-in players
- **Weekly position** — Home page features a famous historical game to step through move by move
- **PWA support** — Add to home screen for an app-style icon and standalone launch

## Stack

- [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) + [Vite](https://vite.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [chess.js](https://github.com/jhlywa/chess.js) + [react-chessboard](https://github.com/Clariity/react-chessboard)
- [Stockfish](https://stockfishchess.org/) (in-browser engine)
- [Supabase](https://supabase.com/) (auth, profiles, ratings, game records)

## Getting started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com/) project with the migrations in `supabase/migrations/` applied

### Setup

```bash
npm install
```

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Run the dev server:

```bash
npm run dev
```

### Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start local dev server |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Preview the production build |
| `npm run lint` | Run Oxlint |

## Database

SQL migrations live in `supabase/migrations/`. Apply them to your Supabase project (via the SQL editor or Supabase CLI) before using auth, ratings, or game history.
