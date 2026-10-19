import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useRef } from 'react'
import { FitName } from '@/stage/FitName'
import { STAGE_H, STAGE_W } from '@/stage/StageFrame'
import { clamp01, easeInOutCubic, easeOutCubic, useFrame, useLatest, type ConceptProps } from '@/stage/useFrame'

/** Concept 3: every guest is a star; the sky swirls, collapses into one point and bursts into the winner. */

const CX = STAGE_W / 2
const CY = 600
const MIN_STARS = 180

interface Star {
  name: string
  hx: number
  hy: number
  r: number
  tw: number
  ringA: number
  ringR: number
}

interface Label {
  star: number
  born: number
  x: number
  y: number
}

function makeStars(names: string[]): Star[] {
  const count = Math.max(MIN_STARS, names.length)
  return Array.from({ length: count }, (_, i) => {
    const a = Math.random() * Math.PI * 2
    const d = Math.sqrt(Math.random())
    return {
      name: names[i % names.length],
      hx: CX + Math.cos(a) * d * 980,
      hy: CY + Math.sin(a) * d * 560,
      r: 0.8 + Math.random() * 2.2,
      tw: Math.random() * Math.PI * 2,
      ringA: Math.random() * Math.PI * 2,
      ringR: 1 + Math.random() * 0.45,
    }
  })
}

export function Buruj({ stage, names }: ConceptProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stars = useMemo(() => makeStars(names), [names])
  const s = useLatest(stage)
  const sim = useRef({
    phase: stage.phase,
    phaseAt: 0,
    spin: 0, // accumulated rotation (rad)
    omega: 0.02, // rad/s
    contract: 0, // 0 = scattered, 1 = collapsed to the centre
    ring: 0, // 0 = home positions, 1 = ring around the winner
    burstAt: 0,
    labels: [] as Label[],
    nextLabel: 0,
  })

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d')
    if (ctx) {
      ctx.fillStyle = '#08162b'
      ctx.fillRect(0, 0, STAGE_W, STAGE_H)
    }
  }, [])

  useFrame((now, dt) => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const st = s.current
    const m = sim.current
    const reduced = st.reduced

    if (st.phase !== m.phase) {
      m.phase = st.phase
      m.phaseAt = now
      if (st.phase === 'landing') m.burstAt = 0
    }
    const since = (now - m.phaseAt) / 1000

    // Drive the scalar parameters per phase.
    if (st.phase === 'idle') {
      m.omega += (0.02 - m.omega) * dt * 2
      m.contract += (0 - m.contract) * dt * 3
      m.ring += (0 - m.ring) * dt * 2
    } else if (st.phase === 'spinning') {
      m.omega += ((reduced ? 0.05 : 1.5) - m.omega) * dt * 1.2
      m.ring = 0
    } else if (st.phase === 'landing') {
      const dur = reduced ? 0.5 : 2.3
      const k = clamp01(since / dur)
      m.contract = easeInOutCubic(k)
      m.omega = (reduced ? 0.05 : 1.5) + k * (reduced ? 0 : 3)
      if ((k >= 1 || st.skip) && !m.burstAt) {
        m.burstAt = now
        m.contract = 1
        st.landed()
      }
    } else if (st.phase === 'revealed') {
      const k = easeOutCubic(clamp01(since / (reduced ? 0.4 : 1.8)))
      m.contract = 1 - k
      m.ring = k
      m.omega += (0.03 - m.omega) * dt * 2
    }
    m.spin += m.omega * dt

    // Trails while spinning; clean frames otherwise.
    const trail = st.phase === 'spinning' || st.phase === 'landing' ? (reduced ? 1 : 0.22) : 1
    ctx.globalCompositeOperation = 'source-over'
    ctx.fillStyle = `rgba(8, 22, 43, ${trail})`
    ctx.fillRect(0, 0, STAGE_W, STAGE_H)

    const t = now / 1000
    const pos: [number, number][] = new Array(stars.length)
    for (let i = 0; i < stars.length; i++) {
      const st0 = stars[i]
      const dx = st0.hx - CX
      const dy = (st0.hy - CY) * 1.75 // treat the ellipse as a circle while rotating
      const dist = Math.hypot(dx, dy)
      const a0 = Math.atan2(dy, dx)
      // Inner stars turn faster: a gentle vortex.
      const a = a0 + m.spin * (1.4 - Math.min(1, dist / 1100) * 0.8)
      const rr = dist * (1 - m.contract)
      let x = CX + Math.cos(a) * rr
      let y = CY + (Math.sin(a) * rr) / 1.75
      if (m.ring > 0) {
        const ra = st0.ringA + m.spin * 0.3
        const rx = CX + Math.cos(ra) * 660 * st0.ringR
        const ry = CY + Math.sin(ra) * 290 * st0.ringR
        x = x + (rx - x) * m.ring
        y = y + (ry - y) * m.ring
      }
      if (st.phase === 'idle') {
        x += Math.sin(t * 0.3 + st0.tw) * 6
        y += Math.cos(t * 0.25 + st0.tw) * 4
      }
      pos[i] = [x, y]
    }

    // Constellation lines between near neighbours, only while suspense builds.
    if (st.phase === 'spinning' && !reduced) {
      ctx.strokeStyle = 'rgba(169, 214, 245, 0.10)'
      ctx.lineWidth = 1
      ctx.beginPath()
      for (let i = 0; i < stars.length; i += 3) {
        const j = (i * 7 + 11) % stars.length
        const [x1, y1] = pos[i]
        const [x2, y2] = pos[j]
        if (Math.hypot(x1 - x2, y1 - y2) < 220) {
          ctx.moveTo(x1, y1)
          ctx.lineTo(x2, y2)
        }
      }
      ctx.stroke()
    }

    ctx.globalCompositeOperation = 'lighter'
    for (let i = 0; i < stars.length; i++) {
      const st0 = stars[i]
      const [x, y] = pos[i]
      const twinkle = 0.55 + 0.45 * Math.sin(t * 2 + st0.tw)
      const r = st0.r * (1 + m.contract * 0.6)
      ctx.fillStyle = `rgba(243, 248, 252, ${0.35 + 0.6 * twinkle})`
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
    }

    // A few names flicker beside their stars during the spin.
    if (st.phase === 'spinning' && !reduced) {
      if (now > m.nextLabel) {
        const star = Math.floor(Math.random() * stars.length)
        const [lx, ly] = pos[star]
        // Keep labels clear of the prize title and footer.
        if (ly > 300 && ly < 960 && lx < STAGE_W - 520) m.labels.push({ star, born: now, x: lx, y: ly })
        m.nextLabel = now + 260
      }
      m.labels = m.labels.filter((l) => now - l.born < 1400)
      ctx.globalCompositeOperation = 'source-over'
      ctx.font = '600 30px "Manrope Variable", sans-serif'
      for (const l of m.labels) {
        const age = (now - l.born) / 1400
        ctx.fillStyle = `rgba(169, 214, 245, ${Math.sin(age * Math.PI) * 0.3})`
        ctx.fillText(stars[l.star].name, l.x + 10, l.y - 10)
      }
    } else {
      m.labels = []
    }

    // Collapse glow and burst.
    if (m.contract > 0.02) {
      const g = ctx.createRadialGradient(CX, CY, 0, CX, CY, 60 + 220 * m.contract)
      g.addColorStop(0, `rgba(243, 248, 252, ${0.5 * m.contract})`)
      g.addColorStop(1, 'rgba(29, 91, 168, 0)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, STAGE_W, STAGE_H)
    }
    if (m.burstAt && !reduced) {
      const k = (now - m.burstAt) / 900
      if (k < 1) {
        const radius = 40 + easeOutCubic(k) * 1100
        ctx.strokeStyle = `rgba(224, 180, 92, ${0.8 * (1 - k)})`
        ctx.lineWidth = 6 * (1 - k) + 1
        ctx.beginPath()
        ctx.ellipse(CX, CY, radius, radius * 0.45, 0, 0, Math.PI * 2)
        ctx.stroke()
        ctx.fillStyle = `rgba(243, 248, 252, ${0.55 * (1 - k) ** 2})`
        ctx.fillRect(0, 0, STAGE_W, STAGE_H)
      }
    }
    ctx.globalCompositeOperation = 'source-over'
  })

  return (
    <div className="absolute inset-0">
      <canvas ref={canvasRef} width={STAGE_W} height={STAGE_H} className="absolute inset-0" aria-hidden="true" />
      <AnimatePresence>
        {stage.phase === 'revealed' && stage.winner && (
          <motion.div
            key={stage.winner}
            className="absolute inset-x-0 flex items-center justify-center text-center font-serif font-semibold text-diamond"
            style={{ top: 600 - 170, height: 340, fontVariationSettings: '"opsz" 144', textShadow: '0 0 40px rgba(29, 91, 168, 0.9)' }}
            initial={{ opacity: 0, transform: 'scale(0.96)', filter: 'blur(10px)' }}
            animate={{ opacity: 1, transform: 'scale(1)', filter: 'blur(0px)' }}
            exit={{ opacity: 0, transition: { duration: 0.2 } }}
            transition={{ duration: 0.7, ease: [0.23, 1, 0.32, 1] }}
          >
            <FitName text={stage.winner} width={1600} maxSize={190} minSize={90} lineHeight={1.04} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
