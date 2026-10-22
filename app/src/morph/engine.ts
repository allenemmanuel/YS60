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

/**
 * Scroll-scrubbed choreography for /morph.
 * One master timeline holds every chapter between labels (LABEL … LABEL_END). The page scroll is
 * mapped chapter by chapter onto that timeline and smoothed, so scrolling up plays it backwards.
 */

const SEG = 1000 // timeline milliseconds per viewport-height of scroll

export function initMorph(root: HTMLElement, reduced: boolean): () => void {
  const $ = <T extends Element = HTMLElement>(sel: string) => root.querySelector(sel) as T
  const $$ = <T extends Element = HTMLElement>(sel: string) => Array.from(root.querySelectorAll(sel)) as T[]

  const scene = $('.mx-scene')
  const hero = $<HTMLCanvasElement>('.mx-hero')
  const ticks = $$('.mx-tick')
  const bgArcs = $$('.mx-arc-bg')
  const arcs = $$<SVGPathElement>('.mx-arc')
  const markers = $$('.mx-marker')
  const labels = $$('.mx-label')
  const lines = $$<SVGPolylineElement>('.mx-line')
  const demos = FEATURES.map((f) => $(`[data-demo="${f.id}"]`))
  const texts = Object.fromEntries($$('[data-text]').map((el) => [el.dataset.text!, el]))
  const sections = $$('[data-chapter]')
  const heartDots = $('.mx-heart')
  const bars = $$('.mx-bar')

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
  utils.set(markers, { opacity: 0, scale: 0 })
  utils.set(labels, { opacity: 0 })
  utils.set(heartDots, { scale: 0, opacity: 0 })
  utils.set(bars, { scaleX: 0 })
  const sphere = createDrawable($$('.mx-sphere path'))
  utils.set(sphere, { draw: '0 0' })

  // Marker resting spots: spread around the dial at different depths (placeholders for Drop B's 3D parts).
  const spread = markers.map((_, i) => {
    const a = (i / markers.length) * Math.PI * 2 + 0.4
    const r = 150 + (i % 3) * 60
    return { x: Math.cos(a) * r, y: Math.sin(a) * r, z: ((i % 4) - 1.5) * 90 }
  })

  // --- master timeline ---
  const tl: Timeline = createTimeline({ autoplay: false, defaults: { ease: 'inOut(2)', composition: 'none' } })
  const len = (id: string) => CHAPTERS.find((c) => c.id === id)!.length * SEG

  // HEADING: the dial tips back in 3D and the intro text leaves.
  tl.label('HEADING')
    .add(introSplit.chars, { y: [0, -60], opacity: [1, 0], duration: 350, delay: stagger(6) }, 'HEADING')
    .add(texts.intro.querySelectorAll('p'), { opacity: [1, 0], duration: 250 }, 'HEADING')
    .add(scene, { z: [0, -260], rotateX: [0, 62], rotateY: [0, -32], y: [0, 40], duration: 1000, ease: 'inOut(3)' }, 'HEADING')
    .add(hero, { opacity: [1, 0], scale: [1, 0.5], duration: 450 }, 'HEADING+=150')
    .add(ticks, { opacity: [1, 0.35], duration: 400 }, 'HEADING+=200')
    .add(markers, {
      x: (_?: unknown, i = 0) => [0, spread[i].x],
      y: (_?: unknown, i = 0) => [0, spread[i].y],
      z: (_?: unknown, i = 0) => [0, spread[i].z],
      scale: [0, 1],
      opacity: [0, 1],
      duration: 600,
      delay: stagger(25),
      ease: 'out(3)',
    }, 'HEADING+=300')
    .label('HEADING_END', len('intro'))

  // TOOLBOX: light background, leader lines reach out to the labelled parts.
  const T = 'HEADING_END'
  tl.label('TOOLBOX', T)
    .add(document.body, { backgroundColor: [BG_DARK, BG_LIGHT], duration: 250 }, 'TOOLBOX')
    .add(texts.toolbox, { opacity: [0, 1], duration: 250 }, 'TOOLBOX+=150')
    .add(bgArcs, { color: ['#3f3e3d', '#b5afa8'], duration: 250 }, 'TOOLBOX')
    .add(scene, { rotateY: [-32, -58], rotateX: [62, 58], z: [-260, -320], duration: len('toolbox') - 400, ease: 'linear' }, 'TOOLBOX')
    .add(labels, { opacity: [0, 1], duration: 200, delay: stagger(40) }, 'TOOLBOX+=300')
    .add(drawLines, { strokeDashoffset: [1, 0], duration: 400, delay: stagger(40) }, 'TOOLBOX+=300')
    .add(labels, { opacity: [1, 0], duration: 200, delay: stagger(20) }, `TOOLBOX+=${len('toolbox') - 500}`)
    .add(drawLines, { strokeDashoffset: [0, 1], duration: 250, delay: stagger(20) }, `TOOLBOX+=${len('toolbox') - 500}`)
    .add(texts.toolbox, { opacity: [1, 0], duration: 200 }, `TOOLBOX+=${len('toolbox') - 350}`)
    .add(document.body, { backgroundColor: [BG_LIGHT, BG_DARK], duration: 250 }, `TOOLBOX+=${len('toolbox') - 300}`)
    .add(bgArcs, { color: ['#b5afa8', '#3f3e3d'], duration: 250 }, `TOOLBOX+=${len('toolbox') - 300}`)
    .add(scene, { z: [-320, 0], rotateX: [58, 0], rotateY: [-58, 0], y: [40, 0], duration: 400, ease: 'inOut(3)' }, `TOOLBOX+=${len('toolbox') - 400}`)
    .add(markers, { scale: [1, 0], opacity: [1, 0], duration: 300, delay: stagger(15) }, `TOOLBOX+=${len('toolbox') - 400}`)
    .label('TOOLBOX_END', `TOOLBOX+=${len('toolbox')}`)

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

  // MODULES: light again; the scene turns and the parts gather into the centre while the size bars grow.
  const M = len('modules')
  tl.label('MODULES', prev)
    .add(document.body, { backgroundColor: [BG_DARK, BG_LIGHT], duration: 250 }, 'MODULES')
    .add(bgArcs, { color: ['#3f3e3d', '#b5afa8'], duration: 250 }, 'MODULES')
    .add(ticks, { color: '#8f8a84', duration: 250 }, 'MODULES')
    .add(texts.modules, { opacity: [0, 1], duration: 250 }, 'MODULES+=150')
    .add(scene, { rotateX: [0, 55], rotateY: [0, 40], z: [0, -220], duration: 900, ease: 'inOut(3)' }, 'MODULES')
    .add(markers, {
      x: (_?: unknown, i = 0) => [spread[i].x * 1.4, 0],
      y: (_?: unknown, i = 0) => [spread[i].y * 1.4, 0],
      z: (_?: unknown, i = 0) => [spread[i].z * 2, 0],
      scale: [1, 0.2],
      opacity: [1, 0],
      duration: 900,
      delay: stagger(30),
    }, 'MODULES+=250')
    .add(bars, { scaleX: [0, 1], duration: 500, delay: stagger(40), ease: 'out(3)' }, 'MODULES+=400')
    .add(bars, { scaleX: [1, 0], duration: 250, delay: stagger(15) }, `MODULES+=${M - 500}`)
    .add(texts.modules, { opacity: [1, 0], duration: 200 }, `MODULES+=${M - 350}`)
    .add(scene, { rotateX: [55, 0], rotateY: [40, 0], z: [-220, 0], duration: 450, ease: 'inOut(3)' }, `MODULES+=${M - 450}`)
    .add(document.body, { backgroundColor: [BG_LIGHT, BG_DARK], duration: 250 }, `MODULES+=${M - 300}`)
    .add(bgArcs, { color: ['#b5afa8', '#3f3e3d'], duration: 250 }, `MODULES+=${M - 300}`)
    .add(ticks, { color: '#ff4b4b', duration: 250 }, `MODULES+=${M - 300}`)
    .label('MODULES_END', `MODULES+=${M}`)

  // SPONSORS: a heart of dots fills the dial.
  const S = len('sponsors')
  tl.label('SPONSORS', 'MODULES_END')
    .add(heartDots, { scale: [0, 1], opacity: [0, 1], duration: 350, ease: 'out(3)' }, 'SPONSORS')
    .add(texts.sponsors, { opacity: [0, 1], duration: 200 }, 'SPONSORS+=100')
    .add(texts.sponsors, { opacity: [1, 0], duration: 200 }, `SPONSORS+=${S - 220}`)
    .add(heartDots, { scale: [1, 0], opacity: [1, 0], duration: 250 }, `SPONSORS+=${S - 250}`)
    .label('SPONSORS_END', `SPONSORS+=${S}`)

  // END: the dial rises away; closing text.
  tl.label('END', 'SPONSORS_END')
    .add(scene, { rotateX: [0, -25], y: [0, -140], z: [0, -200], duration: 900, ease: 'inOut(3)' }, 'END')
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
    for (const r of ranges) {
      if (y < r.to) return r.t0 + Math.max(0, Math.min(1, (y - r.from) / (r.to - r.from))) * (r.t1 - r.t0)
    }
    return tl.duration
  }
  const chapterAt = (y: number) => ranges.find((r) => y < r.to)?.id ?? 'end'

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
    const r = bar.getBoundingClientRect()
    jump((e.clientX - r.left) / r.width)
  }
  const onBarMove = (e: MouseEvent) => {
    const r = bar.getBoundingClientRect()
    ghost.style.transform = `translateX(${e.clientX - r.left}px)`
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

  // --- toolbox leader lines: label edge → elbow → marker centre, in screen space ---
  const lineSvg = $<SVGSVGElement>('.mx-lines')
  const updateLines = () => {
    const vb = lineSvg.getBoundingClientRect()
    lines.forEach((line, i) => {
      const label = labels[i]
      const marker = markers[i]
      if (!label || !marker) return
      const lr = label.getBoundingClientRect()
      const mr = marker.getBoundingClientRect()
      const left = label.dataset.side === 'left'
      const x0 = (left ? lr.right + 8 : lr.left - 8) - vb.left
      const y0 = lr.top + lr.height / 2 - vb.top
      const x2 = mr.left + mr.width / 2 - vb.left
      const y2 = mr.top + mr.height / 2 - vb.top
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
  const frame = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    const target = window.scrollY
    // Smoothing similar to a scroll "sync" factor of ~0.9: catch up quickly but never snap.
    shown = reduced || dragging ? target : shown + (target - shown) * (1 - Math.pow(0.0008, dt))
    if (Math.abs(target - shown) < 0.1) shown = target
    if (introDone) tl.seek(timeAt(shown))
    const p = maxScroll() > 0 ? shown / maxScroll() : 0
    if (!dragging) drag.progressX = p
    setActive(chapterAt(shown + window.innerHeight * 0.5))
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

  const onResize = () => measure()
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
    animate(document.body, { backgroundColor: BG_DARK, duration: 1 })
  }
}
