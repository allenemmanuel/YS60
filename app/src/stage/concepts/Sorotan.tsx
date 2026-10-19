import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { secureRandomInt, shuffle } from '@/lib/random'
import { FitName } from '@/stage/FitName'
import { STAGE_W } from '@/stage/StageFrame'
import { clamp01, easeInOutCubic, useFrame, useLatest, type ConceptProps } from '@/stage/useFrame'

/** Concept 5: a wall of names in the dark; a spotlight roams, slows and settles on the winner, who steps forward. */

const COLS = 5
const ROWS = 14
const CELL_W = 352
const ROW_H = 42
const WALL_TOP = 262
const WALL_LEFT = (STAGE_W - COLS * CELL_W) / 2

const cellFont = (name: string) => Math.min(27, Math.floor(330 / (name.length * 0.52)))

/** Mount Kinabalu's granite crown, simplified. */
const KINABALU =
  'M0 230 L260 214 L470 190 L640 150 L740 116 L800 84 L840 62 L862 40 L880 58 L902 22 L924 52 L948 30 L966 16 L988 46 L1012 26 L1036 64 L1090 92 L1190 126 L1380 168 L1640 196 L1920 212 L1920 240 L0 240 Z'

export function Sorotan({ stage, names }: ConceptProps) {
  const [wall, setWall] = useState(() => ({ gen: 0, names: fillWall(names) }))
  const litRef = useRef<HTMLDivElement>(null)
  const glowRef = useRef<HTMLDivElement>(null)
  const dimCells = useRef<(HTMLSpanElement | null)[]>([])
  const litCells = useRef<(HTMLSpanElement | null)[]>([])
  const overlayRef = useRef<HTMLDivElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const s = useLatest(stage)
  const sim = useRef({
    phase: stage.phase,
    t: 0,
    x: 960,
    y: 520,
    rx: 240,
    ry: 150,
    from: { x: 0, y: 0, rx: 0, ry: 0 },
    to: { x: 0, y: 0, rx: 0, ry: 0 },
    landAt: 0,
    winnerCell: -1,
  })

  const cellCenter = (i: number) => ({
    x: WALL_LEFT + (i % COLS) * CELL_W + CELL_W / 2 + (Math.floor(i / COLS) % 2 ? 40 : -40),
    y: WALL_TOP + Math.floor(i / COLS) * ROW_H + ROW_H / 2,
  })

  useFrame((now, dt) => {
    const st = s.current
    const m = sim.current
    if (st.phase !== m.phase) {
      m.phase = st.phase
      if (st.phase === 'landing' && st.winner) {
        // Put the winner on a cell well away from the light, so the beam has somewhere to travel.
        const far: number[] = []
        for (let i = 0; i < COLS * ROWS; i++) {
          const c = cellCenter(i)
          if (Math.hypot(c.x - m.x, c.y - m.y) > 420) far.push(i)
        }
        const cell = far.length ? far[secureRandomInt(far.length)] : secureRandomInt(COLS * ROWS)
        m.winnerCell = cell
        for (const el of [dimCells.current[cell], litCells.current[cell]]) {
          if (el) {
            el.textContent = st.winner
            el.style.fontSize = `${cellFont(st.winner)}px`
          }
        }
        const c = cellCenter(cell)
        m.from = { x: m.x, y: m.y, rx: m.rx, ry: m.ry }
        m.to = { x: c.x, y: c.y, rx: 230, ry: 70 }
        m.landAt = now
      }
      if (st.phase === 'idle') {
        m.winnerCell = -1
        setWall((w) => ({ gen: w.gen + 1, names: fillWall(names) }))
      }
    }

    if (st.phase === 'landing') {
      const k = clamp01((now - m.landAt) / (st.reduced ? 500 : 2800))
      const e = easeInOutCubic(k)
      m.x = m.from.x + (m.to.x - m.from.x) * e
      m.y = m.from.y + (m.to.y - m.from.y) * e
      m.rx = m.from.rx + (m.to.rx - m.from.rx) * e
      m.ry = m.from.ry + (m.to.ry - m.from.ry) * e
      if (k >= 1 || st.skip) {
        Object.assign(m, m.to)
        st.landed()
      }
    } else if (st.phase !== 'revealed') {
      const speed = st.phase === 'spinning' ? (st.reduced ? 0.3 : 2.4) : 0.22
      m.t += dt * speed
      const tx = 960 + 700 * Math.sin(m.t * 0.83 + 1) + 110 * Math.sin(m.t * 2.9)
      const ty = 560 + 230 * Math.sin(m.t * 1.21) + 50 * Math.cos(m.t * 3.7)
      const follow = Math.min(1, dt * 6)
      m.x += (tx - m.x) * follow
      m.y += (ty - m.y) * follow
      m.rx += (240 - m.rx) * follow
      m.ry += (150 - m.ry) * follow
    }

    const mask = `radial-gradient(ellipse ${m.rx}px ${m.ry}px at ${m.x}px ${m.y}px, #000 45%, transparent 100%)`
    if (litRef.current) {
      litRef.current.style.maskImage = mask
      litRef.current.style.webkitMaskImage = mask
    }
    if (glowRef.current) {
      glowRef.current.style.background = `radial-gradient(ellipse ${m.rx * 1.4}px ${m.ry * 1.6}px at ${m.x}px ${m.y}px, rgba(169, 214, 245, 0.16), transparent 70%)`
    }
  })

  // Winner steps forward: fly from the wall cell to centre stage (FLIP, transform only).
  useLayoutEffect(() => {
    if (stage.phase !== 'revealed') return
    const overlay = overlayRef.current
    const root = rootRef.current
    const cell = dimCells.current[sim.current.winnerCell]
    if (!overlay || !root || !cell) return
    const text = overlay.firstElementChild as HTMLElement
    const scale = root.getBoundingClientRect().width / STAGE_W
    const a = cell.getBoundingClientRect()
    const b = text.getBoundingClientRect()
    const dx = (a.left + a.width / 2 - (b.left + b.width / 2)) / scale
    const dy = (a.top + a.height / 2 - (b.top + b.height / 2)) / scale
    const k = parseFloat(cell.style.fontSize || '27') / parseFloat(text.style.fontSize || '160')
    if (stage.reduced) {
      overlay.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400, easing: 'ease-out', fill: 'both' })
      return
    }
    overlay.animate(
      [
        { transform: `translate(${dx}px, ${dy}px) scale(${k})`, color: 'var(--color-diamond)' },
        { transform: 'translate(0, 0) scale(1)', color: 'var(--color-gold)' },
      ],
      { duration: 1100, easing: 'cubic-bezier(0.23, 1, 0.32, 1)', fill: 'both' },
    )
  }, [stage.phase, stage.reduced])

  const revealed = stage.phase === 'revealed'

  return (
    <div ref={rootRef} className="sorotan absolute inset-0" data-phase={stage.phase}>
      <div ref={glowRef} className="absolute inset-0" aria-hidden="true" />
      <Wall key={`d${wall.gen}`} names={wall.names} refs={dimCells} className="sorotan-dim text-ice" />
      <div ref={litRef} className="sorotan-lit absolute inset-0" aria-hidden="true">
        <Wall key={`l${wall.gen}`} names={wall.names} refs={litCells} className="text-diamond" />
      </div>

      <svg className="sorotan-mountain absolute inset-x-0 bottom-0" width={STAGE_W} height="240" viewBox="0 0 1920 240" aria-hidden="true">
        <defs>
          <radialGradient id="sunrise" cx="50%" cy="100%" r="60%">
            <stop offset="0%" stopColor="#e0b45c" stopOpacity="0.55" />
            <stop offset="55%" stopColor="#c8102e" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#08162b" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect className="sorotan-sunrise" x="0" y="-200" width="1920" height="440" fill="url(#sunrise)" />
        <path d={KINABALU} fill="#040c19" stroke="rgba(169, 214, 245, 0.22)" strokeWidth="1.5" />
      </svg>

      {revealed && stage.winner && (
        <div
          ref={overlayRef}
          className="absolute inset-x-0 flex justify-center text-center font-display font-extrabold text-gold"
          style={{ top: 600 - 160, height: 320, alignItems: 'center', transformOrigin: 'center' }}
        >
          <FitName text={stage.winner} width={1640} maxSize={180} minSize={90} lineHeight={0.98} />
        </div>
      )}
    </div>
  )
}

function fillWall(names: string[]): string[] {
  const out: string[] = []
  while (out.length < COLS * ROWS) out.push(...shuffle(names))
  return out.slice(0, COLS * ROWS)
}

function Wall({ names, refs, className }: { names: string[]; refs: React.RefObject<(HTMLSpanElement | null)[]>; className: string }) {
  const rows = useMemo(() => Array.from({ length: ROWS }, (_, r) => names.slice(r * COLS, r * COLS + COLS)), [names])
  return (
    <div className={`absolute font-stage font-medium ${className}`} style={{ top: WALL_TOP, left: WALL_LEFT, width: COLS * CELL_W }}>
      {rows.map((row, r) => (
        <div key={r} className="flex" style={{ height: ROW_H, transform: `translateX(${r % 2 ? 40 : -40}px)` }}>
          {row.map((name, c) => (
            <span
              key={c}
              ref={(el) => {
                refs.current[r * COLS + c] = el
              }}
              className="flex items-center justify-center overflow-hidden whitespace-nowrap"
              style={{ width: CELL_W, fontSize: cellFont(name) }}
            >
              {name}
            </span>
          ))}
        </div>
      ))}
    </div>
  )
}
