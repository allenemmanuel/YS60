import { useRef } from 'react'
import { secureRandomInt } from '@/lib/random'
import { FitName } from '@/stage/FitName'
import { STAGE_H, STAGE_W } from '@/stage/StageFrame'
import { clamp01, easeOutCubic, useFrame, useLatest, useStageCanvas, type ConceptProps } from '@/stage/useFrame'

/** Concept: flying through a tunnel of names at warp speed; the winner emerges from the far end and stops in front of you. */

const CX = 960
const CY = 600
const FOCAL = 900
const FAR = 7000
const NEAR = 260
const TUNNEL_R = 1150
const WORDS = 46
const STARS = 260
const BANDS = 6

interface Flyer {
  a: number
  z: number
  r: number
}

const spawn = (z: number): Flyer => ({ a: Math.random() * Math.PI * 2, z, r: TUNNEL_R * (0.85 + Math.random() * 0.4) })

export function Terowong({ stage, names }: ConceptProps) {
  const { ref: canvasRef, getCtx } = useStageCanvas()
  const wordRefs = useRef<(HTMLSpanElement | null)[]>([])
  const winnerRef = useRef<HTMLDivElement>(null)
  const s = useLatest(stage)
  const sim = useRef({ words: null as Flyer[] | null, stars: null as Flyer[] | null, phase: '', speed: 250, landAt: 0, winnerZ: FAR * 1.4 })

  useFrame((now, dt) => {
    const st = s.current
    const m = sim.current
    m.words ??= Array.from({ length: WORDS }, (_, i) => spawn(NEAR + ((FAR - NEAR) * i) / WORDS))
    m.stars ??= Array.from({ length: STARS }, () => ({ ...spawn(NEAR + Math.random() * (FAR - NEAR)), r: 200 + Math.random() * 1400 }))
    const { words, stars } = m
    const reduced = st.reduced
    if (st.phase !== m.phase) {
      m.phase = st.phase
      if (st.phase === 'landing') m.landAt = now
      if (st.phase === 'idle') m.winnerZ = FAR * 1.4
    }

    const cruise = reduced ? 0 : st.phase === 'spinning' ? 5200 : st.phase === 'landing' ? 900 : st.phase === 'revealed' ? 120 : 250
    m.speed += (cruise - m.speed) * Math.min(1, dt * (st.phase === 'landing' ? 1.4 : 1.8))
    const step = m.speed * dt

    // Names on the tunnel wall.
    for (let i = 0; i < words.length; i++) {
      const w = words[i]
      w.z -= step
      if (w.z < NEAR) {
        Object.assign(w, spawn(FAR))
        const el = wordRefs.current[i]
        if (el) el.textContent = names[secureRandomInt(names.length)]
      }
      const el = wordRefs.current[i]
      if (!el) continue
      const k = FOCAL / w.z
      const x = CX + Math.cos(w.a) * w.r * k
      const y = CY + Math.sin(w.a) * w.r * 0.62 * k
      const fadeIn = clamp01((FAR - w.z) / 1200)
      const fadeOut = clamp01((w.z - NEAR) / 500)
      const dim = st.phase === 'revealed' ? 0.1 : 1
      el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${k})`
      const o = fadeIn * fadeOut * dim
      el.style.opacity = String(o)
      // Fully transparent names are skipped by the compositor.
      el.style.visibility = o < 0.01 ? 'hidden' : ''
    }

    // The winner flies in down the middle and comes to rest at scale 1.
    const winEl = winnerRef.current
    if (winEl) {
      if (st.phase === 'landing') {
        const dur = reduced ? 0.4 : 3.0
        const k = st.skip ? 1 : clamp01((now - m.landAt) / 1000 / dur)
        const e = easeOutCubic(k)
        // Interpolate in 1/z so the approach reads as constant-feeling depth, ending exactly at the focal plane.
        const inv = 1 / (FAR * 1.4) + (1 / FOCAL - 1 / (FAR * 1.4)) * e
        m.winnerZ = 1 / inv
        if (k >= 1) st.landed()
      }
      const scale = FOCAL / m.winnerZ
      winEl.style.transform = `translate(-50%, -50%) scale(${scale})`
      winEl.style.opacity = st.phase === 'landing' || st.phase === 'revealed' ? String(clamp01(scale * 4)) : '0'
    }

    // Warp streaks.
    const ctx = getCtx()
    if (!ctx) return
    ctx.clearRect(0, 0, STAGE_W, STAGE_H)
    const streak = Math.min(1, m.speed / 5200)
    ctx.lineCap = 'round'
    // Streaks are grouped into depth bands: one stroke per band (shared width and alpha) instead of one per star.
    const paths = Array.from({ length: BANDS }, () => new Path2D())
    for (const p of stars) {
      const z0 = p.z
      p.z -= step * 1.3
      if (p.z < 120) Object.assign(p, { ...spawn(FAR), r: 200 + Math.random() * 1400 })
      const k1 = FOCAL / p.z
      const k0 = FOCAL / Math.min(FAR, z0 + 260 * streak * 4 + 1)
      const band = Math.min(BANDS - 1, Math.floor((p.z / FAR) * BANDS))
      const path = paths[band]
      path.moveTo(CX + Math.cos(p.a) * p.r * k0, CY + Math.sin(p.a) * p.r * 0.62 * k0)
      path.lineTo(CX + Math.cos(p.a) * p.r * k1 + 0.1, CY + Math.sin(p.a) * p.r * 0.62 * k1 + 0.1)
    }
    for (let b = 0; b < BANDS; b++) {
      const z = ((b + 0.5) / BANDS) * FAR
      ctx.strokeStyle = `rgba(169, 214, 245, ${clamp01((FAR - z) / 2000) * 0.8})`
      ctx.lineWidth = Math.min(4, 0.6 + (FOCAL / z) * 1.2)
      ctx.stroke(paths[b])
    }
  })

  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at 50% 600px, #123563 0%, #08162b 38%, #040c19 80%)' }} />
      <canvas ref={canvasRef} className="absolute inset-0 size-full" aria-hidden="true" />
      <div className="absolute inset-0" aria-hidden="true">
        {Array.from({ length: WORDS }, (_, i) => (
          <span
            key={i}
            ref={(el) => {
              wordRefs.current[i] = el
              if (el && !el.textContent) el.textContent = names[i % names.length]
            }}
            className="absolute top-0 left-0 font-display text-[64px] font-bold whitespace-nowrap text-ice will-change-transform"
            style={{ opacity: 0 }}
          />
        ))}
      </div>
      <div
        ref={winnerRef}
        className="absolute flex items-center justify-center text-center font-display font-extrabold text-gold will-change-transform"
        style={{ left: CX, top: CY, width: 1640, height: 340, opacity: 0, textShadow: '0 0 50px rgba(224, 180, 92, 0.35)' }}
      >
        {stage.winner && (stage.phase === 'landing' || stage.phase === 'revealed') && (
          <FitName text={stage.winner} width={1640} maxSize={190} minSize={90} lineHeight={0.98} />
        )}
      </div>
    </div>
  )
}
