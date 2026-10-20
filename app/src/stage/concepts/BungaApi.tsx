import { useEffect, useRef } from 'react'
import { stageSound } from '@/stage/sound'
import { STAGE_H, STAGE_W } from '@/stage/StageFrame'
import { clamp01, easeInOutCubic, useFrame, useLatest, useStageCanvas, type ConceptProps } from '@/stage/useFrame'

/** Concept: fireworks build up; one big rocket bursts and its sparks gather into the winner's name. */

const TEXT_Y = 600
const TEXT_W = 1640
const FONT = '"Barlow Condensed", sans-serif'
const COLORS = ['#e0b45c', '#a9d6f5', '#f3f8fc', '#c8102e', '#5aa0e6']
const MAX_SPARKS = 1600
const ALPHA_LEVELS = 4

interface Spark {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  max: number
  color: string
  // When set, the spark is pulled onto this point of the winner's name.
  tx?: number
  ty?: number
  ox?: number
  oy?: number
}

interface Rocket {
  x: number
  y: number
  vx: number
  vy: number
  burstY: number
  color: string
  big: boolean
}

interface TextLayout {
  lines: string[]
  size: number
}

/** Largest font size (≤190px) at which the name fits TEXT_W in at most two lines. */
function layoutText(ctx: CanvasRenderingContext2D, text: string): TextLayout {
  const words = text.split(/\s+/)
  for (let size = 190; size >= 70; size -= 4) {
    ctx.font = `800 ${size}px ${FONT}`
    const lines: string[] = []
    for (const w of words) {
      const last = lines[lines.length - 1]
      if (last !== undefined && ctx.measureText(`${last} ${w}`).width <= TEXT_W) lines[lines.length - 1] = `${last} ${w}`
      else lines.push(w)
    }
    if (lines.length <= 2 && lines.every((l) => ctx.measureText(l).width <= TEXT_W)) {
      // Prefer balanced lines for two-line names.
      if (lines.length === 2) return { lines: balance(ctx, words), size }
      return { lines, size }
    }
  }
  return { lines: [text], size: 70 }
}

function balance(ctx: CanvasRenderingContext2D, words: string[]): string[] {
  let best = [words.join(' ')]
  let bestDiff = Infinity
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' ')
    const b = words.slice(i).join(' ')
    const wa = ctx.measureText(a).width
    const wb = ctx.measureText(b).width
    if (wa <= TEXT_W && wb <= TEXT_W && Math.abs(wa - wb) < bestDiff) {
      bestDiff = Math.abs(wa - wb)
      best = [a, b]
    }
  }
  return best
}

function drawText(ctx: CanvasRenderingContext2D, layout: TextLayout) {
  ctx.font = `800 ${layout.size}px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const lh = layout.size * 0.98
  const top = TEXT_Y - ((layout.lines.length - 1) * lh) / 2
  layout.lines.forEach((l, i) => ctx.fillText(l, STAGE_W / 2, top + i * lh))
}

/** Points inside the rendered name, used as targets for the sparks. */
function samplePoints(layout: TextLayout): [number, number][] {
  // Half resolution is plenty for spark targets and four times cheaper to read back.
  const W = STAGE_W / 2
  const H = STAGE_H / 2
  const off = document.createElement('canvas')
  off.width = W
  off.height = H
  const octx = off.getContext('2d', { willReadFrequently: true })!
  octx.scale(0.5, 0.5)
  octx.fillStyle = '#fff'
  drawText(octx, layout)
  const data = octx.getImageData(0, 0, W, H).data
  for (let step = 3; ; step++) {
    const pts: [number, number][] = []
    for (let y = 0; y < H; y += step) for (let x = 0; x < W; x += step) if (data[(y * W + x) * 4 + 3] > 128) pts.push([x * 2, y * 2])
    if (pts.length <= MAX_SPARKS || step > 8) return pts
  }
}

/** The glowing name, drawn once (shadowBlur is too expensive to repeat every frame). */
function renderName(layout: TextLayout): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = STAGE_W
  c.height = STAGE_H
  const cctx = c.getContext('2d')!
  cctx.fillStyle = '#e0b45c'
  cctx.shadowColor = 'rgba(224, 180, 92, 0.6)'
  cctx.shadowBlur = 30
  drawText(cctx, layout)
  return c
}

export function BungaApi({ stage }: ConceptProps) {
  const { ref: canvasRef, getCtx } = useStageCanvas()
  const s = useLatest(stage)
  const sim = useRef({
    phase: '',
    phaseAt: 0,
    sparks: [] as Spark[],
    rockets: [] as Rocket[],
    nextLaunch: 0,
    finale: null as null | { layout: TextLayout; points: [number, number][]; image: HTMLCanvasElement; burstAt: number; launched: boolean },
    textAlpha: 0,
  })

  // Canvas text measures with a fallback font until the real one is loaded.
  useEffect(() => {
    void document.fonts.load(`800 100px ${FONT}`)
  }, [])

  const burst = (m: typeof sim.current, x: number, y: number, color: string, n: number, speed: number) => {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2
      const v = speed * (0.4 + Math.random() * 0.6)
      m.sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: 0.9 + Math.random() * 0.7, color: Math.random() < 0.8 ? color : '#f3f8fc' })
    }
  }

  const launch = (m: typeof sim.current, big = false) => {
    const x = big ? STAGE_W / 2 : 260 + Math.random() * (STAGE_W - 520)
    const burstY = big ? TEXT_Y : 260 + Math.random() * 380
    m.rockets.push({ x, y: STAGE_H + 10, vx: big ? 0 : (Math.random() - 0.5) * 120, vy: big ? -1350 : -1100 - Math.random() * 300, burstY, color: COLORS[Math.floor(Math.random() * COLORS.length)], big })
  }

  useFrame((now, dt) => {
    const ctx = getCtx()
    if (!ctx) return
    const st = s.current
    const m = sim.current
    const reduced = st.reduced

    if (st.phase !== m.phase) {
      m.phase = st.phase
      m.phaseAt = now
      if (st.phase === 'landing' && st.winner) {
        // Prepare the name's spark targets and glow image now, while the rocket climbs, not at the burst.
        const layout = layoutText(ctx, st.winner)
        m.finale = { layout, points: samplePoints(layout), image: renderName(layout), burstAt: 0, launched: false }
      }
      if (st.phase === 'idle') {
        m.finale = null
        m.textAlpha = 0
      }
    }

    // Launch schedule.
    if (!reduced && now > m.nextLaunch) {
      if (st.phase === 'spinning') {
        launch(m)
        m.nextLaunch = now + 260 + Math.random() * 260
      } else if (st.phase === 'revealed' && now - m.phaseAt < 4000) {
        launch(m)
        m.nextLaunch = now + 700 + Math.random() * 500
      }
    }

    const f = m.finale
    if (st.phase === 'landing' && f) {
      if (reduced || st.skip) {
        if (!f.burstAt) f.burstAt = now
        m.sparks = []
        m.rockets = []
        m.textAlpha = 1
        st.landed()
      } else if (!f.launched && now - m.phaseAt > 300) {
        f.launched = true
        launch(m, true)
      }
    }

    // Rockets.
    for (const r of m.rockets) {
      r.x += r.vx * dt
      r.y += r.vy * dt
      r.vy += 380 * dt
      m.sparks.push({ x: r.x, y: r.y + 8, vx: (Math.random() - 0.5) * 40, vy: 60, life: 0, max: 0.35, color: '#e0b45c' })
    }
    const exploded = m.rockets.filter((r) => r.y <= r.burstY || r.vy >= 0)
    m.rockets = m.rockets.filter((r) => !(r.y <= r.burstY || r.vy >= 0))
    for (const r of exploded) {
      if (r.big && f) {
        f.burstAt = now
        stageSound.boom(0.9)
        for (const [tx, ty] of f.points) {
          const a = Math.random() * Math.PI * 2
          const v = 300 + Math.random() * 900
          m.sparks.push({ x: r.x, y: r.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: 99, color: Math.random() < 0.75 ? '#e0b45c' : '#f3f8fc', tx, ty, ox: r.x, oy: r.y })
        }
      } else {
        stageSound.boom(0.3)
        burst(m, r.x, r.y, r.color, 110, 520)
      }
    }

    // Finale timing: sparks fly out, then gather onto the name.
    let gather = 0
    if (f?.burstAt) {
      const t = (now - f.burstAt) / 1000
      gather = easeInOutCubic(clamp01((t - 0.35) / 1.4))
      if (st.phase === 'landing' && t > 1.85) st.landed()
    }
    if (st.phase === 'revealed') m.textAlpha = Math.min(1, m.textAlpha + dt * 1.6)

    // --- draw ---
    ctx.globalCompositeOperation = 'source-over'
    ctx.clearRect(0, 0, STAGE_W, STAGE_H)
    ctx.globalCompositeOperation = 'lighter'
    ctx.lineCap = 'round'

    // Sparks are batched by colour and brightness: a few strokes per frame instead of one per spark.
    const streaks = new Map<string, Path2D>()
    const dots = new Map<string, Path2D>()
    const bucket = (map: Map<string, Path2D>, key: string) => {
      let path = map.get(key)
      if (!path) map.set(key, (path = new Path2D()))
      return path
    }
    const alive: Spark[] = []
    for (const p of m.sparks) {
      p.life += dt
      if (p.tx !== undefined) {
        // Ballistic path blended into the target point.
        p.ox! += p.vx * dt
        p.oy! += p.vy * dt
        p.vx *= 0.94
        p.vy = p.vy * 0.94 + 160 * dt
        p.x = p.ox! + (p.tx - p.ox!) * gather
        p.y = p.oy! + (p.ty! - p.oy!) * gather
        if (st.phase === 'revealed' && m.textAlpha >= 1 && Math.random() < 0.04) continue
      } else {
        p.vy += 420 * dt
        p.vx *= 0.985
        p.vy *= 0.985
        p.x += p.vx * dt
        p.y += p.vy * dt
        if (p.life > p.max) continue
      }
      alive.push(p)
      const a = p.tx !== undefined ? 0.9 * (1 - m.textAlpha * 0.7) : 1 - p.life / p.max
      const level = Math.max(0, Math.min(ALPHA_LEVELS - 1, Math.round(a * (ALPHA_LEVELS - 1))))
      const key = `${p.color}|${level}`
      if (p.tx !== undefined && gather > 0.6) {
        bucket(dots, key).rect(p.x - 1.5, p.y - 1.5, 3, 3)
      } else {
        // Short streak along the direction of travel stands in for a motion trail.
        const path = bucket(streaks, key)
        path.moveTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04)
        path.lineTo(p.x, p.y)
      }
    }
    m.sparks = alive
    ctx.lineWidth = 2.5
    for (const [key, path] of streaks) {
      const [color, level] = key.split('|')
      ctx.globalAlpha = Number(level) / (ALPHA_LEVELS - 1) || 0.12
      ctx.strokeStyle = color
      ctx.stroke(path)
    }
    for (const [key, path] of dots) {
      const [color, level] = key.split('|')
      ctx.globalAlpha = Number(level) / (ALPHA_LEVELS - 1) || 0.12
      ctx.fillStyle = color
      ctx.fill(path)
    }
    ctx.globalAlpha = 1

    // Crisp name once the sparks have settled.
    if (f && m.textAlpha > 0) {
      ctx.globalCompositeOperation = 'source-over'
      ctx.globalAlpha = m.textAlpha
      ctx.drawImage(f.image, 0, 0, STAGE_W, STAGE_H)
      ctx.globalAlpha = 1
    }
  })

  return (
    <div className="absolute inset-0">
      <div className="absolute inset-0" style={{ background: 'linear-gradient(#040c19, #08162b 70%, #0d2244)' }} />
      <canvas ref={canvasRef} className="absolute inset-0 size-full" aria-hidden="true" />
      <p className="sr-only" aria-live="polite">
        {stage.phase === 'revealed' ? stage.winner : ''}
      </p>
    </div>
  )
}
