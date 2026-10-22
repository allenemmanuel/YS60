import { animate, createDraggable, createTimeline, stagger, utils, type Timeline } from 'animejs'
import { createDrawable } from 'animejs/svg'
import { scrambleText, splitText } from 'animejs/text'
import { BG_DARK, BG_LIGHT, CHAPTERS, FEATURES } from '@/morph/content'
import {
  clockworkDemo,
  compositionDemo,
  draggableDemo,
  heartDemo,
  heroCanvas,
  intuitiveDemo,
  responsiveDemo,
  staggeringDemo,
  svgDemo,
  type Demo,
} from '@/morph/demos'
import type { FormationName } from '@/morph/three/sixty'
import { createWorld } from '@/morph/three/world'

/**
 * Scroll-scrubbed choreography for /morph.
 * One master timeline holds every chapter between labels (LABEL … LABEL_END). The page scroll is
 * mapped chapter by chapter onto that timeline and smoothed, so scrolling up plays it backwards.
 * The timeline drives the 3D world (the "60" parts + the CSS3D dial) and the DOM (text, dial arcs, demos).
 */

const SEG = 1000 // timeline milliseconds per viewport-height of scroll
const r = (deg: number) => (deg * Math.PI) / 180

export function initMorph(root: HTMLElement, reduced: boolean): () => void {
  const $ = <T extends Element = HTMLElement>(sel: string) => root.querySelector(sel) as T
  const $$ = <T extends Element = HTMLElement>(sel: string) => Array.from(root.querySelectorAll(sel)) as T[]

  const stage = $('.mx-stage')
  const dial = $('.mx-scene')
  const dialHome = { parent: dial.parentElement!, next: dial.nextSibling }
  const hero = $<HTMLCanvasElement>('.mx-hero')
  const ticks = $$('.mx-tick')
  const bgArcs = $$('.mx-arc-bg')
  const arcs = $$<SVGPathElement>('.mx-arc')
  const labels = $$('.mx-label')
  const lines = $$<SVGPolylineElement>('.mx-line')
  const demos = FEATURES.map((f) => $(`[data-demo="${f.id}"]`))
  const texts = Object.fromEntries($$('[data-text]').map((el) => [el.dataset.text!, el]))
  const sections = $$('[data-chapter]')
  const heartDots = $('.mx-heart')
  const bars = $$('.mx-bar')

  // --- 3D stage: the WebGL "60" plus the HTML dial as a CSS3D object, one camera ---
  dial.classList.add('is-3d')
  const W = createWorld(stage, dial)
  const { world, model } = W
  const parts = model.parts
  const F = model.formations
  const pos = parts.map((m) => m.position)
  const rot = parts.map((m) => m.rotation)
  const scl = parts.map((m) => m.scale)
  // Assembly ripples outward from the middle of the "60".
  const rank = (() => {
    const d = F.home.map((h, i) => [h.p.length(), i] as const).sort((x, y) => x[0] - y[0])
    const out = new Array<number>(d.length)
    d.forEach(([, i], k) => (out[i] = k))
    return out
  })()

  // --- text splitting (our own static copy, so innerHTML-based helpers are safe here) ---
  const introSplit = splitText($('[data-text="intro"] h1'), { chars: true })
  const heads = Object.fromEntries(Object.entries(texts).map(([k, el]) => [k, el.querySelector('h2')]))

  // --- initial states ---
  utils.set(arcs, { opacity: 0 })
  const drawArcs = createDrawable(arcs)
  utils.set(drawArcs, { draw: '0 0' })
  const drawLines = lines.map((l) => {
    l.setAttribute('pathLength', '1')
    return l
  })
  utils.set(drawLines, { strokeDasharray: 1, strokeDashoffset: 1 })
  utils.set(Object.values(texts), { opacity: 0 })
  utils.set(texts.intro, { opacity: 1 })
  utils.set(demos, { opacity: 0, scale: 0.6 })
  utils.set(labels, { opacity: 0 })
  utils.set(heartDots, { scale: 0, opacity: 0 })
  utils.set(bars, { scaleX: 0 })
  const sphere = createDrawable($$('.mx-sphere path'))
  utils.set(sphere, { draw: '0 0' })

  // --- master timeline ---
  const tl: Timeline = createTimeline({ autoplay: false, defaults: { ease: 'inOut(2)', composition: 'none' } })
  const len = (id: string) => CHAPTERS.find((c) => c.id === id)!.length * SEG
  // On wide screens the "60" sits right of centre, balancing the text column on the left.
  const SHIFT = window.innerWidth >= 900 ? window.innerWidth * 0.1 : 0

  /** Move every part from one formation to another. `spin` adds whole turns about y on the way. */
  const move = (from: FormationName, to: FormationName, at: string, o: { duration?: number; per?: number; ease?: string; spin?: number } = {}) => {
    const A = F[from]
    const B = F[to]
    const duration = o.duration ?? 600
    const delay = (_?: unknown, i = 0) => rank[i] * (o.per ?? 8)
    const ease = o.ease ?? 'inOut(3)'
    const spin = (o.spin ?? 0) * Math.PI * 2
    tl.add(pos, {
      x: (_?: unknown, i = 0) => [A[i].p.x, B[i].p.x],
      y: (_?: unknown, i = 0) => [A[i].p.y, B[i].p.y],
      z: (_?: unknown, i = 0) => [A[i].p.z, B[i].p.z],
      duration,
      delay,
      ease,
    }, at)
      .add(rot, {
        x: (_?: unknown, i = 0) => [A[i].r.x, B[i].r.x],
        y: (_?: unknown, i = 0) => [A[i].r.y + spin, B[i].r.y],
        z: (_?: unknown, i = 0) => [A[i].r.z, B[i].r.z],
        duration,
        delay,
        ease,
      }, at)
      .add(scl, {
        x: (_?: unknown, i = 0) => [A[i].s, B[i].s],
        y: (_?: unknown, i = 0) => [A[i].s, B[i].s],
        z: (_?: unknown, i = 0) => [A[i].s, B[i].s],
        duration,
        delay,
        ease,
      }, at)
  }

  // HEADING: the dial tips back and fades while the scattered parts fly in and lock into a "60".
  tl.label('HEADING')
    .add(introSplit.chars, { y: [0, -60], opacity: [1, 0], duration: 350, delay: stagger(6) }, 'HEADING')
    .add(texts.intro.querySelectorAll('p'), { opacity: [1, 0], duration: 250 }, 'HEADING')
    .add(world.rotation, { x: [0, r(-14)], y: [0, r(-24)], duration: 1000, ease: 'inOut(3)' }, 'HEADING')
    .add(world.position, { z: [0, -200], x: [0, SHIFT], duration: 1000, ease: 'inOut(3)' }, 'HEADING')
    .add(hero, { opacity: [1, 0], scale: [1, 0.5], duration: 450 }, 'HEADING+=150')
    .add(ticks, { opacity: [1, 0.35], duration: 400 }, 'HEADING+=200')
    .add(dial, { opacity: [1, 0.1], duration: 400 }, 'HEADING+=200')
  move('scatter', 'home', 'HEADING+=100', { duration: 600, per: 5, ease: 'out(3)' })
  tl.label('HEADING_END', len('intro'))

  // TOOLBOX: light page; the "60" bursts into layers and turns; leader lines point at parts; then it re-forms and becomes a ring.
  const TB = len('toolbox')
  const tbEnd = (back: number) => `TOOLBOX+=${TB - back}`
  tl.label('TOOLBOX', 'HEADING_END')
    .add(document.body, { backgroundColor: [BG_DARK, BG_LIGHT], duration: 250 }, 'TOOLBOX')
    .add(texts.toolbox, { opacity: [0, 1], duration: 250 }, 'TOOLBOX+=150')
    .add(bgArcs, { color: ['#3f3e3d', '#b5afa8'], duration: 250 }, 'TOOLBOX')
    .add(world.rotation, { y: [r(-24), r(30)], x: [r(-14), r(-6)], duration: TB - 500, ease: 'linear' }, 'TOOLBOX')
  // Hold the finished "60" while the page turns light, then burst it apart.
  move('home', 'exploded', 'TOOLBOX+=380', { duration: 600, per: 5 })
  tl.add(world.position, { z: [-200, -320], duration: TB - 900, ease: 'linear' }, 'TOOLBOX+=380')
  tl.add(labels, { opacity: [0, 1], duration: 200, delay: stagger(40) }, 'TOOLBOX+=500')
    .add(drawLines, { strokeDashoffset: [1, 0], duration: 400, delay: stagger(40) }, 'TOOLBOX+=500')
    .add(labels, { opacity: [1, 0], duration: 200, delay: stagger(20) }, tbEnd(800))
    .add(drawLines, { strokeDashoffset: [0, 1], duration: 250, delay: stagger(20) }, tbEnd(800))
    .add(texts.toolbox, { opacity: [1, 0], duration: 200 }, tbEnd(450))
  move('exploded', 'home', tbEnd(760), { duration: 330, per: 3, spin: 1 })
  move('home', 'ring', tbEnd(400), { duration: 380, per: 3 })
  tl.add(world.rotation, { x: [r(-6), 0], y: [r(30), 0], duration: 400, ease: 'inOut(3)' }, tbEnd(400))
    .add(world.position, { z: [-320, 0], x: [SHIFT, 0], duration: 400, ease: 'inOut(3)' }, tbEnd(400))
    .add(dial, { opacity: [0.1, 1], duration: 300 }, tbEnd(320))
    .add(document.body, { backgroundColor: [BG_LIGHT, BG_DARK], duration: 250 }, tbEnd(300))
    .add(bgArcs, { color: ['#b5afa8', '#3f3e3d'], duration: 250 }, tbEnd(300))
    .label('TOOLBOX_END', `TOOLBOX+=${TB}`)

  // FEATURES: one chapter per feature. The ticks take its colour, its ring arc draws in, its demo and text play.
  let prev = 'TOOLBOX_END'
  FEATURES.forEach((f, k) => {
    const L = `F_${f.id}`
    const el = texts[f.id]
    const D = len(f.id)
    tl.label(L, prev)
      .add(ticks, { color: f.color, duration: 200, ease: 'out(2)' }, L)
      .add(arcs[k], { opacity: [0, 1], duration: 1 }, L)
      .add(drawArcs[k], { draw: ['0 0', '0 1'], duration: D * 0.7, ease: 'linear' }, L)
      .add(demos[k], { opacity: [0, 1], scale: [0.6, 1], duration: 220, ease: 'out(3)' }, `${L}+=60`)
      .add(el, { opacity: [0, 1], duration: 150 }, L)
      .add(el.querySelectorAll('li'), { opacity: [0, 1], x: [-12, 0], duration: 150, delay: stagger(40) }, `${L}+=120`)
    if (f.id === 'scroll') tl.add(sphere, { draw: ['0 0', '0 1', '1 1'], duration: D * 0.75, delay: stagger(D * 0.012), ease: 'inOut(3)' }, `${L}+=80`)
    tl.add(demos[k], { opacity: [1, 0], scale: [1, 0.85], duration: 180, ease: 'in(2)' }, `${L}+=${D - 200}`)
      .add(el, { opacity: [1, 0], duration: 150 }, `${L}+=${D - 160}`)
      .label(`${L}_END`, `${L}+=${D}`)
    prev = `${L}_END`
  })
  // The ring of parts turns once around the dial over all the feature chapters (scroll-driven).
  const featuresSpan = FEATURES.reduce((t, f) => t + len(f.id), 0)
  tl.add(model.swirl.rotation, { z: [0, Math.PI * 2], duration: featuresSpan, ease: 'linear' }, `F_${FEATURES[0].id}`)

  // MODULES: light again. The parts lay out flat like a kit on a table, then fly back together into the "60".
  const M = len('modules')
  const mEnd = (back: number) => `MODULES+=${M - back}`
  tl.label('MODULES', prev)
    .add(document.body, { backgroundColor: [BG_DARK, BG_LIGHT], duration: 250 }, 'MODULES')
    .add(bgArcs, { color: ['#3f3e3d', '#b5afa8'], duration: 250 }, 'MODULES')
    .add(ticks, { color: '#8f8a84', duration: 250 }, 'MODULES')
    .add(dial, { opacity: [1, 0.1], duration: 300 }, 'MODULES')
    .add(texts.modules, { opacity: [0, 1], duration: 250 }, 'MODULES+=150')
    .add(world.rotation, { x: [0, r(-58)], y: [0, r(18)], duration: 800, ease: 'inOut(3)' }, 'MODULES')
    .add(world.position, { z: [0, -160], x: [0, SHIFT * 1.6], duration: 800, ease: 'inOut(3)' }, 'MODULES')
  move('ring', 'kit', 'MODULES+=150', { duration: 650, per: 6 })
  tl.add(world.rotation, { x: [r(-58), r(-16)], y: [r(18), r(-20)], duration: 600, ease: 'inOut(3)' }, 'MODULES+=1100')
  move('kit', 'home', 'MODULES+=1100', { duration: 650, per: 7, spin: 1, ease: 'out(3)' })
  tl.add(bars, { scaleX: [0, 1], duration: 500, delay: stagger(40), ease: 'out(3)' }, 'MODULES+=400')
    .add(bars, { scaleX: [1, 0], duration: 250, delay: stagger(15) }, mEnd(500))
    .add(texts.modules, { opacity: [1, 0], duration: 200 }, mEnd(350))
  move('home', 'ring', mEnd(450), { duration: 400, per: 3 })
  tl.add(world.rotation, { x: [r(-16), 0], y: [r(-20), 0], duration: 450, ease: 'inOut(3)' }, mEnd(450))
    .add(world.position, { z: [-160, 0], x: [SHIFT * 1.6, 0], duration: 450, ease: 'inOut(3)' }, mEnd(450))
    .add(dial, { opacity: [0.1, 1], duration: 300 }, mEnd(300))
    .add(document.body, { backgroundColor: [BG_LIGHT, BG_DARK], duration: 250 }, mEnd(300))
    .add(bgArcs, { color: ['#b5afa8', '#3f3e3d'], duration: 250 }, mEnd(300))
    .add(ticks, { color: '#ff4b4b', duration: 250 }, mEnd(300))
    .label('MODULES_END', `MODULES+=${M}`)

  // SPONSORS: the parts gather into a big heart around the dial while a heart of dots fills it.
  const S = len('sponsors')
  tl.label('SPONSORS', 'MODULES_END')
  move('ring', 'heart', 'SPONSORS', { duration: 450, per: 4 })
  tl.add(heartDots, { scale: [0, 1], opacity: [0, 1], duration: 350, ease: 'out(3)' }, 'SPONSORS')
    .add(texts.sponsors, { opacity: [0, 1], duration: 200 }, 'SPONSORS+=100')
    .add(texts.sponsors, { opacity: [1, 0], duration: 200 }, `SPONSORS+=${S - 220}`)
    .add(heartDots, { scale: [1, 0], opacity: [1, 0], duration: 250 }, `SPONSORS+=${S - 250}`)
    .label('SPONSORS_END', `SPONSORS+=${S}`)

  // END: the dial bows out and the "60" assembles one last time, tipping up and away.
  tl.label('END', 'SPONSORS_END').add(dial, { opacity: [1, 0], duration: 300 }, 'END')
  move('heart', 'home', 'END', { duration: 450, per: 4, spin: 1, ease: 'out(3)' })
  tl.add(world.rotation, { x: [0, r(16)], y: [0, r(-22)], duration: 900, ease: 'inOut(3)' }, 'END')
    .add(world.position, { y: [0, 40], z: [0, -120], x: [0, SHIFT], duration: 900, ease: 'inOut(3)' }, 'END')
    .add(texts.end, { opacity: [0, 1], duration: 300 }, 'END+=300')
    .label('END_END', `END+=${len('end')}`)

  // --- scroll → timeline mapping (piecewise per chapter, smoothed) ---
  const ranges: { from: number; to: number; t0: number; t1: number; id: string }[] = []
  const measure = () => {
    ranges.length = 0
    sections.forEach((s) => {
      const c = CHAPTERS.find((x) => x.id === s.dataset.chapter)!
      const t0 = tl.labels[c.label]
      const t1 = tl.labels[`${c.label}_END`]
      ranges.push({ from: s.offsetTop, to: s.offsetTop + s.offsetHeight, t0, t1, id: c.id })
    })
    // The last chapter always completes at the very bottom of the page.
    const lastRange = ranges[ranges.length - 1]
    if (lastRange) lastRange.to = Math.min(lastRange.to, document.documentElement.scrollHeight - window.innerHeight)
  }
  measure()

  const timeAt = (y: number) => {
    for (const rg of ranges) {
      if (y < rg.to) return rg.t0 + Math.max(0, Math.min(1, (y - rg.from) / (rg.to - rg.from))) * (rg.t1 - rg.t0)
    }
    return tl.duration
  }
  const chapterAt = (y: number) => ranges.find((rg) => y < rg.to)?.id ?? 'end'

  // --- demos: only the chapter on screen runs ---
  const live: Record<string, Demo> = {
    intro: heroCanvas(hero),
    intuitive: intuitiveDemo(demos[0]),
    composition: compositionDemo(demos[1]),
    staggering: staggeringDemo(demos[3]),
    svg: svgDemo(demos[4]),
    draggable: draggableDemo(demos[5]),
    clockwork: clockworkDemo(demos[6]),
    responsive: responsiveDemo(demos[7]),
    sponsors: heartDemo(heartDots),
  }
  live.draggable.stop()
  let active = ''
  const scrambles: Record<string, ReturnType<typeof animate>> = {}
  const setActive = (id: string) => {
    if (id === active) return
    live[active]?.stop()
    active = id
    // Feature headings scramble in each time their chapter becomes active (a one-shot, not scrubbed).
    const f = FEATURES.find((x) => x.id === id)
    const h = f && heads[f.id]
    if (f && h && !reduced) {
      scrambles[f.id]?.pause()
      scrambles[f.id] = animate(h, { innerHTML: scrambleText({ text: f.title, chars: 'a-z' }), onComplete: () => (h.textContent = f.title) })
    }
    if (!reduced) live[id]?.start()
    else if (id === 'draggable') live[id]?.start()
  }

  // --- scroll bar: cursor follows progress; click or drag to jump ---
  const bar = $('.mx-scrollbar')
  const cursor = $('.mx-cursor')
  const ghost = $('.mx-ghost')
  const maxScroll = () => document.documentElement.scrollHeight - window.innerHeight
  const jump = (p: number) => window.scrollTo({ top: p * maxScroll(), behavior: 'instant' as ScrollBehavior })
  const onBarClick = (e: MouseEvent) => {
    if (e.target === cursor) return
    const rect = bar.getBoundingClientRect()
    jump((e.clientX - rect.left) / rect.width)
  }
  const onBarMove = (e: MouseEvent) => {
    const rect = bar.getBoundingClientRect()
    ghost.style.transform = `translateX(${e.clientX - rect.left}px)`
    ghost.style.opacity = '1'
  }
  const onBarLeave = () => (ghost.style.opacity = '0')
  bar.addEventListener('click', onBarClick)
  bar.addEventListener('mousemove', onBarMove)
  bar.addEventListener('mouseleave', onBarLeave)
  let dragging = false
  const drag = createDraggable(cursor, {
    container: bar,
    y: false,
    onGrab: () => (dragging = true),
    onRelease: () => (dragging = false),
    onDrag: (d) => jump(d.progressX),
  })

  // --- toolbox leader lines: label edge → elbow → the labelled 3D part on screen ---
  const lineSvg = $<SVGSVGElement>('.mx-lines')
  const updateLines = () => {
    const vb = lineSvg.getBoundingClientRect()
    lines.forEach((line, i) => {
      const label = labels[i]
      const part = parts[model.labelled[i]]
      if (!label || !part) return
      const lr = label.getBoundingClientRect()
      const pt = W.project(part)
      const left = label.dataset.side === 'left'
      const x0 = (left ? lr.right + 8 : lr.left - 8) - vb.left
      const y0 = lr.top + lr.height / 2 - vb.top
      const x2 = pt.x - vb.left
      const y2 = pt.y - vb.top
      const dy = Math.abs(y2 - y0)
      const x1 = left ? Math.min(x2 - 1, x0 + Math.max(0, Math.abs(x2 - x0) - dy)) : Math.max(x2 + 1, x0 - Math.max(0, Math.abs(x2 - x0) - dy))
      line.setAttribute('points', `${x0},${y0} ${x1},${y0} ${x2},${y2}`)
    })
  }

  // --- the loop ---
  let shown = 0
  let last = performance.now()
  let raf = 0
  let introDone = reduced
  let lastT = -1
  let dirty = true
  const frame = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    const target = window.scrollY
    // Smoothing similar to a scroll "sync" factor of ~0.9: catch up quickly but never snap.
    shown = reduced || dragging ? target : shown + (target - shown) * (1 - Math.pow(0.0008, dt))
    if (Math.abs(target - shown) < 0.1) shown = target
    const t = introDone ? timeAt(shown) : 0
    if (introDone && t !== lastT) {
      tl.seek(t)
      lastT = t
      dirty = true
    }
    const p = maxScroll() > 0 ? shown / maxScroll() : 0
    if (!dragging) drag.progressX = p
    setActive(chapterAt(shown + window.innerHeight * 0.5))
    // Redraw only when something moved.
    if (dirty) {
      W.render()
      dirty = false
    }
    if (chapterAt(shown) === 'toolbox' || chapterAt(shown) === 'intro') updateLines()
    raf = requestAnimationFrame(frame)
  }

  // Intro on load: ticks sweep in, the background arcs draw, the heading letters rise.
  const intro = reduced
    ? null
    : createTimeline({ onComplete: () => (introDone = true) })
        .add(ticks, { opacity: [0, 1], duration: 500, delay: stagger(4) }, 0)
        .add(createDrawable(bgArcs), { draw: ['0 0', '0 1'], duration: 900, delay: stagger(60), ease: 'inOut(3)' }, 100)
        .add(introSplit.chars, { y: [60, 0], opacity: [0, 1], duration: 600, delay: stagger(18), ease: 'out(3)' }, 250)
        .add(texts.intro.querySelectorAll('p'), { opacity: [0, 1], duration: 500 }, 800)
  const skipIntro = () => {
    if (!introDone) intro?.complete()
  }
  window.addEventListener('scroll', skipIntro, { once: true, passive: true })

  const onResize = () => {
    measure()
    W.resize()
    dirty = true
  }
  window.addEventListener('resize', onResize)
  raf = requestAnimationFrame(frame)

  return () => {
    cancelAnimationFrame(raf)
    window.removeEventListener('resize', onResize)
    window.removeEventListener('scroll', skipIntro)
    bar.removeEventListener('click', onBarClick)
    bar.removeEventListener('mousemove', onBarMove)
    bar.removeEventListener('mouseleave', onBarLeave)
    drag.revert()
    Object.values(live).forEach((d) => d.destroy())
    Object.values(scrambles).forEach((a) => a.pause())
    intro?.revert()
    tl.revert()
    introSplit.revert()
    W.destroy()
    // Put the dial back where React rendered it.
    dial.classList.remove('is-3d')
    dial.style.transform = ''
    dial.style.opacity = ''
    dialHome.parent.insertBefore(dial, dialHome.next)
    animate(document.body, { backgroundColor: BG_DARK, duration: 1 })
  }
}
