/** Procedural SVG geometry for the dial and demos (generated here, not copied). */

export const DIAL = 614
export const C = DIAL / 2
export const RING_R = 291

/** One arc of the ring, split into `count` segments with a small gap. */
export function arcPath(k: number, count: number, r = RING_R, gapDeg = 1.1): string {
  const a0 = ((k / count) * 360 + gapDeg / 2 - 90) * (Math.PI / 180)
  const a1 = (((k + 1) / count) * 360 - gapDeg / 2 - 90) * (Math.PI / 180)
  const p = (a: number) => `${(C + r * Math.cos(a)).toFixed(2)} ${(C + r * Math.sin(a)).toFixed(2)}`
  return `M ${p(a0)} A ${r} ${r} 0 0 1 ${p(a1)}`
}

/** Tick marks as individual line endpoints (so each tick can be animated). */
export function ticks(count: number, r0: number, r1: number) {
  return Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2 - Math.PI / 2
    const long = i % 10 === 0
    const ri = long ? r0 - 8 : r0
    return {
      x1: C + Math.cos(a) * ri,
      y1: C + Math.sin(a) * ri,
      x2: C + Math.cos(a) * r1,
      y2: C + Math.sin(a) * r1,
      angle: (a * 180) / Math.PI + 90,
    }
  })
}

/** Nested, tilted ellipses that read as a wireframe sphere (for the scroll demo). */
export function sphereRings(count: number, size: number): string[] {
  const c = size / 2
  return Array.from({ length: count }, (_, i) => {
    const t = (i + 1) / count
    const rx = c * 0.92 * Math.sin(t * Math.PI * 0.5 + 0.08)
    const ry = c * 0.92
    // Ellipse as two arcs so it can be drawn with stroke-dash.
    return `M ${c - rx} ${c} A ${rx} ${ry} 0 1 0 ${c + rx} ${c} A ${rx} ${ry} 0 1 0 ${c - rx} ${c}`
  })
}

/** A closed "circuit" track and a second shape it morphs into (same command structure). */
export function circuitPaths(size: number): [string, string] {
  const s = size
  const a = `M ${s * 0.2} ${s * 0.3} L ${s * 0.45} ${s * 0.3} L ${s * 0.55} ${s * 0.18} L ${s * 0.8} ${s * 0.18} L ${s * 0.8} ${s * 0.5} L ${s * 0.68} ${s * 0.62} L ${s * 0.8} ${s * 0.74} L ${s * 0.8} ${s * 0.82} L ${s * 0.35} ${s * 0.82} L ${s * 0.2} ${s * 0.67} Z`
  const b = `M ${s * 0.18} ${s * 0.5} L ${s * 0.32} ${s * 0.25} L ${s * 0.5} ${s * 0.16} L ${s * 0.68} ${s * 0.25} L ${s * 0.82} ${s * 0.5} L ${s * 0.68} ${s * 0.75} L ${s * 0.5} ${s * 0.84} L ${s * 0.4} ${s * 0.8} L ${s * 0.32} ${s * 0.75} L ${s * 0.22} ${s * 0.62} Z`
  return [a, b]
}

/** Points of a dot grid that fall inside a heart (for the sponsors chapter). */
export function heartGrid(n: number): { x: number; y: number; edge: number }[] {
  const out: { x: number; y: number; edge: number }[] = []
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2.4 - 1.2
      const y = -((j / (n - 1)) * 2.4 - 1.2) + 0.2
      const f = (x * x + y * y - 1) ** 3 - x * x * y * y * y
      if (f <= 0) out.push({ x: i / (n - 1), y: j / (n - 1), edge: Math.min(1, -f * 5) })
    }
  }
  return out
}
