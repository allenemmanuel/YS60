/**
 * Point sets the dots morph between. Each shape places dot `i` of `N` in unit space
 * (x, y in about -1…1, inside the ring) and gives it a size 0…1 (0 = hidden). `t` is time in seconds.
 */
export const N = 324 // 18 × 18

export interface Dot {
  x: number
  y: number
  s: number
}

export type Shape = (i: number, t: number) => Dot

const GRID = 18
const gx = (i: number) => (i % GRID) / (GRID - 1) * 2 - 1
const gy = (i: number) => Math.floor(i / GRID) / (GRID - 1) * 2 - 1
const GOLDEN = Math.PI * (3 - Math.sqrt(5))

/** 1. Dot grid with a pulse rippling out from the centre. */
const grid: Shape = (i, t) => {
  const x = gx(i) * 0.82
  const y = gy(i) * 0.82
  const d = Math.hypot(x, y)
  if (d > 0.86) return { x: x * 0.6, y: y * 0.6, s: 0 }
  const wave = 0.5 + 0.5 * Math.sin(d * 9 - t * 3)
  return { x, y, s: 0.15 + 0.85 * wave * (1 - d * 0.6) }
}

/** 2. A chain of dots tracing an easing curve over a lens-shaped stack of short dashes. */
const easing: Shape = (i, t) => {
  const CHAIN = 40
  if (i < CHAIN) {
    const k = i / (CHAIN - 1)
    const x = -0.85 + 1.7 * k
    const sharp = 4 + 2 * Math.sin(t * 1.2)
    const y = -Math.tanh((k - 0.5) * sharp) * 0.55
    return { x, y, s: 0.7 }
  }
  const j = i - CHAIN
  const rows = 28
  const row = j % rows
  const col = Math.floor(j / rows)
  const cols = Math.ceil((N - CHAIN) / rows)
  const y = (row / (rows - 1)) * 1.7 - 0.85
  const half = 0.82 * (1 - Math.abs(y / 0.85) ** 1.6) * (0.85 + 0.15 * Math.sin(t * 2 + y * 3))
  const x = ((col + 0.5) / cols) * 2 * half - half
  return { x, y, s: 0.22 }
}

/** 3. A rotating sphere (Fibonacci points), sized by depth. */
const sphere: Shape = (i, t) => {
  const y0 = 1 - (i / (N - 1)) * 2
  const r = Math.sqrt(1 - y0 * y0)
  const a = i * GOLDEN
  const x0 = Math.cos(a) * r
  const z0 = Math.sin(a) * r
  const ry = t * 0.6
  const x1 = x0 * Math.cos(ry) + z0 * Math.sin(ry)
  const z1 = -x0 * Math.sin(ry) + z0 * Math.cos(ry)
  const rx = 0.45
  const y2 = y0 * Math.cos(rx) - z1 * Math.sin(rx)
  const z2 = y0 * Math.sin(rx) + z1 * Math.cos(rx)
  return { x: x1 * 0.78, y: y2 * 0.78, s: 0.25 + 0.75 * ((z2 + 1) / 2) }
}

/** 4. A tilted coil winding around and around. */
const coil: Shape = (i, t) => {
  const k = i / (N - 1)
  const turns = 9
  const a = k * turns * Math.PI * 2 + t * 1.5
  const y = k * 1.6 - 0.8
  const rad = 0.75 * Math.sqrt(Math.max(0, 1 - (y / 0.85) ** 2))
  const x = Math.cos(a) * rad
  const z = Math.sin(a)
  const tilt = 0.5
  return { x: x * Math.cos(tilt) - y * Math.sin(tilt) * 0.4, y: y + z * rad * 0.25, s: 0.3 + 0.7 * ((z + 1) / 2) }
}

/** 5. A filled disc (sunflower layout), gently breathing. */
const disc: Shape = (i, t) => {
  const r = Math.sqrt((i + 0.5) / N) * 0.72 * (1 + 0.04 * Math.sin(t * 2))
  const a = i * GOLDEN
  return { x: Math.cos(a) * r, y: Math.sin(a) * r, s: 0.75 }
}

/** 6. A wave field: the grid seen in perspective, rippling. */
const wave: Shape = (i, t) => {
  const u = gx(i)
  const v = gy(i)
  const z = Math.sin(u * 3 + t * 2) * Math.cos(v * 3 - t * 1.4)
  const depth = (v + 1) / 2 // 0 far … 1 near
  const persp = 0.55 + 0.45 * depth
  return { x: u * 0.85 * persp, y: (v * 0.45 + z * 0.12) * 0.95 + 0.05, s: (0.2 + 0.6 * depth) * (0.6 + 0.4 * (z + 1) / 2) }
}

/** 7. A beating heart. */
const heart: Shape = (i, t) => {
  const x = gx(i) * 1.2
  const y = -gy(i) * 1.2 + 0.15
  // Classic implicit heart: (x² + y² − 1)³ − x²y³ ≤ 0
  const f = (x * x + y * y - 1) ** 3 - x * x * y * y * y
  const beat = 1 + 0.07 * Math.max(0, Math.sin(t * 6)) ** 6
  if (f > 0) return { x: 0, y: 0, s: 0 }
  const edge = Math.min(1, -f * 6)
  return { x: x * 0.58 * beat, y: -(y - 0.15) * 0.58 * beat, s: 0.35 + 0.65 * edge }
}

export interface Section {
  title: string
  body: string
  shape: Shape
  /** Dot colour for this section. */
  color: [number, number, number]
  /** Ring pose: horizontal offset (fraction of viewport width), vertical squash (tilt), rotation (rad), scale. */
  ring: { x: number; tilt: number; rot: number; scale: number }
}

export const SECTIONS: Section[] = [
  { title: 'One shape, many forms', body: 'Scroll down. The ring stays put while everything inside it changes.', shape: grid, color: [255, 75, 75], ring: { x: 0, tilt: 1, rot: 0, scale: 1 } },
  { title: 'Easing', body: 'A chain of dots traces a curve over a stack of dashes that swells and settles.', shape: easing, color: [255, 75, 75], ring: { x: 0.2, tilt: 0.55, rot: -0.35, scale: 0.85 } },
  { title: 'Depth', body: 'The same dots wrap into a sphere, sized by how close they are to you.', shape: sphere, color: [0, 230, 138], ring: { x: 0, tilt: 1, rot: 0, scale: 1 } },
  { title: 'Rhythm', body: 'They unwind into a coil that keeps on turning.', shape: coil, color: [0, 220, 220], ring: { x: 0, tilt: 1, rot: 0, scale: 1 } },
  { title: 'Weight', body: 'Then pack tightly into a solid disc.', shape: disc, color: [184, 255, 87], ring: { x: 0, tilt: 1, rot: 0, scale: 1 } },
  { title: 'Flow', body: 'Spread out into a rippling field.', shape: wave, color: [80, 150, 255], ring: { x: 0, tilt: 1, rot: 0, scale: 1 } },
  { title: 'Heart', body: 'And end on a beat.', shape: heart, color: [255, 75, 75], ring: { x: 0, tilt: 1, rot: 0, scale: 1 } },
]

/** Rainbow arcs, clockwise from 12 o'clock. */
export const ARC_COLORS = ['#ff4b4b', '#ff9a2e', '#ffd23f', '#a3e635', '#3ee88f', '#22d3ee', '#3b9cff', '#7aa2ff']
