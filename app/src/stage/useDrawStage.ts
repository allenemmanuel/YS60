import { useReducedMotion } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { stageSound } from '@/stage/sound'

/**
 * idle      → waiting for the MC to press the clicker
 * spinning  → suspense; the winner is being saved (real app) or picked (demo)
 * landing   → the concept animates onto the known winner, then calls `landed()`
 * revealed  → winner on screen; next press moves to the next prize
 */
export type Phase = 'idle' | 'spinning' | 'landing' | 'revealed'

export interface DrawStageOptions {
  /** Resolves with the winner's name only after it is safely saved. */
  pick: () => Promise<string>
  /** Minimum suspense before landing (ms). */
  minSpinMs?: number
  prizeCount: number
}

export interface DrawStage {
  phase: Phase
  winner: string | null
  prizeIndex: number
  error: string | null
  /** Press-to-skip: true once the MC presses again during landing. Concepts should snap to the end. */
  skip: boolean
  reduced: boolean
  advance: () => void
  landed: () => void
}

export function useDrawStage({ pick, minSpinMs = 4500, prizeCount }: DrawStageOptions): DrawStage {
  const reduced = useReducedMotion() ?? false
  const [phase, setPhase] = useState<Phase>('idle')
  const [winner, setWinner] = useState<string | null>(null)
  const [prizeIndex, setPrizeIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [hurry, setHurry] = useState(false)
  const [skip, setSkip] = useState(false)
  const spinStart = useRef(0)
  const pickRef = useRef(pick)
  useEffect(() => {
    pickRef.current = pick
  }, [pick])
  const minSpin = reduced ? Math.min(minSpinMs, 1500) : minSpinMs

  const advance = useCallback(() => {
    switch (phase) {
      case 'idle':
        setError(null)
        setWinner(null)
        setHurry(false)
        setSkip(false)
        spinStart.current = performance.now()
        setPhase('spinning')
        stageSound.startSpin()
        pickRef.current().then(setWinner, (err: unknown) => {
          stageSound.stopSpin()
          setError(err instanceof Error ? err.message : 'The draw failed. Try again.')
          setPhase('idle')
        })
        break
      case 'spinning':
        setHurry(true)
        break
      case 'landing':
        setSkip(true)
        break
      case 'revealed':
        setWinner(null)
        setPrizeIndex((i) => Math.min(i + 1, prizeCount - 1))
        setPhase('idle')
        break
    }
  }, [phase, prizeCount])

  // spinning → landing once the winner is known and the suspense has run (or the MC hurried it).
  useEffect(() => {
    if (phase !== 'spinning' || !winner) return
    const wait = hurry ? 0 : Math.max(0, minSpin - (performance.now() - spinStart.current))
    const t = setTimeout(() => setPhase('landing'), wait)
    return () => clearTimeout(t)
  }, [phase, winner, hurry, minSpin])

  const phaseRef = useRef(phase)
  useEffect(() => {
    phaseRef.current = phase
  }, [phase])

  const landed = useCallback(() => {
    if (phaseRef.current !== 'landing') return
    phaseRef.current = 'revealed'
    stageSound.playFanfare()
    setPhase('revealed')
  }, [])

  useEffect(() => () => stageSound.stopAll(), [])

  return { phase, winner, prizeIndex, error, skip, reduced, advance, landed }
}
