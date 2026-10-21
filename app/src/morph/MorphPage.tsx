import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'motion/react'
import { ARC_COLORS, N, SECTIONS, type Dot } from '@/morph/shapes'

/**
 * Scroll-morph demo (technique study, inspired by the animejs.com landing page; our own code).
 * One fixed canvas: a glowing ring of rainbow arcs with tick marks, and N dots inside that morph
 * from one shape to the next as the page scrolls. Arcs light up with scroll progress.
 */

const ARCS = ARC_COLORS.length
const GAP = 0.035 // radians between arcs
const ALPHA_LEVELS = 4

const smooth = (t: number) => t * t * (3 - 2 * t)
const clamp01 = (t: number) => Math.min(1, Math.max(0, t))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

interface RingSprites {
  size: number
  radius: number
  lit: HTMLCanvasElement
  dim: HTMLCanvasElement
}

/** The ring is drawn once (glow included) at the current size and then just stamped each frame. */
function buildRing(radius: number, dpr: number): RingSprites {
  const pad = 40
  const size = Math.ceil((radius + pad) * 2)
  const make = (alpha: number, glow: boolean) => {
    const c = document.createElement('canvas')
    c.width = Math.ceil(size * dpr)
    c.height = Math.ceil(size * dpr)
    const ctx = c.getContext('2d')!
    ctx.scale(dpr, dpr)
    ctx.translate(size / 2, size / 2)
    ctx.lineCap = 'round'
    for (let k = 0; k < ARCS; k++) {
      const a0 = -Math.PI / 2 + (k / ARCS) * Math.PI * 2 + GAP / 2
      const a1 = -Math.PI / 2 + ((k + 1) / ARCS) * Math.PI * 2 - GAP / 2
      ctx.strokeStyle = ARC_COLORS[k]
      ctx.globalAlpha = alpha
      ctx.lineWidth = Math.max(3, radius * 0.014)
      if (glow) {
        ctx.shadowColor = ARC_COLORS[k]
        ctx.shadowBlur = radius * 0.05
      }
      ctx.beginPath()
      ctx.arc(0, 0, radius, a0, a1)
      ctx.stroke()
    }
    // Tick marks just inside the ring.
    ctx.shadowBlur = 0
    ctx.globalAlpha = alpha * 0.55
    ctx.strokeStyle = '#ff4b4b'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    const ticks = 180
    for (let i = 0; i < ticks; i++) {
      const a = (i / ticks) * Math.PI * 2
      const long = i % 15 === 0
      const r0 = radius * (long ? 0.9 : 0.925)
      const r1 = radius * 0.955
      ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0)
      ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1)
    }
    ctx.stroke()
    return c
  }
  return { size, radius, lit: make(1, true), dim: make(0.22, false) }
}

export function MorphPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const markerRef = useRef<HTMLDivElement>(null)
  const sectionRefs = useRef<(HTMLElement | null)[]>([])
  const reduced = useReducedMotion() ?? false
  const reducedRef = useRef(reduced)
  useEffect(() => {
    reducedRef.current = reduced
  }, [reduced])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    let w = 0
    let h = 0
    let dpr = 1
    let ring: RingSprites | null = null
    let narrow = false
    let shown = 0 // eased scroll progress, in sections
    const pos = Array.from({ length: N }, () => ({ x: 0, y: 0, s: 0 }))

    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1)
      w = window.innerWidth
      h = window.innerHeight
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      // Phones: a smaller ring sitting lower, so the section text above it stays clear.
      narrow = w < 640
      const radius = narrow ? Math.min(w * 0.42, h * 0.3) : Math.min(w, h) * 0.36
      ring = buildRing(radius, dpr)
    }
    resize()
    window.addEventListener('resize', resize)

    /**
     * Scroll progress measured in sections: k when section k's top reaches the top of the viewport
     * (its heading then sits ~12% down), so each shape finishes forming as its heading scrolls in.
     */
    const target = () => {
      const els = sectionRefs.current
      const y = window.scrollY
      for (let k = 0; k < els.length - 1; k++) {
        const a = els[k]!.offsetTop
        const b = els[k + 1]!.offsetTop
        if (y < b) return k + clamp01((y - a) / (b - a))
      }
      return els.length - 1
    }

    let raf = 0
    let last = performance.now()
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const reducedNow = reducedRef.current
      const t = reducedNow ? 0 : now / 1000
      const goal = target()
      shown += (goal - shown) * (reducedNow ? 1 : Math.min(1, dt * 7))

      // Which two sections we are between, and how far (the morph happens in the middle of the gap).
      const k = Math.min(SECTIONS.length - 2, Math.floor(shown))
      const f = smooth(clamp01((shown - k - 0.2) / 0.6))
      const A = SECTIONS[k]
      const B = SECTIONS[k + 1]
      const progress = shown / (SECTIONS.length - 1)

      if (markerRef.current) markerRef.current.style.transform = `translateX(${progress * 100}%)`

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      if (!ring) {
        raf = requestAnimationFrame(frame)
        return
      }

      // Ring pose blends between the two sections' poses.
      const pose = {
        x: lerp(A.ring.x, B.ring.x, f),
        tilt: lerp(A.ring.tilt, B.ring.tilt, f),
        rot: lerp(A.ring.rot, B.ring.rot, f),
        scale: lerp(A.ring.scale, B.ring.scale, f),
      }
      const cx = w / 2 + pose.x * (narrow ? 0.3 : 1) * w
      const cy = narrow ? h * 0.63 : h / 2
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(pose.rot)
      ctx.scale(pose.scale, pose.scale * pose.tilt)

      // Dim ring everywhere, lit arcs up to the current progress (a pie-wedge clip).
      const half = ring.size / 2
      ctx.drawImage(ring.dim, -half, -half, ring.size, ring.size)
      const litAngle = Math.max(0.0001, progress) * Math.PI * 2
      ctx.save()
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.arc(0, 0, half, -Math.PI / 2, -Math.PI / 2 + litAngle)
      ctx.closePath()
      ctx.clip()
      ctx.drawImage(ring.lit, -half, -half, ring.size, ring.size)
      ctx.restore()

      // Dots: interpolate each one between the two shapes, staggered from first to last.
      const inner = ring.radius * 0.78
      const col = A.color.map((c, j) => Math.round(lerp(c, B.color[j], f)))
      const paths = Array.from({ length: ALPHA_LEVELS }, () => new Path2D())
      for (let i = 0; i < N; i++) {
        const stagger = (i / N) * 0.35
        const g = smooth(clamp01((f - stagger) / 0.65))
        const a: Dot = A.shape(i, t)
        const b: Dot = B.shape(i, t)
        const p = pos[i]
        p.x = lerp(a.x, b.x, g)
        p.y = lerp(a.y, b.y, g)
        p.s = lerp(a.s, b.s, g)
        if (p.s < 0.03) continue
        const level = Math.min(ALPHA_LEVELS - 1, Math.floor(p.s * ALPHA_LEVELS))
        const r = 1.2 + p.s * inner * 0.028
        const x = p.x * inner
        const y = p.y * inner
        paths[level].moveTo(x + r, y)
        paths[level].arc(x, y, r, 0, Math.PI * 2)
      }
      for (let l = 0; l < ALPHA_LEVELS; l++) {
        ctx.fillStyle = `rgba(${col[0]}, ${col[1]}, ${col[2]}, ${0.3 + (0.7 * (l + 1)) / ALPHA_LEVELS})`
        ctx.fill(paths[l])
      }
      ctx.restore()

      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <div className="min-h-svh bg-[#262422] font-stage text-[#e9e4dc]">
      <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 size-full" aria-hidden="true" />

      <main className="relative">
        {SECTIONS.map((s, i) => (
          <section
            key={s.title}
            ref={(el) => {
              sectionRefs.current[i] = el
            }}
            className="min-h-[130svh] px-4 sm:px-16"
          >
            {/* Text stays pinned near the top while its section is on screen. */}
            <div className="sticky top-[8svh] max-w-sm rounded-lg bg-[#262422]/85 py-2 sm:top-[12svh] sm:bg-transparent sm:py-0">
              <h1 className="font-stage text-4xl leading-tight font-bold text-balance sm:text-6xl" style={{ color: i === 0 ? undefined : `rgb(${s.color.join(',')})` }}>
                {s.title}
              </h1>
              <p className="mt-4 text-lg text-pretty text-[#e9e4dc]/80">{s.body}</p>
            </div>
          </section>
        ))}
        <footer className="px-4 py-24 text-sm text-[#e9e4dc]/50 sm:px-16">Technique demo for YS60. Inspired by the Anime.js landing page.</footer>
      </main>

      {/* Scroll ruler: ticks with a red marker showing how far down the page you are. */}
      <div className="fixed right-4 bottom-4 w-[min(336px,calc(100vw-2rem))] rounded-lg bg-[#2f2d2b] px-4 py-3 sm:right-16 sm:bottom-16" aria-hidden="true">
        <div className="relative h-5">
          <div className="absolute inset-0" style={{ background: 'repeating-linear-gradient(90deg, rgba(233,228,220,0.35) 0 1px, transparent 1px 7px)' }} />
          <div ref={markerRef} className="absolute inset-y-0 left-0 w-full will-change-transform">
            <div className="h-full w-[3px] -translate-x-1/2 rounded bg-[#ff4b4b]" />
          </div>
        </div>
      </div>
    </div>
  )
}
