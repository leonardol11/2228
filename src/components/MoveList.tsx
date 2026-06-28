type MoveListProps = {
  moves: string[]
}

function pairMoves(moves: string[]): { number: number; white: string; black?: string }[] {
  const pairs: { number: number; white: string; black?: string }[] = []

  for (let i = 0; i < moves.length; i += 2) {
    pairs.push({
      number: Math.floor(i / 2) + 1,
      white: moves[i],
      black: moves[i + 1],
    })
  }

  return pairs
}

export function MoveList({ moves }: MoveListProps) {
  const pairs = pairMoves(moves)

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-white/55 bg-white/30">
      <ol className="min-h-0 flex-1 overflow-y-auto px-2 py-2 font-mono text-xs leading-relaxed text-ink/85">
        {pairs.length === 0 ? (
          <li className="px-2 py-3 text-center text-muted">No moves yet</li>
        ) : (
          pairs.map((pair) => (
            <li
              key={pair.number}
              className="grid grid-cols-[2rem_1fr_1fr] gap-x-1 rounded px-1.5 py-0.5 hover:bg-white/40"
            >
              <span className="text-muted">{pair.number}.</span>
              <span>{pair.white}</span>
              <span>{pair.black ?? ""}</span>
            </li>
          ))
        )}
      </ol>
    </div>
  )
}
