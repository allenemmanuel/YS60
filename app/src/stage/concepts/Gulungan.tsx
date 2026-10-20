import { AnimatePresence, motion } from 'motion/react'
import { useMemo, useRef } from 'react'
import { shuffle } from '@/lib/random'
import { FitName } from '@/stage/FitName'
import { mod, useFrame, useLatest, type ConceptProps } from '@/stage/useFrame'

/** Concept 1: a big drum of names that spins, slows and clunks onto the winner. */

const SLOTS = 11 // rendered faces, centred on the payline
const HALF = Math.floor(SLOTS / 2)
const ROW_H = 128
const STEP = (21 * Math.PI) / 180 // angle between faces
const RADIUS = ROW_H / STEP
const CENTER_Y = 600
const TOP_SPEED = 15 // rows per second
const SETTLE_MS = 380

const rowFont = (name: string) => Math.min(100, Math.floor(1560 / (name.length * 0.44)))

export function Gulungan({ stage, names }: ConceptProps) {
  const seq = useMemo(() => shuffle(names), [names])
  const faces = useRef<(HTMLDivElement | null)[]>([])
  const labels = useRef<(HTMLSpanElement | null)[]>([])
  const s = useLatest(stage)
  const sim = useRef({
    pos: 0,
    vel: 0.35,
    target: null as number | null,
    landStart: 0,
    landFrom: 0,
    landDur: 0,
    settledAt: 0,
    phase: stage.phase,
  })

  useFrame((now, dt) => {
    const st = s.current
    const m = sim.current
    if (st.phase !== m.phase) {
      if (st.phase === 'landing') {
        // Ease-out cubic whose starting slope matches the current speed: distance = v·D/3.
        const dur = st.reduced ? 0.6 : 3.4
        const target = Math.ceil(m.pos + (Math.max(m.vel, 4) * dur) / 3)
        m.target = target
        m.landFrom = m.pos
        m.landStart = now
        m.landDur = (3 * (target - m.pos)) / Math.max(m.vel, 4)
        if (st.reduced) m.landDur = 0.6
      }
      if (st.phase === 'idle') {
        m.target = null
        m.vel = 0.35
      }
      m.phase = st.phase
    }

    if (st.phase === 'spinning') {
      const top = st.reduced ? 3 : TOP_SPEED
      m.vel += (top - m.vel) * Math.min(1, dt * 2.2)
      m.pos += m.vel * dt
    } else if (st.phase === 'landing' && m.target !== null) {
      const t = Math.min(1, (now - m.landStart) / 1000 / m.landDur)
      if (st.skip || t >= 1) {
        m.pos = m.target
        if (!m.settledAt) m.settledAt = now
        // Small mechanical settle, then reveal.
        if (st.skip || now - m.settledAt > SETTLE_MS) {
          m.settledAt = 0
          st.landed()
        } else {
          const k = (now - m.settledAt) / SETTLE_MS
          m.pos = m.target + 0.08 * Math.sin(k * Math.PI * 2) * (1 - k)
        }
      } else {
        m.pos = m.target - (m.target - m.landFrom) * (1 - t) ** 3
      }
    } else if (st.phase === 'idle') {
      m.pos += m.vel * dt
    }

    const base = Math.round(m.pos)
    const revealed = st.phase === 'revealed'
    for (let i = 0; i < SLOTS; i++) {
      const row = base + i - HALF
      const theta = (row - m.pos) * STEP
      const face = faces.current[i]
      const label = labels.current[i]
      if (!face || !label) continue
      const isWinnerRow = m.target !== null && row === m.target && st.winner
      const name = isWinnerRow ? st.winner! : seq[mod(row, seq.length)]
      if (label.textContent !== name) {
        label.textContent = name
        label.style.fontSize = `${rowFont(name)}px`
      }
      const visible = Math.abs(theta) < Math.PI / 2
      const y = RADIUS * Math.sin(theta)
      const z = RADIUS * (Math.cos(theta) - 1)
      face.style.transform = `translate3d(0, ${y}px, ${z}px) rotateX(${-theta}rad)`
      const light = visible ? Math.cos(theta) ** 3 : 0
      face.style.opacity = String(revealed ? (isWinnerRow ? 0 : light * 0.04) : light)
      face.style.color = Math.abs(theta) < STEP / 2 && st.phase !== 'spinning' ? 'var(--color-gold)' : ''
    }
  })

  return (
    <div className="absolute inset-0" aria-hidden={stage.phase !== 'revealed'}>
      <div
        className="absolute inset-x-0"
        style={{
          top: CENTER_Y - 400,
          height: 800,
          perspective: 1400,
        }}
      >
        {Array.from({ length: SLOTS }, (_, i) => (
          <div
            key={i}
            ref={(el) => {
              faces.current[i] = el
            }}
            className="absolute inset-x-0 flex items-center justify-center font-display font-bold text-diamond will-change-transform"
            style={{ top: 400 - ROW_H / 2, height: ROW_H, backfaceVisibility: 'hidden' }}
          >
            <span
              ref={(el) => {
                labels.current[i] = el
              }}
              className="whitespace-nowrap"
            />
          </div>
        ))}
      </div>

      {/* Payline: marks where the winning name stops. */}
      {[-1, 1].map((side) => (
        <div
          key={side}
          className="pointer-events-none absolute inset-x-[220px] h-px bg-gold/60 transition-opacity duration-300"
          style={{ top: CENTER_Y + side * (ROW_H / 2 + 4), opacity: stage.phase === 'revealed' ? 0 : 1 }}
        />
      ))}

      <AnimatePresence>
        {stage.phase === 'revealed' && stage.winner && (
          <motion.div
            key={stage.winner}
            className="absolute inset-x-0 flex justify-center text-center font-display font-extrabold text-gold"
            style={{ top: CENTER_Y - 170, height: 340, alignItems: 'center' }}
            initial={{ opacity: 0, transform: 'scale(0.94)' }}
            animate={{ opacity: 1, transform: 'scale(1)' }}
            exit={{ opacity: 0, transition: { duration: 0.2 } }}
            transition={{ type: 'spring', duration: 0.6, bounce: 0.25 }}
          >
            <FitName text={stage.winner} width={1640} maxSize={190} minSize={90} lineHeight={0.98} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
