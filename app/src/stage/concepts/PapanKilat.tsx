import { useMemo, useRef } from 'react'
import { stageSound } from '@/stage/sound'
import { useFrame, useLatest, type ConceptProps } from '@/stage/useFrame'

/** Concept 4: an airport split-flap board. Every letter flips through the alphabet and stops in turn. */

const COLS = 22
const ROWS = 3
const CELL_W = 66
const CELL_H = 104
const GAP_X = 7
const GAP_Y = 12
const CHARS = " ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-'/.@"
const IDLE_TEXT = 'CABUTAN BERTUAH'
const FLIP_MS = 64

const charIndex = (c: string) => Math.max(0, CHARS.indexOf(c))

/** Wrap a name into at most ROWS centred lines of COLS characters, as board character indices. */
function layoutBoard(text: string): number[] {
  const words = text
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/\s+/)
    .filter(Boolean)
  const lines: string[] = []
  for (const w of words) {
    const last = lines[lines.length - 1]
    if (last !== undefined && last.length + 1 + w.length <= COLS) lines[lines.length - 1] = `${last} ${w}`
    else lines.push(w.slice(0, COLS))
  }
  const used = lines.slice(0, ROWS)
  const top = Math.floor((ROWS - used.length) / 2)
  const grid: number[] = new Array(ROWS * COLS).fill(0)
  used.forEach((line, r) => {
    const left = Math.floor((COLS - line.length) / 2)
    for (let c = 0; c < line.length; c++) grid[(top + r) * COLS + left + c] = charIndex(line[c])
  })
  return grid
}

interface Cell {
  cur: number
  target: number
  /** The cell may only come to rest on its target after this time (left-to-right stagger). */
  allowAt: number
  nextAt: number
  busy: boolean
  top: HTMLSpanElement
  bottom: HTMLSpanElement
  leafTop: HTMLDivElement
  leafTopText: HTMLSpanElement
  leafBottom: HTMLDivElement
  leafBottomText: HTMLSpanElement
  root: HTMLDivElement
}

export function PapanKilat({ stage }: ConceptProps) {
  const cellRefs = useRef<(HTMLDivElement | null)[]>([])
  const cells = useRef<Cell[] | null>(null)
  const s = useLatest(stage)
  const sim = useRef({ phase: '' as string, landingStarted: 0 })
  const idleGrid = useMemo(() => layoutBoard(IDLE_TEXT), [])

  const ensureCells = (): Cell[] | null => {
    if (cells.current) return cells.current
    const list: Cell[] = []
    for (const root of cellRefs.current) {
      if (!root) return null
      const q = <T extends Element>(sel: string) => root.querySelector(sel) as T
      list.push({
        cur: 0,
        target: 0,
        allowAt: 0,
        nextAt: 0,
        busy: false,
        root,
        top: q('.flap-top span'),
        bottom: q('.flap-bottom span'),
        leafTop: q('.flap-leaf-top'),
        leafTopText: q('.flap-leaf-top span'),
        leafBottom: q('.flap-leaf-bottom'),
        leafBottomText: q('.flap-leaf-bottom span'),
      })
    }
    cells.current = list
    return list
  }

  const show = (c: Cell, idx: number) => {
    const ch = CHARS[idx]
    c.cur = idx
    c.top.textContent = ch
    c.bottom.textContent = ch
    c.leafTopText.textContent = ch
    c.leafBottomText.textContent = ch
  }

  const flip = (c: Cell, to: number, reduced: boolean) => {
    if (reduced) {
      show(c, to)
      return
    }
    const from = CHARS[c.cur]
    const next = CHARS[to]
    c.busy = true
    c.top.textContent = next
    c.leafTopText.textContent = from
    c.bottom.textContent = from
    c.leafBottomText.textContent = next
    c.leafTop.style.visibility = 'visible'
    c.leafBottom.style.visibility = 'visible'
    const half = FLIP_MS / 2
    c.leafTop.animate([{ transform: 'rotateX(0deg)' }, { transform: 'rotateX(-90deg)' }], { duration: half, easing: 'linear', fill: 'forwards' })
    const a = c.leafBottom.animate([{ transform: 'rotateX(90deg)' }, { transform: 'rotateX(0deg)' }], {
      duration: half,
      delay: half,
      easing: 'cubic-bezier(0.23, 1, 0.32, 1)',
      fill: 'forwards',
    })
    a.onfinish = () => {
      c.bottom.textContent = next
      c.leafTop.style.visibility = 'hidden'
      c.leafBottom.style.visibility = 'hidden'
      c.cur = to
      c.busy = false
    }
    stageSound.tick()
  }

  useFrame((now) => {
    const list = ensureCells()
    if (!list) return
    const st = s.current
    const m = sim.current
    const reduced = st.reduced

    if (st.phase !== m.phase) {
      const first = m.phase === ''
      m.phase = st.phase
      if (st.phase === 'idle') {
        list.forEach((c, i) => {
          c.target = idleGrid[i]
          c.allowAt = now + (i % COLS) * 30
          c.root.style.color = ''
          if (first) show(c, idleGrid[i])
        })
      } else if (st.phase === 'landing' && st.winner) {
        const grid = layoutBoard(st.winner)
        m.landingStarted = now
        list.forEach((c, i) => {
          c.target = grid[i]
          // Columns settle left to right; rows within a column a beat apart.
          c.allowAt = now + (reduced ? 0 : 900 + (i % COLS) * 85 + Math.floor(i / COLS) * 40)
        })
      } else if (st.phase === 'revealed') {
        list.forEach((c, i) => {
          c.root.style.transitionDelay = `${(i % COLS) * 18}ms`
          c.root.style.color = c.cur ? 'var(--color-gold)' : ''
        })
      }
    }

    if (st.phase === 'landing' && st.skip) {
      list.forEach((c) => {
        c.leafTop.getAnimations().forEach((a) => a.cancel())
        c.leafBottom.getAnimations().forEach((a) => a.cancel())
        c.leafTop.style.visibility = 'hidden'
        c.leafBottom.style.visibility = 'hidden'
        c.busy = false
        show(c, c.target)
      })
      st.landed()
      return
    }

    let settled = 0
    for (let i = 0; i < list.length; i++) {
      const c = list[i]
      if (c.busy || now < c.nextAt) continue
      const atRest = c.cur === c.target && now >= c.allowAt
      if (st.phase === 'spinning') {
        flip(c, (c.cur + 1 + Math.floor(Math.random() * 3)) % CHARS.length, reduced)
        c.nextAt = now + (reduced ? 400 : FLIP_MS + 20 + Math.random() * 40)
      } else if (atRest) {
        settled++
      } else if (st.phase === 'landing' || st.phase === 'idle') {
        if (reduced && now >= c.allowAt) show(c, c.target)
        else flip(c, (c.cur + 1) % CHARS.length, reduced)
        c.nextAt = now + FLIP_MS + 6
      }
    }

    if (st.phase === 'landing' && settled === list.length) st.landed()
  })

  return (
    <div className="absolute inset-0">
      <div
        className="papan absolute left-1/2 grid -translate-x-1/2"
        style={{
          top: 600 - (ROWS * CELL_H + (ROWS - 1) * GAP_Y) / 2,
          gridTemplateColumns: `repeat(${COLS}, ${CELL_W}px)`,
          gap: `${GAP_Y}px ${GAP_X}px`,
        }}
        aria-hidden="true"
      >
        {Array.from({ length: ROWS * COLS }, (_, i) => (
          <div
            key={i}
            ref={(el) => {
              cellRefs.current[i] = el
            }}
            className="flap"
            style={{ width: CELL_W, height: CELL_H }}
          >
            <div className="flap-top">
              <span />
            </div>
            <div className="flap-bottom">
              <span />
            </div>
            <div className="flap-leaf-top">
              <span />
            </div>
            <div className="flap-leaf-bottom">
              <span />
            </div>
          </div>
        ))}
      </div>
      <p className="sr-only" aria-live="polite">
        {stage.phase === 'revealed' ? stage.winner : ''}
      </p>
    </div>
  )
}
