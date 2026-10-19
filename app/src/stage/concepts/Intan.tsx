import { animate, type JSAnimation } from 'animejs'
import { scrambleText } from 'animejs/text'
import { useEffect, useMemo, useRef } from 'react'
import { secureRandomInt } from '@/lib/random'
import { fitFontSize } from '@/stage/fit'
import type { ConceptProps } from '@/stage/useFrame'

/** Concept 2: names scramble and settle letter by letter, then a light sweeps across like a cut diamond. */

const NAME_W = 1640
const FIT = { maxSize: 200, minSize: 90, maxLines: 2, lineHeight: 1.04 }

/** Brilliant-cut diamond seen from above: table octagon, star facets, girdle. */
function useFacetPaths() {
  return useMemo(() => {
    const pt = (r: number, a: number) => `${(r * Math.cos(a)).toFixed(1)},${(r * Math.sin(a)).toFixed(1)}`
    const n = 8
    const table = Array.from({ length: n }, (_, i) => pt(260, (i / n) * Math.PI * 2 + Math.PI / 8))
    const girdle = Array.from({ length: n * 2 }, (_, i) => pt(520, (i / (n * 2)) * Math.PI * 2))
    const lines: string[] = [`M${table.join('L')}Z`, `M${girdle.join('L')}Z`]
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.PI / 8
      lines.push(`M${pt(260, a)}L${pt(520, a - Math.PI / 8)}`, `M${pt(260, a)}L${pt(520, a + Math.PI / 8)}`)
    }
    return lines
  }, [])
}

export function Intan({ stage, names }: ConceptProps) {
  const nameRef = useRef<HTMLSpanElement>(null)
  const sweepRef = useRef<HTMLSpanElement>(null)
  const anim = useRef<JSAnimation | null>(null)
  // anime.js scrambles a plain object; we copy into textContent so names are never parsed as HTML.
  const proxy = useRef({ textContent: '' })
  const facets = useFacetPaths()
  const { phase, winner, skip, reduced, landed } = stage

  const scrambleTo = (text: string, opts: { duration?: number; settleDuration?: number; revealRate?: number }, onDone?: () => void) => {
    const el = nameRef.current
    if (!el) return
    anim.current?.pause()
    el.textContent = text
    fitFontSize(el, FIT)
    if (reduced) {
      // Reduced motion: no letter scrambling, just swap the name (the CSS fades colour/opacity).
      proxy.current.textContent = text
      if (sweepRef.current) sweepRef.current.style.fontSize = el.style.fontSize
      onDone?.()
      return
    }
    el.textContent = proxy.current.textContent || text
    if (sweepRef.current) sweepRef.current.style.fontSize = el.style.fontSize
    anim.current = animate(proxy.current, {
      textContent: scrambleText({ text, chars: 'A-Za-z', from: 'left', ...opts }),
      onUpdate: () => {
        el.textContent = proxy.current.textContent
      },
      onComplete: () => {
        el.textContent = text
        onDone?.()
      },
    })
  }

  // Suspense: a new name scrambles in every ~half second.
  useEffect(() => {
    if (phase !== 'spinning') return
    const el = nameRef.current
    if (el) el.dataset.state = 'spinning'
    const next = () => scrambleTo(names[secureRandomInt(names.length)], { settleDuration: 160, revealRate: 140 })
    next()
    const t = setInterval(next, reduced ? 900 : 520)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, reduced, names])

  // Landing: the winner settles slowly from left to right.
  useEffect(() => {
    if (phase !== 'landing' || !winner) return
    const el = nameRef.current
    if (el) el.dataset.state = 'landing'
    if (reduced) {
      scrambleTo(winner, {})
      const t = setTimeout(landed, 500)
      return () => clearTimeout(t)
    }
    scrambleTo(winner, { duration: 2800, settleDuration: 700 }, landed)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, winner])

  useEffect(() => {
    if (phase === 'landing' && skip) anim.current?.complete()
  }, [phase, skip])

  useEffect(() => {
    const el = nameRef.current
    if (!el) return
    if (phase === 'revealed') el.dataset.state = 'revealed'
    if (phase === 'idle') {
      anim.current?.pause()
      proxy.current.textContent = ''
      el.textContent = ''
      el.dataset.state = 'idle'
    }
  }, [phase])

  useEffect(() => () => void anim.current?.pause(), [])

  return (
    <div className="intan absolute inset-0" data-phase={phase}>
      <svg
        className="intan-facets absolute left-1/2 top-[600px] -translate-x-1/2 -translate-y-1/2"
        width="1160"
        height="1160"
        viewBox="-580 -580 1160 1160"
        aria-hidden="true"
      >
        <g className="intan-facets-spin" fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke">
          {facets.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </g>
      </svg>

      <div className="absolute inset-x-0 top-[600px] flex -translate-y-1/2 justify-center text-center">
        <div className="relative" style={{ width: NAME_W }}>
          <span
            ref={nameRef}
            data-state="idle"
            className="intan-name block font-serif font-semibold text-balance"
            style={{ width: NAME_W, lineHeight: FIT.lineHeight, fontVariationSettings: '"opsz" 144, "SOFT" 30' }}
          />
          {phase === 'revealed' && winner && (
            <span
              ref={sweepRef}
              aria-hidden="true"
              className="intan-sweep absolute inset-0 block font-serif font-semibold text-balance"
              style={{ lineHeight: FIT.lineHeight, fontSize: nameRef.current?.style.fontSize, fontVariationSettings: '"opsz" 144, "SOFT" 30' }}
            >
              {winner}
            </span>
          )}
        </div>
      </div>

      {phase === 'revealed' && (
        <div className="absolute left-1/2 top-[600px]" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} className="intan-glint absolute block size-10" style={{ ['--i' as string]: i }} />
          ))}
        </div>
      )}
    </div>
  )
}
