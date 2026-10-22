import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useRef } from 'react'
import { shuffle } from '@/lib/random'
import { FitName } from '@/stage/FitName'
import { stageSound } from '@/stage/sound'
import { createDrumScene, type DrumScene } from '@/stage/three/drumScene'
import { clamp01, mod, useFrame, useLatest, type ConceptProps } from '@/stage/useFrame'

/**
 * Concept 1 (Gulungan): a real 3D drum of names (Three.js). It spins, slows into a long creep,
 * nudges just past the winner and rolls back onto it, then a gold flash reveals the name.
 */

const TOP_SPEED = 16 // rows per second
const LAND_S = 5.2 // main slow-down
const OVERSHOOT = 0.42 // rows past the winner before rolling back
const SETTLE_S = 0.8
const HOLD_S = 0.35
const FLASH_S = 1.1

export default function Gulungan({ stage, names }: ConceptProps) {
  const seq = useMemo(() => shuffle(names), [names])
  const hostRef = useRef<HTMLDivElement>(null)
  const drumRef = useRef<DrumScene | null>(null)
  const s = useLatest(stage)
  const sim = useRef({
    phase: '' as string,
    pos: 0,
    vel: 0.3,
    target: null as number | null,
    landAt: 0,
    from: 0,
    dur: 0,
    lastTick: 0,
    revealAt: 0,
  })

  useEffect(() => {
    const host = hostRef.current!
    const drum = createDrumScene()
    drum.canvas.className = 'absolute inset-0 size-full'
    host.appendChild(drum.canvas)
    drumRef.current = drum
    const nameFor = (row: number) => {
      const m = sim.current
      const st = s.current
      if (m.target !== null && row === m.target && st.winner) return st.winner
      return seq[mod(row, seq.length)]
    }
    drum.setNameFor(nameFor)
    const fit = () => {
      const scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080)
      // ?q=0.5 etc. renders fewer pixels (a fallback for weak laptops); the stage still fills the screen.
      const q = Number(new URLSearchParams(window.location.search).get('q')) || 1
      drum.resize(Math.min(1, scale * (window.devicePixelRatio || 1)) * Math.min(1, Math.max(0.3, q)))
    }
    fit()
    window.addEventListener('resize', fit)
    // Canvas text uses the fallback font until the real one loads; repaint then.
    void document.fonts.load('700 100px "Barlow Condensed"').then(() => drum.repaintAll())
    drum.repaintAll()
    return () => {
      window.removeEventListener('resize', fit)
      drum.dispose()
      drum.canvas.remove()
      drumRef.current = null
    }
  }, [seq, s])

  useFrame((now, dt) => {
    const drum = drumRef.current
    if (!drum) return
    const st = s.current
    const m = sim.current
    const t = now / 1000

    if (st.phase !== m.phase) {
      if (st.phase === 'landing') {
        // Ease-out (quartic) whose starting slope matches the current speed: distance = v·D/4.
        const v = Math.max(m.vel, 4)
        const dur = st.reduced ? 0.6 : LAND_S
        const target = Math.ceil(m.pos + (v * dur) / 4)
        m.target = target
        m.from = m.pos
        m.dur = st.reduced ? 0.6 : (4 * (target + OVERSHOOT - m.pos)) / v
        m.landAt = t
        drum.repaintAll()
      }
      if (st.phase === 'revealed') {
        m.revealAt = t
        drum.setHighlight(m.target)
      }
      if (st.phase === 'idle') {
        m.target = null
        m.vel = 0.3
        drum.setHighlight(null)
        drum.setDim(0)
        drum.setFlash(0)
        drum.repaintAll()
      }
      m.phase = st.phase
    }

    if (st.phase === 'spinning') {
      const top = st.reduced ? 2.5 : TOP_SPEED
      m.vel += (top - m.vel) * Math.min(1, dt * 1.8)
      m.pos += m.vel * dt
    } else if (st.phase === 'landing' && m.target !== null) {
      const el = t - m.landAt
      const end = m.target + (st.reduced ? 0 : OVERSHOOT)
      if (st.skip) {
        m.pos = m.target
        st.landed()
      } else if (el < m.dur) {
        const k = el / m.dur
        m.pos = end - (end - m.from) * (1 - k) ** 4
      } else {
        // Nudge past the winner, then roll back onto it.
        const k = clamp01((el - m.dur) / SETTLE_S)
        const e = k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2
        m.pos = end + (m.target - end) * e
        if (el > m.dur + SETTLE_S + HOLD_S) st.landed()
      }
    } else if (st.phase === 'idle') {
      m.pos += m.vel * dt
    }

    // A tick each time a row crosses the paylines.
    const crossed = Math.floor(m.pos + 0.5)
    if (crossed !== m.lastTick) {
      m.lastTick = crossed
      if (st.phase === 'spinning' || st.phase === 'landing') stageSound.tick()
    }

    drum.setPosition(m.pos)
    if (st.phase === 'revealed') {
      const k = clamp01((t - m.revealAt) / (st.reduced ? 0.01 : FLASH_S))
      drum.setFlash(st.reduced ? 0 : k)
      drum.setDim(clamp01((t - m.revealAt) / 0.35))
    }
    drum.render()
  })

  return (
    <div className="absolute inset-0">
      <div ref={hostRef} className="absolute inset-0" aria-hidden="true" />
      <AnimatePresence>
        {stage.phase === 'revealed' && stage.winner && (
          <motion.div
            key={stage.winner}
            className="absolute inset-x-0 flex justify-center text-center font-display font-extrabold text-gold"
            style={{ top: 600 - 170, height: 340, alignItems: 'center', textShadow: '0 0 40px rgba(224, 180, 92, 0.45)' }}
            initial={{ opacity: 0, transform: 'scale(0.9)' }}
            animate={{ opacity: 1, transform: 'scale(1)' }}
            exit={{ opacity: 0, transition: { duration: 0.2 } }}
            transition={{ type: 'spring', duration: 0.6, bounce: 0.3, delay: 0.12 }}
          >
            <FitName text={stage.winner} width={1640} maxSize={190} minSize={90} lineHeight={0.98} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
