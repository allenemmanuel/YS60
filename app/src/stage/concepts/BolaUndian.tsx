import { AnimatePresence, motion } from 'motion/react'
import { useRef } from 'react'
import { shuffle } from '@/lib/random'
import { FitName } from '@/stage/FitName'
import { stageSound } from '@/stage/sound'
import { STAGE_H, STAGE_W } from '@/stage/StageFrame'
import { clamp01, easeInOutCubic, easeOutCubic, useFrame, useLatest, type ConceptProps } from '@/stage/useFrame'

/** Concept: a glass lottery drum of tumbling balls; one pops out of the top and opens into the winner's name. */

const CX = 960
const CY = 650
const R = 330
const BALL_R = 40
const COUNT = 34
const GRAVITY = 1500
const EXIT = { x: CX, y: 262 }
const STAGE_POINT = { x: CX, y: 600 }
const PALETTE = [
  { fill: '#f3f8fc', text: '#08162b' },
  { fill: '#a9d6f5', text: '#08162b' },
  { fill: '#e0b45c', text: '#08162b' },
  { fill: '#1d5ba8', text: '#f3f8fc' },
]

interface Ball {
  x: number
  y: number
  vx: number
  vy: number
  label: string
  color: number
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter((w) => !/^(bin|binti|a\/l|a\/p|bt|b\.)$/i.test(w))
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')

function makeBalls(names: string[]): Ball[] {
  const list = shuffle(names)
  return Array.from({ length: COUNT }, (_, i) => {
    const a = (i / COUNT) * Math.PI * 2
    const d = R * 0.6 * Math.sqrt((i % 7) / 7 + 0.1)
    return { x: CX + Math.cos(a) * d, y: CY + Math.sin(a) * d, vx: 0, vy: 0, label: initials(list[i % list.length]), color: i % PALETTE.length }
  })
}

export function BolaUndian({ stage, names }: ConceptProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const s = useLatest(stage)
  const namesRef = useLatest(names)
  const sim = useRef({ balls: null as Ball[] | null, phase: '', phaseAt: 0, stir: 0, drum: 0, winner: -1, fade: 0, burstAt: 0, wx: 0, wy: 0, wr: BALL_R })

  useFrame((now, dtRaw) => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const st = s.current
    const m = sim.current
    m.balls ??= makeBalls(namesRef.current)
    const balls = m.balls
    const reduced = st.reduced
    if (st.phase !== m.phase) {
      m.phase = st.phase
      m.phaseAt = now
      if (st.phase === 'landing' && st.winner) {
        // The ball nearest the top is the one that leaves through the chute.
        let best = 0
        balls.forEach((b, i) => {
          if (b.y < balls[best].y) best = i
        })
        m.winner = best
        balls[best].label = initials(st.winner)
        m.wx = balls[best].x
        m.wy = balls[best].y
      }
      if (st.phase === 'idle') {
        m.winner = -1
        m.burstAt = 0
      }
    }
    const since = (now - m.phaseAt) / 1000

    // Stirring paddles: strong while spinning, easing off as the ball is drawn.
    const stirTarget = reduced ? 0 : st.phase === 'spinning' ? 1 : st.phase === 'landing' ? 0.35 : 0.04
    m.stir += (stirTarget - m.stir) * Math.min(1, dtRaw * 2)
    m.drum += m.stir * 3 * dtRaw
    m.fade += ((st.phase === 'revealed' ? 1 : st.phase === 'landing' ? clamp01((since - 1.1) / 1) : 0) - m.fade) * Math.min(1, dtRaw * 6)

    // Physics in two substeps for stable collisions.
    if (!reduced) {
      const dt = dtRaw / 2
      for (let step = 0; step < 2; step++) {
        for (let i = 0; i < balls.length; i++) {
          if (i === m.winner) continue
          const b = balls[i]
          b.vy += GRAVITY * dt
          // Paddle force: swirl around the centre plus a lift from below.
          const dx = b.x - CX
          const dy = b.y - CY
          // Paddles kick balls up from the bottom of the drum; a gentle swirl keeps them turning over.
          const low = Math.max(0, dy / R)
          b.vx += (-dy / R) * 700 * m.stir * dt + (Math.random() - 0.5) * 5200 * m.stir * dt
          b.vy += (dx / R) * 700 * m.stir * dt - (900 + 5200 * low * Math.random()) * m.stir * dt
          b.x += b.vx * dt
          b.y += b.vy * dt
          const dist = Math.hypot(dx, dy)
          const max = R - BALL_R
          if (dist > max) {
            const nx = dx / dist
            const ny = dy / dist
            b.x = CX + nx * max
            b.y = CY + ny * max
            const vn = b.vx * nx + b.vy * ny
            if (vn > 0) {
              b.vx -= 1.8 * vn * nx
              b.vy -= 1.8 * vn * ny
            }
          }
        }
        for (let i = 0; i < balls.length; i++) {
          if (i === m.winner) continue
          for (let j = i + 1; j < balls.length; j++) {
            if (j === m.winner) continue
            const a = balls[i]
            const b = balls[j]
            const dx = b.x - a.x
            const dy = b.y - a.y
            const d = Math.hypot(dx, dy) || 0.01
            if (d < BALL_R * 2) {
              const nx = dx / d
              const ny = dy / d
              const push = (BALL_R * 2 - d) / 2
              a.x -= nx * push
              a.y -= ny * push
              b.x += nx * push
              b.y += ny * push
              const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny
              if (rel < 0) {
                const imp = -rel * 0.92
                a.vx -= imp * nx
                a.vy -= imp * ny
                b.vx += imp * nx
                b.vy += imp * ny
                if (-rel > 700) stageSound.tick()
              }
            }
          }
        }
      }
    }

    // The drawn ball: up through the chute, then forward to centre stage, growing.
    if (m.winner >= 0) {
      const w = balls[m.winner]
      if (st.phase === 'landing') {
        const total = reduced ? 0.4 : 2.4
        const k = st.skip ? 1 : clamp01(since / total)
        const k1 = clamp01(k / 0.45)
        const k2 = clamp01((k - 0.45) / 0.55)
        if (k < 0.45) {
          const e = easeInOutCubic(k1)
          w.x = m.wx + (EXIT.x - m.wx) * e
          w.y = m.wy + (EXIT.y - m.wy) * e
          m.wr = BALL_R
        } else {
          const e = easeOutCubic(k2)
          w.x = EXIT.x + (STAGE_POINT.x - EXIT.x) * e
          w.y = EXIT.y + (STAGE_POINT.y - EXIT.y) * e
          m.wr = BALL_R + (190 - BALL_R) * e
        }
        if (k >= 1) {
          m.burstAt = now
          st.landed()
        }
      }
    }

    // --- draw ---
    ctx.clearRect(0, 0, STAGE_W, STAGE_H)
    const drumAlpha = 1 - m.fade * 0.93
    ctx.globalAlpha = drumAlpha

    // Stand.
    ctx.fillStyle = '#0d2244'
    ctx.beginPath()
    ctx.moveTo(CX - 120, CY + R - 10)
    ctx.lineTo(CX + 120, CY + R - 10)
    ctx.lineTo(CX + 200, CY + R + 90)
    ctx.lineTo(CX - 200, CY + R + 90)
    ctx.closePath()
    ctx.fill()

    // Chute.
    ctx.strokeStyle = 'rgba(169, 214, 245, 0.35)'
    ctx.lineWidth = 3
    ctx.strokeRect(CX - BALL_R - 8, EXIT.y - BALL_R, BALL_R * 2 + 16, CY - R - EXIT.y + BALL_R + 6)

    // Glass.
    const glass = ctx.createRadialGradient(CX - 110, CY - 140, 20, CX, CY, R)
    glass.addColorStop(0, 'rgba(169, 214, 245, 0.16)')
    glass.addColorStop(1, 'rgba(29, 91, 168, 0.10)')
    ctx.fillStyle = glass
    ctx.beginPath()
    ctx.arc(CX, CY, R, 0, Math.PI * 2)
    ctx.fill()

    for (let i = 0; i < balls.length; i++) if (i !== m.winner) drawBall(ctx, balls[i], BALL_R)

    // Turning hoops of the drum, drawn over the balls.
    ctx.strokeStyle = 'rgba(169, 214, 245, 0.45)'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(CX, CY, R, 0, Math.PI * 2)
    ctx.stroke()
    ctx.strokeStyle = 'rgba(224, 180, 92, 0.35)'
    ctx.lineWidth = 2
    for (let k = 0; k < 3; k++) {
      const a = m.drum + (k * Math.PI) / 3
      ctx.beginPath()
      ctx.ellipse(CX, CY, Math.abs(Math.cos(a)) * R, R, 0, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)'
    ctx.lineWidth = 6
    ctx.beginPath()
    ctx.arc(CX, CY, R - 22, Math.PI * 1.1, Math.PI * 1.35)
    ctx.stroke()

    ctx.globalAlpha = 1
    if (m.winner >= 0 && st.phase !== 'revealed') drawBall(ctx, balls[m.winner], m.wr)

    // Burst when the ball opens.
    if (m.burstAt) {
      const k = (now - m.burstAt) / 700
      if (k < 1 && !reduced) {
        ctx.strokeStyle = `rgba(224, 180, 92, ${1 - k})`
        ctx.lineWidth = 8 * (1 - k) + 1
        ctx.beginPath()
        ctx.arc(STAGE_POINT.x, STAGE_POINT.y, 190 + easeOutCubic(k) * 700, 0, Math.PI * 2)
        ctx.stroke()
      }
    }
  })

  return (
    <div className="absolute inset-0">
      <canvas ref={canvasRef} width={STAGE_W} height={STAGE_H} className="absolute inset-0" aria-hidden="true" />
      <AnimatePresence>
        {stage.phase === 'revealed' && stage.winner && (
          <motion.div
            key={stage.winner}
            className="absolute inset-x-0 flex items-center justify-center text-center font-display font-extrabold text-gold"
            style={{ top: 600 - 170, height: 340 }}
            initial={{ opacity: 0, transform: 'scale(0.9)' }}
            animate={{ opacity: 1, transform: 'scale(1)' }}
            exit={{ opacity: 0, transition: { duration: 0.2 } }}
            transition={{ type: 'spring', duration: 0.55, bounce: 0.3 }}
          >
            <FitName text={stage.winner} width={1640} maxSize={190} minSize={90} lineHeight={0.98} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function drawBall(ctx: CanvasRenderingContext2D, b: Ball, r: number) {
  const c = PALETTE[b.color]
  const g = ctx.createRadialGradient(b.x - r * 0.35, b.y - r * 0.4, r * 0.1, b.x, b.y, r)
  g.addColorStop(0, '#ffffff')
  g.addColorStop(0.35, c.fill)
  g.addColorStop(1, shade(c.fill))
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(b.x, b.y, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = c.text
  ctx.font = `800 ${Math.round(r * 0.8)}px "Barlow Condensed", sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(b.label, b.x, b.y + r * 0.04)
}

function shade(hex: string): string {
  const n = parseInt(hex.slice(1), 16)
  const f = (v: number) => Math.round(v * 0.62)
  return `rgb(${f(n >> 16)}, ${f((n >> 8) & 255)}, ${f(n & 255)})`
}
