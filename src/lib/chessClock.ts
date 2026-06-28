import { useCallback, useEffect, useRef, useState } from "react"
import type { Color } from "chess.js"

export const CLOCK_INITIAL_MS = 5 * 60 * 1000
export const CLOCK_INCREMENT_MS = 2 * 1000
export const CLOCK_LABEL = "5+2"

export function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, "0")}`
}

type ClockTimes = Record<Color, number>

export function useChessClock({
  activeColor,
  running,
  onFlag,
}: {
  activeColor: Color | null
  running: boolean
  onFlag: (color: Color) => void
}) {
  const [times, setTimes] = useState<ClockTimes>({
    w: CLOCK_INITIAL_MS,
    b: CLOCK_INITIAL_MS,
  })
  const onFlagRef = useRef(onFlag)
  onFlagRef.current = onFlag

  useEffect(() => {
    if (!running || !activeColor) {
      return
    }

    let lastTick = performance.now()
    const intervalId = window.setInterval(() => {
      const now = performance.now()
      const elapsed = now - lastTick
      lastTick = now

      setTimes((prev) => {
        const nextMs = Math.max(0, prev[activeColor] - elapsed)
        if (nextMs === 0 && prev[activeColor] > 0) {
          window.setTimeout(() => onFlagRef.current(activeColor), 0)
        }
        return { ...prev, [activeColor]: nextMs }
      })
    }, 100)

    return () => window.clearInterval(intervalId)
  }, [activeColor, running])

  const applyMove = useCallback((mover: Color) => {
    setTimes((prev) => ({
      ...prev,
      [mover]: prev[mover] + CLOCK_INCREMENT_MS,
    }))
  }, [])

  const reset = useCallback(() => {
    setTimes({ w: CLOCK_INITIAL_MS, b: CLOCK_INITIAL_MS })
  }, [])

  const revertMove = useCallback((mover: Color) => {
    setTimes((prev) => ({
      ...prev,
      [mover]: Math.max(0, prev[mover] - CLOCK_INCREMENT_MS),
    }))
  }, [])

  return { times, applyMove, revertMove, reset }
}
