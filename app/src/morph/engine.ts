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
import { explodedPosition } from '@/morph/three/model'
import { createWorld } from '@/morph/three/world'

/**
 * Scroll-scrubbed choreography for /morph.
 * One master timeline holds every chapter between labels (LABEL … LABEL_END). The page scroll is
 * mapped chapter by chapter onto that timeline and smoothed, so scrolling up plays it backwards.
 * The timeline drives the 3D world (engine case + CSS3D dial), the shader's light/line uniforms,
 * and the DOM (text, dial arcs, demos).
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

  // --- 3D stage: the WebGL engine case plus the HTML dial as a CSS3D object, one camera ---
  dial.classList.add('is-3d')
  const W = createWorld(stage, dial)
  const { world, model, uniforms } = W
  const N = model.modules.length
  const exploded = model.modules.map((_, i) => explodedPosition(i, N))
  const home = (i: number) => model.homes[i]
  const plateDir = (k: number) => {
    const a = (k * 2 * Math.PI) / 3 + Math.PI / 3
    return { x: Math.cos(a), y: Math.sin(a) }
  }
  const modPos = model.modules.map((m) => m.position)
  const modRot = model.modules.map((m) => m.rotation)
  const modScale = model.modules.map((m) => m.scale)
  const frontPos = model.front.map((m) => m.position)
  const backPos = model.back.map((m) => m.position)
  const plateScale = [...model.front, ...model.back].map((m) => m.scale)

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
  // On wide screens the tilted case sits right of centre, balancing the text column on the left.
  const SHIFT = window.innerWidth >= 900 ? window.innerWidth * 0.1 : 0
  const toExploded = (from: (i: number) => { x: number; y: number; z: number }, scale = 1) => ({
    x: (_?: unknown, i = 0) => [from(i).x, exploded[i].x * scale],
    y: (_?: unknown, i = 0) => [from(i).y, exploded[i].y * scale],
  })

  // HEADING: the dial and its case tip back in 3D; the case opens and its parts fan out.
  tl.label('HEADING')
    .label('HEADING_CASE', 'HEADING+=250')
    .add(introSplit.chars, { y: [0, -60], opacity: [1, 0], duration: 350, delay: stagger(6) }, 'HEADING')
    .add(texts.intro.querySelectorAll('p'), { opacity: [1, 0], duration: 250 }, 'HEADING')
    .add(world.rotation, { x: [0, r(-62)], y: [0, r(-38)], z: [0, r(-10)], duration: 1000, ease: 'inOut(3)' }, 'HEADING')
    .add(world.position, { z: [0, -540], y: [0, 70], x: [0, SHIFT], duration: 1000, ease: 'inOut(3)' }, 'HEADING')
    .add(uniforms.uLines, { value: [0, 1], duration: 350 }, 'HEADING+=80')
    .add(hero, { opacity: [1, 0], scale: [1, 0.5], duration: 450 }, 'HEADING+=150')
    .add(ticks, { opacity: [1, 0.35], duration: 400 }, 'HEADING+=200')
    .add(model.caseRing.rotation, { z: [r(180), 0], duration: 500, ease: 'inOut(3)' }, 'HEADING+=100')
    .add(frontPos, {
      x: (_?: unknown, k = 0) => [0, plateDir(k).x * 1.9],
      y: (_?: unknown, k = 0) => [0, plateDir(k).y * 1.9],
      z: [-0.06, 0.6],
      duration: 450,
      delay: stagger(40),
      ease: 'in(2)',
    }, 'HEADING_CASE')
    .add(backPos, {
      x: (_?: unknown, k = 0) => [0, plateDir(k).x * 1.9],
      y: (_?: unknown, k = 0) => [0, plateDir(k).y * 1.9],
      z: [-0.42, -1.2],
      duration: 450,
      delay: stagger(40),
      ease: 'in(2)',
    }, 'HEADING_CASE+=100')
    .add(plateScale, { x: [1, 0.001], y: [1, 0.001], z: [1, 0.001], duration: 300, delay: stagger(30) }, 'HEADING_CASE+=200')
    .add(model.vent.rotation, { z: [0, r(160)], duration: 700 }, 'HEADING_CASE')
    .add(model.vent.position, { z: [-0.48, -3.4], duration: 600 }, 'HEADING_CASE+=100')
    .add(modPos, {
      ...toExploded(home),
      z: (_?: unknown, i = 0) => [home(i).z, exploded[i].z],
      duration: 600,
      delay: stagger(30),
      ease: 'out(3)',
    }, 'HEADING_CASE+=50')
    .add(modScale, { x: [0.85, 1], y: [0.85, 1], z: [0.85, 1], duration: 600 }, 'HEADING_CASE+=50')
    .label('HEADING_END', len('intro'))

  // TOOLBOX: light page; leader lines reach out to the labelled parts; the exploded case keeps turning.
  const TB = len('toolbox')
  const tbEnd = (back: number) => `TOOLBOX+=${TB - back}`
  tl.label('TOOLBOX', 'HEADING_END')
    .add(document.body, { backgroundColor: [BG_DARK, BG_LIGHT], duration: 250 }, 'TOOLBOX')
    .add(uniforms.uLightMode, { value: [0, 1], duration: 250 }, 'TOOLBOX')
    .add(texts.toolbox, { opacity: [0, 1], duration: 250 }, 'TOOLBOX+=150')
    .add(bgArcs, { color: ['#3f3e3d', '#b5afa8'], duration: 250 }, 'TOOLBOX')
    .add(world.rotation, { y: [r(-38), r(-64)], x: [r(-62), r(-56)], duration: TB - 400, ease: 'linear' }, 'TOOLBOX')
    .add(world.position, { z: [-540, -660], duration: TB - 400, ease: 'linear' }, 'TOOLBOX')
    .add(modRot, { y: [0, r(180)], duration: TB - 400, ease: 'linear', delay: stagger(20) }, 'TOOLBOX')
    .add(labels, { opacity: [0, 1], duration: 200, delay: stagger(40) }, 'TOOLBOX+=300')
    .add(drawLines, { strokeDashoffset: [1, 0], duration: 400, delay: stagger(40) }, 'TOOLBOX+=300')
    .add(labels, { opacity: [1, 0], duration: 200, delay: stagger(20) }, tbEnd(500))
    .add(drawLines, { strokeDashoffset: [0, 1], duration: 250, delay: stagger(20) }, tbEnd(500))
    .add(texts.toolbox, { opacity: [1, 0], duration: 200 }, tbEnd(350))
    // Close the case again and face the viewer for the feature chapters.
    .add(modPos, {
      x: (_?: unknown, i = 0) => [exploded[i].x, home(i).x],
      y: (_?: unknown, i = 0) => [exploded[i].y, home(i).y],
      z: (_?: unknown, i = 0) => [exploded[i].z, home(i).z],
      duration: 380,
      delay: stagger(15),
    }, tbEnd(420))
    .add(modScale, { x: [1, 0.85], y: [1, 0.85], z: [1, 0.85], duration: 380 }, tbEnd(420))
    .add(plateScale, { x: [0.001, 1], y: [0.001, 1], z: [0.001, 1], duration: 1 }, tbEnd(400))
    .add(frontPos, {
      x: (_?: unknown, k = 0) => [plateDir(k).x * 1.9, 0],
      y: (_?: unknown, k = 0) => [plateDir(k).y * 1.9, 0],
      z: [0.6, -0.06],
      duration: 380,
    }, tbEnd(400))
    .add(backPos, {
      x: (_?: unknown, k = 0) => [plateDir(k).x * 1.9, 0],
      y: (_?: unknown, k = 0) => [plateDir(k).y * 1.9, 0],
      z: [-1.2, -0.42],
      duration: 380,
    }, tbEnd(400))
    .add(model.vent.position, { z: [-3.4, -0.48], duration: 380 }, tbEnd(400))
    .add(world.rotation, { x: [r(-56), 0], y: [r(-64), 0], z: [r(-10), 0], duration: 400, ease: 'inOut(3)' }, tbEnd(400))
    .add(world.position, { z: [-660, 0], y: [70, 0], x: [SHIFT, 0], duration: 400, ease: 'inOut(3)' }, tbEnd(400))
    .add(uniforms.uLines, { value: [1, 0], duration: 250 }, tbEnd(250))
    .add(document.body, { backgroundColor: [BG_LIGHT, BG_DARK], duration: 250 }, tbEnd(300))
    .add(uniforms.uLightMode, { value: [1, 0], duration: 250 }, tbEnd(300))
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

  // MODULES: light again. The scene turns, the case opens, the parts spin, shrink to the core and the case closes around them.
  const M = len('modules')
  const mEnd = (back: number) => `MODULES+=${M - back}`
  const midZ = (i: number) => -0.6 - (i % 3) * 0.3
  tl.label('MODULES', prev)
    .label('MODULES_TRANSFORM', 'MODULES+=500')
    .label('MODULES_SHRINK', 'MODULES+=1150')
    .label('MODULES_CASE', 'MODULES+=1500')
    .add(document.body, { backgroundColor: [BG_DARK, BG_LIGHT], duration: 250 }, 'MODULES')
    .add(uniforms.uLightMode, { value: [0, 1], duration: 250 }, 'MODULES')
    .add(uniforms.uLines, { value: [0, 1], duration: 250 }, 'MODULES')
    .add(bgArcs, { color: ['#3f3e3d', '#b5afa8'], duration: 250 }, 'MODULES')
    .add(ticks, { color: '#8f8a84', duration: 250 }, 'MODULES')
    .add(texts.modules, { opacity: [0, 1], duration: 250 }, 'MODULES+=150')
    .add(world.rotation, { x: [0, r(-55)], y: [0, r(40)], duration: 900, ease: 'inOut(3)' }, 'MODULES')
    .add(world.position, { z: [0, -480], x: [0, SHIFT * 1.2], duration: 900, ease: 'inOut(3)' }, 'MODULES')
    .add(plateScale, { x: [1, 0.001], y: [1, 0.001], z: [1, 0.001], duration: 250, delay: stagger(20) }, 'MODULES+=250')
    .add(modPos, {
      ...toExploded(home, 0.7),
      z: (_?: unknown, i = 0) => [home(i).z, midZ(i)],
      duration: 500,
      delay: stagger(25),
      ease: 'out(3)',
    }, 'MODULES+=250')
    .add(modRot, { y: [r(180), r(540)], duration: 600, delay: stagger(20) }, 'MODULES_TRANSFORM')
    .add(modPos, {
      x: (_?: unknown, i = 0) => [exploded[i].x * 0.7, 0],
      y: (_?: unknown, i = 0) => [exploded[i].y * 0.7, 0],
      z: (_?: unknown, i = 0) => [midZ(i), -0.25],
      duration: 400,
      delay: stagger(20),
      ease: 'in(2)',
    }, 'MODULES_SHRINK')
    .add(modScale, { x: [0.85, 0.15], y: [0.85, 0.15], z: [0.85, 0.15], duration: 400, delay: stagger(20) }, 'MODULES_SHRINK')
    .add(plateScale, { x: [0.001, 1], y: [0.001, 1], z: [0.001, 1], duration: 300, delay: stagger(30), ease: 'out(3)' }, 'MODULES_CASE')
    .add(model.caseRing.rotation, { z: [0, r(-180)], duration: 500, ease: 'inOut(3)' }, 'MODULES_CASE')
    .add(bars, { scaleX: [0, 1], duration: 500, delay: stagger(40), ease: 'out(3)' }, 'MODULES+=400')
    .add(bars, { scaleX: [1, 0], duration: 250, delay: stagger(15) }, mEnd(500))
    .add(texts.modules, { opacity: [1, 0], duration: 200 }, mEnd(350))
    .add(world.rotation, { x: [r(-55), 0], y: [r(40), 0], duration: 450, ease: 'inOut(3)' }, mEnd(450))
    .add(world.position, { z: [-480, 0], x: [SHIFT * 1.2, 0], duration: 450, ease: 'inOut(3)' }, mEnd(450))
    .add(modScale, { x: [0.15, 0.85], y: [0.15, 0.85], z: [0.15, 0.85], duration: 1 }, mEnd(250))
    .add(modPos, {
      x: (_?: unknown, i = 0) => [0, home(i).x],
      y: (_?: unknown, i = 0) => [0, home(i).y],
      z: (_?: unknown, i = 0) => [-0.25, home(i).z],
      duration: 1,
    }, mEnd(250))
    .add(uniforms.uLines, { value: [1, 0], duration: 250 }, mEnd(300))
    .add(document.body, { backgroundColor: [BG_LIGHT, BG_DARK], duration: 250 }, mEnd(300))
    .add(uniforms.uLightMode, { value: [1, 0], duration: 250 }, mEnd(300))
    .add(bgArcs, { color: ['#b5afa8', '#3f3e3d'], duration: 250 }, mEnd(300))
    .add(ticks, { color: '#ff4b4b', duration: 250 }, mEnd(300))
    .label('MODULES_END', `MODULES+=${M}`)

  // SPONSORS: a heart of dots fills the dial.
  const S = len('sponsors')
  tl.label('SPONSORS', 'MODULES_END')
    .add(heartDots, { scale: [0, 1], opacity: [0, 1], duration: 350, ease: 'out(3)' }, 'SPONSORS')
    .add(texts.sponsors, { opacity: [0, 1], duration: 200 }, 'SPONSORS+=100')
    .add(texts.sponsors, { opacity: [1, 0], duration: 200 }, `SPONSORS+=${S - 220}`)
    .add(heartDots, { scale: [1, 0], opacity: [1, 0], duration: 250 }, `SPONSORS+=${S - 250}`)
    .label('SPONSORS_END', `SPONSORS+=${S}`)

  // END: the case reappears and the whole thing tips forward and rises away; closing text.
  tl.label('END', 'SPONSORS_END')
    .add(uniforms.uLines, { value: [0, 1], duration: 300 }, 'END')
    .add(world.rotation, { x: [0, r(28)], y: [0, r(-20)], duration: 900, ease: 'inOut(3)' }, 'END')
    .add(world.position, { y: [0, 160], z: [0, -260], duration: 900, ease: 'inOut(3)' }, 'END')
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

  // --- toolbox leader lines: label edge → elbow → the 3D part's centre on screen ---
  const lineSvg = $<SVGSVGElement>('.mx-lines')
  const updateLines = () => {
    const vb = lineSvg.getBoundingClientRect()
    lines.forEach((line, i) => {
      const label = labels[i]
      const part = model.modules[i]
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
  let lastLines = 1 // first frame always draws the WebGL background
  let lastLight = -1
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
    // Redraw only when something moved; skip WebGL entirely while the case is invisible.
    if (dirty) {
      const lines = uniforms.uLines.value
      const light = uniforms.uLightMode.value
      W.render({ gl: lines > 0.001 || lastLines > 0.001 || light !== lastLight })
      lastLines = lines
      lastLight = light
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
    lastLines = 1 // force a full redraw
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
    dialHome.parent.insertBefore(dial, dialHome.next)
    animate(document.body, { backgroundColor: BG_DARK, duration: 1 })
  }
}
