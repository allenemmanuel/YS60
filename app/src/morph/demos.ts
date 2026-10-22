import { animate, createDraggable, createSpring, createTimeline, stagger, utils, type JSAnimation, type Timeline } from 'animejs'
import { createMotionPath, morphTo } from 'animejs/svg'

/** Self-running demos shown inside the dial. Each can be started and paused (only the visible one runs). */
export interface Demo {
  start(): void
  stop(): void
  destroy(): void
}

type Anim = JSAnimation | Timeline

function group(make: () => Anim[]): Demo {
  let anims: Anim[] | null = null
  return {
    start() {
      if (!anims) anims = make()
      anims.forEach((a) => a.play())
    },
    stop() {
      anims?.forEach((a) => a.pause())
    },
    destroy() {
      anims?.forEach((a) => a.revert())
      anims = null
    },
  }
}

const q = <T extends Element = HTMLElement>(root: Element, sel: string) => root.querySelector(sel) as T
const qa = <T extends Element = HTMLElement>(root: Element, sel: string) => Array.from(root.querySelectorAll(sel)) as T[]

export function intuitiveDemo(root: Element): Demo {
  return group(() => [animate(q(root, '.square'), { rotate: 90, loop: true, ease: 'inOutExpo', duration: 1200, loopDelay: 250 })])
}

export function compositionDemo(root: Element): Demo {
  const shapes = qa(root, '.shape')
  let timer: ReturnType<typeof setInterval> | undefined
  const shuffle = () =>
    animate(shapes, {
      x: () => utils.random(-130, 130),
      y: () => utils.random(-130, 130),
      rotate: () => utils.random(-180, 180),
      duration: () => utils.random(500, 1000),
      composition: 'blend',
      ease: 'out(3)',
    })
  return {
    start() {
      shuffle()
      timer ??= setInterval(shuffle, 650)
    },
    stop() {
      clearInterval(timer)
      timer = undefined
    },
    destroy() {
      this.stop()
      utils.remove(shapes)
    },
  }
}

export function staggeringDemo(root: Element): Demo {
  const dots = qa(root, '.dot')
  const opts = { grid: [13, 13] as [number, number], from: 'center' as const }
  return group(() => [
    createTimeline({ loop: true, alternate: true })
      .add(dots, { scale: stagger([1.1, 0.25], opts), ease: 'inOutQuad', duration: 700 }, stagger(70, opts))
      .add(dots, { scale: 1, ease: 'inOutQuad', duration: 700 }, stagger(70, opts)),
  ])
}

export function svgDemo(root: Element): Demo {
  const track = q<SVGPathElement>(root, '.circuit')
  const target = q<SVGPathElement>(root, '.circuit-b')
  const car = q(root, '.car')
  return group(() => [
    animate(car, { ...createMotionPath(track), duration: 3200, ease: 'linear', loop: true }),
    animate(track, { d: morphTo(target), duration: 1600, ease: 'inOut(3)', loop: true, alternate: true, loopDelay: 900 }),
  ])
}

export function draggableDemo(root: Element): Demo {
  const circle = q(root, '.circle')
  const area = q(root, '.drag-area')
  const drag = createDraggable(circle, {
    container: area,
    releaseEase: createSpring({ stiffness: 120, damping: 6 }),
  })
  return {
    start() {
      drag.enable()
    },
    stop() {
      drag.disable()
    },
    destroy() {
      drag.revert()
    },
  }
}

export function clockworkDemo(root: Element): Demo {
  const tickEls = qa(root, '.clock-tick')
  const hand = q(root, '.clock-hand')
  return group(() => [
    createTimeline({ loop: true })
      .add(tickEls, { y: [0, -10, 0], duration: 340, ease: 'inOut(2)' }, stagger(32))
      .add(hand, { rotate: [0, 360], duration: 1920, ease: 'linear' }, '<<'),
  ])
}

export function responsiveDemo(root: Element): Demo {
  const vp = q(root, '.viewport')
  return group(() => [
    createTimeline({ loop: true, alternate: true, defaults: { ease: 'inOut(3)', duration: 1100 } })
      .add(vp, { width: ['86%', '46%'], height: ['56%', '78%'] })
      .add(vp, { width: '30%', height: '62%' }, '+=500'),
  ])
}

/** The hero's easing study: a stack of lines and a chain of dots, both shaped by an easing curve that keeps changing. */
const EASES: ((t: number) => number)[] = [
  (t) => 1 - (1 - t) ** 3,
  (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  (t) => (t === 0 || t === 1 ? t : 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1),
  (t) => {
    const n = 7.5625
    const d = 2.75
    if (t < 1 / d) return n * t * t
    if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75
    if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375
    return n * (t -= 2.625 / d) * t + 0.984375
  },
  (t) => (t === 0 ? 0 : t === 1 ? 1 : t < 0.5 ? 2 ** (20 * t - 10) / 2 : (2 - 2 ** (-20 * t + 10)) / 2),
]

export function heroCanvas(canvas: HTMLCanvasElement): Demo {
  const ctx = canvas.getContext('2d')!
  let raf = 0
  const LINES = 46
  const DOTS = 36
  const draw = (now: number) => {
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    if (canvas.width !== Math.round(w * dpr)) {
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    const t = now / 1000 / 2.4
    const cur = Math.floor(t) % EASES.length
    const nxt = (cur + 1) % EASES.length
    const f = t % 1
    const mix = f < 0.6 ? 0 : (1 - Math.cos(((f - 0.6) / 0.4) * Math.PI)) / 2
    const ease = (x: number) => EASES[cur](x) * (1 - mix) + EASES[nxt](x) * mix
    const cx = w / 2
    const cy = h / 2
    const R = Math.min(w, h) * 0.46

    // Line stack: half-width follows the easing from the edges to the centre.
    const lines = new Path2D()
    for (let i = 0; i < LINES; i++) {
      const v = (i / (LINES - 1)) * 2 - 1
      const half = R * Math.max(0, Math.min(1.1, ease(1 - Math.abs(v)))) * 0.92
      const y = cy + v * R * 0.62
      lines.moveTo(cx - half, y)
      lines.lineTo(cx + half, y)
    }
    ctx.strokeStyle = 'rgba(255, 75, 75, 0.55)'
    ctx.lineWidth = 2
    ctx.stroke(lines)

    // Dot chain tracing the curve itself.
    const dots = new Path2D()
    for (let i = 0; i < DOTS; i++) {
      const x = i / (DOTS - 1)
      const px = cx - R + x * R * 2
      const py = cy + R * 0.62 - ease(x) * R * 1.24
      dots.moveTo(px + 5, py)
      dots.arc(px, py, 5, 0, Math.PI * 2)
    }
    ctx.fillStyle = '#ff4b4b'
    ctx.fill(dots)
    raf = requestAnimationFrame(draw)
  }
  return {
    start() {
      if (!raf) raf = requestAnimationFrame(draw)
    },
    stop() {
      cancelAnimationFrame(raf)
      raf = 0
    },
    destroy() {
      this.stop()
    },
  }
}

/** Sponsors chapter: the heart of dots beats gently. */
export function heartDemo(root: Element): Demo {
  const dots = qa(root, '.heart-dot')
  return group(() => [
    createTimeline({ loop: true })
      .add(dots, { scale: [1, 1.35, 1], duration: 520, ease: 'out(3)' }, stagger(6, { from: 'center' }))
      .add(dots, { scale: [1, 1.15, 1], duration: 420, ease: 'out(3)' }, '-=220')
      .add({}, { duration: 600 }),
  ])
}
