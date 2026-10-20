import { AnimatePresence, motion } from 'motion/react'
import { useMemo, useRef, useState } from 'react'
import { shuffle } from '@/lib/random'
import { FitName } from '@/stage/FitName'
import { stageSound } from '@/stage/sound'
import { mod, useFrame, useLatest, type ConceptProps } from '@/stage/useFrame'

/** Concept: a giant prize wheel rising from the bottom of the screen; it ticks past the pointer and stops on the winner. */

const SEGMENTS = 40
const SEG = 360 / SEGMENTS
const CX = 960
const CY = 1170
const R = 800
const HUB = 210
const WHEEL_BOX = (R + 30) * 2
const POINTER_ANGLE = -90 // straight up, in SVG degrees
const TOP_SPEED = 260 // degrees per second

function wedge(i: number): string {
  const a0 = ((i * SEG - SEG / 2) * Math.PI) / 180
  const a1 = ((i * SEG + SEG / 2) * Math.PI) / 180
  const p = (r: number, a: number) => `${(r * Math.cos(a)).toFixed(1)} ${(r * Math.sin(a)).toFixed(1)}`
  return `M ${p(HUB, a0)} L ${p(R, a0)} A ${R} ${R} 0 0 1 ${p(R, a1)} L ${p(HUB, a1)} A ${HUB} ${HUB} 0 0 0 ${p(HUB, a0)} Z`
}

const labelSize = (name: string) => Math.min(34, Math.floor(560 / (name.length * 0.46)))

export function Roda({ stage, names }: ConceptProps) {
  const [labels, setLabels] = useState(() => shuffle(names).slice(0, SEGMENTS))
  const [winnerSeg, setWinnerSeg] = useState(-1)
  const wheelRef = useRef<HTMLDivElement>(null)
  const pointerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<HTMLDivElement>(null)
  const s = useLatest(stage)
  const sim = useRef({ phase: '', angle: 0, vel: 6, target: 0, from: 0, landAt: 0, landDur: 0, lastSeg: 0, winnerSeg: -1, settleAt: 0 })
  const wedges = useMemo(() => Array.from({ length: SEGMENTS }, (_, i) => wedge(i)), [])

  useFrame((now, dt) => {
    const st = s.current
    const m = sim.current
    if (st.phase !== m.phase) {
      m.phase = st.phase
      if (st.phase === 'landing' && st.winner) {
        const v = Math.max(m.vel, 60)
        const dur = st.reduced ? 0.6 : 4.2
        // Ease-out cubic matching the current speed travels v·D/3, then snap to a segment centre under the pointer.
        const rough = m.angle + (v * dur) / 3
        const segUnder = Math.round(mod(POINTER_ANGLE - rough, 360) / SEG) % SEGMENTS
        const target = rough + mod(POINTER_ANGLE - segUnder * SEG - rough, 360)
        m.winnerSeg = segUnder
        m.from = m.angle
        m.target = target
        m.landAt = now
        m.landDur = st.reduced ? 0.6 : (3 * (target - m.angle)) / v
        m.settleAt = 0
        setLabels((l) => l.map((n, i) => (i === segUnder ? st.winner! : n)))
        setWinnerSeg(segUnder)
      }
      if (st.phase === 'idle' && m.winnerSeg >= 0) {
        m.winnerSeg = -1
        setLabels(shuffle(names).slice(0, SEGMENTS))
        setWinnerSeg(-1)
      }
    }

    if (st.phase === 'spinning') {
      const top = st.reduced ? 30 : TOP_SPEED
      m.vel += (top - m.vel) * Math.min(1, dt * 1.6)
      m.angle += m.vel * dt
    } else if (st.phase === 'landing') {
      const t = Math.min(1, (now - m.landAt) / 1000 / m.landDur)
      if (st.skip || t >= 1) {
        m.angle = m.target
        m.vel = 0
        if (!m.settleAt) m.settleAt = now
        if (st.skip || now - m.settleAt > 450) st.landed()
      } else {
        m.angle = m.target - (m.target - m.from) * (1 - t) ** 3
        m.vel = (3 * (m.target - m.from) * (1 - t) ** 2) / m.landDur
      }
    } else if (st.phase === 'idle') {
      m.vel += (6 - m.vel) * Math.min(1, dt)
      m.angle += m.vel * dt
    }

    if (wheelRef.current) wheelRef.current.style.transform = `rotate(${m.angle}deg)`

    // Tick and flick the pointer each time a peg passes it.
    const seg = Math.floor((m.angle - POINTER_ANGLE + SEG / 2) / SEG)
    if (seg !== m.lastSeg) {
      m.lastSeg = seg
      if (st.phase === 'spinning' || st.phase === 'landing') stageSound.tick()
      const p = pointerRef.current
      if (p && !st.reduced) {
        p.animate([{ transform: 'rotate(-14deg)' }, { transform: 'rotate(0deg)' }], { duration: Math.max(90, Math.min(260, 2600 / Math.max(m.vel, 1))), easing: 'cubic-bezier(0.23, 1, 0.32, 1)' })
      }
    }
  })

  const revealed = stage.phase === 'revealed'

  return (
    <div className="absolute inset-0">
      <div
        ref={sceneRef}
        className="absolute inset-0 transition-[transform,opacity] duration-700 ease-[cubic-bezier(0.23,1,0.32,1)]"
        style={{ transform: revealed ? 'translateY(720px)' : 'translateY(0px)', opacity: revealed ? 0.3 : 1 }}
      >
        <svg width="1920" height="1080" viewBox="0 0 1920 1080" className="absolute inset-0" aria-hidden="true">
          <defs>
            <radialGradient id="roda-glow" cx="50%" cy="100%" r="70%">
              <stop offset="0%" stopColor="#1d5ba8" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#08162b" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect x="0" y="300" width="1920" height="780" fill="url(#roda-glow)" />
        </svg>
        {/* The wheel is drawn once and rotated as a whole by the compositor (CSS transform), not re-rendered per frame. */}
        <div
          ref={wheelRef}
          className="absolute will-change-transform"
          style={{ left: CX - WHEEL_BOX / 2, top: CY - WHEEL_BOX / 2, width: WHEEL_BOX, height: WHEEL_BOX }}
        >
          <svg width={WHEEL_BOX} height={WHEEL_BOX} viewBox={`${-WHEEL_BOX / 2} ${-WHEEL_BOX / 2} ${WHEEL_BOX} ${WHEEL_BOX}`} aria-hidden="true">
            <circle r={R + 18} fill="#040c19" stroke="#e0b45c" strokeWidth="6" />
            {wedges.map((d, i) => (
              <path
                key={i}
                d={d}
                fill={revealed && i === winnerSeg ? '#e0b45c' : i % 2 ? '#0f2a4d' : '#163a6b'}
                stroke="rgba(224, 180, 92, 0.55)"
                strokeWidth="2"
              />
            ))}
            {labels.map((name, i) => (
              <text
                key={i}
                transform={`rotate(${i * SEG})`}
                x={R - 36}
                y={0}
                textAnchor="end"
                dominantBaseline="central"
                fill={revealed && i === winnerSeg ? '#08162b' : '#f3f8fc'}
                style={{ font: `700 ${labelSize(name)}px var(--font-display)` }}
              >
                {name}
              </text>
            ))}
            {Array.from({ length: SEGMENTS }, (_, i) => {
              const a = ((i * SEG + SEG / 2) * Math.PI) / 180
              return <circle key={i} cx={(R + 2) * Math.cos(a)} cy={(R + 2) * Math.sin(a)} r="7" fill="#f3f8fc" />
            })}
            <circle r={HUB} fill="#08162b" stroke="#e0b45c" strokeWidth="5" />
            <text textAnchor="middle" dominantBaseline="central" fill="#e0b45c" style={{ font: '800 150px var(--font-display)' }}>
              60
            </text>
          </svg>
        </div>
        <div
          ref={pointerRef}
          className="absolute will-change-transform"
          style={{ left: CX - 40, top: CY - R - 90, width: 80, height: 90, transformOrigin: '40px 10px' }}
        >
          <svg width="80" height="90" viewBox="-40 -50 80 90" aria-hidden="true">
            <path d="M -30 -40 L 30 -40 L 0 34 Z" fill="#e0b45c" stroke="#040c19" strokeWidth="4" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      <AnimatePresence>
        {revealed && stage.winner && (
          <motion.div
            key={stage.winner}
            className="absolute inset-x-0 flex items-center justify-center text-center font-display font-extrabold text-gold"
            style={{ top: 560 - 170, height: 340 }}
            initial={{ opacity: 0, transform: 'translateY(40px) scale(0.94)' }}
            animate={{ opacity: 1, transform: 'translateY(0px) scale(1)' }}
            exit={{ opacity: 0, transition: { duration: 0.2 } }}
            transition={{ type: 'spring', duration: 0.6, bounce: 0.2, delay: 0.15 }}
          >
            <FitName text={stage.winner} width={1640} maxSize={190} minSize={90} lineHeight={0.98} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
