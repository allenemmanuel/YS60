import { useReducedMotion } from 'motion/react'
import { useEffect, useMemo, useRef } from 'react'
import { ARC_COLORS, BG_DARK, CHAPTERS, FEATURES, PART_SIZES, PARTS_LEFT, PARTS_RIGHT } from '@/morph/content'
import { initMorph } from '@/morph/engine'
import { arcPath, circuitPaths, DIAL, heartGrid, sphereRings, ticks } from '@/morph/geometry'
import '@/morph/morph.css'

/**
 * /morph: a scroll-scrubbed study of the animejs.com landing page.
 * The dial (HTML/SVG) is placed into a Three.js scene with the engine case (see morph/three).
 */
export function MorphPage() {
  const rootRef = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion() ?? false
  const tickList = useMemo(() => ticks(120, 262, 276), [])
  const rings = useMemo(() => sphereRings(12, 300), [])
  const [circuitA, circuitB] = useMemo(() => circuitPaths(300), [])
  const heart = useMemo(() => heartGrid(15), [])
  const parts = [...PARTS_LEFT, ...PARTS_RIGHT]
  const maxSize = Math.max(...PART_SIZES.map(([, s]) => s))

  useEffect(() => {
    const prev = document.body.style.backgroundColor
    document.body.style.backgroundColor = BG_DARK
    window.scrollTo(0, 0)
    const cleanup = initMorph(rootRef.current!, reduced)
    return () => {
      cleanup()
      document.body.style.backgroundColor = prev
    }
  }, [reduced])

  return (
    <div ref={rootRef} className="mx">
      {/* Fixed 3D stage */}
      <div className="mx-stage" aria-hidden="true">
        <div className="mx-scene">
          <svg className="mx-dial" viewBox={`0 0 ${DIAL} ${DIAL}`}>
            <g className="mx-ticks">
              {tickList.map((t, i) => (
                <line key={i} className="mx-tick" x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} />
              ))}
            </g>
            <g fill="none" strokeWidth="5" strokeLinecap="round">
              {ARC_COLORS.map((_, k) => (
                <path key={k} className="mx-arc-bg" d={arcPath(k, ARC_COLORS.length)} stroke="currentColor" />
              ))}
              {ARC_COLORS.map((c, k) => (
                <path key={k} className="mx-arc" d={arcPath(k, ARC_COLORS.length)} stroke={c} style={{ color: c }} />
              ))}
            </g>
          </svg>

          <canvas className="mx-hero" />

          {/* Feature demos, centred in the dial */}
          <div className="mx-demo" data-demo="intuitive">
            <div className="square" />
          </div>
          <div className="mx-demo" data-demo="composition">
            {Array.from({ length: 12 }, (_, i) => (
              <div key={i} className={`shape ${i % 2 ? 'square' : 'circle'} ${Math.floor(i / 2) % 2 ? 'fill' : ''}`} />
            ))}
          </div>
          <div className="mx-demo" data-demo="scroll">
            <svg className="mx-sphere" viewBox="0 0 300 300">
              <g fill="none" stroke="currentColor" strokeWidth="2.5" transform="rotate(-40 150 150)">
                {rings.map((d, i) => (
                  <path key={i} d={d} />
                ))}
              </g>
            </svg>
          </div>
          <div className="mx-demo" data-demo="staggering">
            <div className="grid">
              {Array.from({ length: 169 }, (_, i) => (
                <div key={i} className="dot" />
              ))}
            </div>
          </div>
          <div className="mx-demo" data-demo="svg">
            <svg viewBox="0 0 300 300">
              <path className="circuit" d={circuitA} fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
              <path className="circuit-b" d={circuitB} fill="none" stroke="none" />
              <g className="car">
                <rect x="-11" y="-7" width="22" height="14" rx="4" fill="currentColor" />
              </g>
            </svg>
          </div>
          <div className="mx-demo" data-demo="draggable">
            <div className="drag-area">
              <div className="circle">
                <span />
              </div>
            </div>
          </div>
          <div className="mx-demo" data-demo="clockwork">
            <div className="clock">
              {Array.from({ length: 60 }, (_, i) => (
                <div key={i} className="clock-slot" style={{ transform: `rotate(${i * 6}deg)` }}>
                  <div className={`clock-tick ${i % 5 === 0 ? 'major' : ''}`} />
                </div>
              ))}
              <div className="clock-hand" />
            </div>
          </div>
          <div className="mx-demo" data-demo="responsive">
            <div className="viewport">
              {Array.from({ length: 24 }, (_, i) => (
                <div key={i} className="cell" />
              ))}
            </div>
          </div>

          <div className="mx-heart">
            {heart.map((d, i) => (
              <div key={i} className="heart-dot" style={{ left: `${d.x * 100}%`, top: `${d.y * 100}%`, opacity: 0.35 + d.edge * 0.65 }} />
            ))}
          </div>
        </div>
      </div>

      {/* Leader lines for the toolbox labels */}
      <svg className="mx-lines" aria-hidden="true">
        {parts.map((p) => (
          <polyline key={p} className="mx-line" fill="none" />
        ))}
      </svg>

      {/* Fixed text layer, shown and hidden by the timeline */}
      <div className="mx-texts">
        <div className="mx-text" data-text="intro">
          <h1>One dial, endless motion.</h1>
          <p>A scroll-driven study: scroll down and everything plays forward; scroll up and it rewinds.</p>
        </div>
        <div className="mx-text dark-on-light" data-text="toolbox">
          <h2>Every part in its place</h2>
          <p>The dial tips back to show the parts that make it move. Each line points to one.</p>
        </div>
        <ul className="mx-labels left">
          {PARTS_LEFT.map((p) => (
            <li key={p} className="mx-label" data-side="left">
              {p}
            </li>
          ))}
        </ul>
        <ul className="mx-labels right">
          {PARTS_RIGHT.map((p) => (
            <li key={p} className="mx-label" data-side="right">
              {p}
            </li>
          ))}
        </ul>
        {FEATURES.map((f) => (
          <div key={f.id} className="mx-text" data-text={f.id} style={{ ['--c' as string]: f.color }}>
            <h2>{f.title}</h2>
            <p>{f.body}</p>
            <ul>
              {f.points.map((pt) => (
                <li key={pt}>{pt}</li>
              ))}
            </ul>
          </div>
        ))}
        <div className="mx-text dark-on-light" data-text="modules">
          <h2>Small parts, light load</h2>
          <p>Every part is optional. Bring only the ones you use.</p>
          <div className="mx-bars">
            {PART_SIZES.map(([name, size], i) => (
              <div key={name} className="mx-bar-row">
                <span>{name}</span>
                <div className="mx-bar" style={{ width: `${(size / maxSize) * 100}%`, background: ARC_COLORS[i % ARC_COLORS.length] }} />
              </div>
            ))}
          </div>
        </div>
        <div className="mx-text" data-text="sponsors">
          <h2>Made with heart</h2>
          <p>A small thank-you, drawn in dots.</p>
        </div>
        <div className="mx-text" data-text="end">
          <h2>That’s the tour.</h2>
          <p>Scroll back up and watch it all rewind.</p>
        </div>
      </div>

      {/* Scroll length: one spacer per chapter */}
      <main className="mx-chapters">
        {CHAPTERS.map((c) => (
          <section key={c.id} data-chapter={c.id} style={{ height: `${c.length * 100}lvh` }} />
        ))}
      </main>
      <footer className="mx-footer">Technique study for YS60, after the Anime.js landing page. Our own code, shapes and copy.</footer>

      {/* Scroll bar: click or drag to jump between chapters */}
      <div className="mx-scrollcard">
        <div className="mx-scrollbar" role="presentation">
          <div className="mx-ghost" />
          <div className="mx-cursor" />
        </div>
      </div>
    </div>
  )
}
