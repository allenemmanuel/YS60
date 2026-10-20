import { useEffect, useRef } from 'react'
import type { DrawStage } from '@/stage/useDrawStage'

export interface ConceptProps {
  stage: DrawStage
  names: string[]
}

/** requestAnimationFrame loop. `dt` is clamped so a background tab doesn't cause a jump. */
export function useFrame(cb: (now: number, dt: number) => void) {
  const ref = useRef(cb)
  useEffect(() => {
    ref.current = cb
  })
  useEffect(() => {
    let id = 0
    let last = performance.now()
    const loop = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000)
      last = t
      ref.current(t, dt)
      id = requestAnimationFrame(loop)
    }
    id = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(id)
  }, [])
}

/** Latest value in a ref, for reading inside rAF loops without re-subscribing. */
export function useLatest<T>(value: T) {
  const ref = useRef(value)
  useEffect(() => {
    ref.current = value
  })
  return ref
}

/**
 * A canvas drawn in stage coordinates (1920×1080) but backed by only as many pixels as the
 * screen shows (never more than 1920×1080). `getCtx()` returns a context already scaled to stage units.
 */
export function useStageCanvas() {
  const ref = useRef<HTMLCanvasElement>(null)
  const res = useRef(1)
  useEffect(() => {
    const fit = () => {
      const scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080)
      const r = Math.min(1, scale * (window.devicePixelRatio || 1))
      res.current = r
      const c = ref.current
      if (c) {
        c.width = Math.round(1920 * r)
        c.height = Math.round(1080 * r)
      }
    }
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])
  const getCtx = () => {
    const ctx = ref.current?.getContext('2d')
    ctx?.setTransform(res.current, 0, 0, res.current, 0, 0)
    return ctx
  }
  return { ref, getCtx }
}

export const easeOutCubic = (t: number) => 1 - (1 - t) ** 3
export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
export const clamp01 = (t: number) => Math.min(1, Math.max(0, t))
export const mod = (n: number, m: number) => ((n % m) + m) % m
