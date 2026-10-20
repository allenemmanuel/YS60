import { animate, createTimeline, stagger, utils, type JSAnimation, type Timeline } from 'animejs'
import { useEffect, useRef } from 'react'
import { secureRandomInt } from '@/lib/random'
import { FitName } from '@/stage/FitName'
import type { ConceptProps } from '@/stage/useFrame'

/** Concept: invitation cards fan out and shuffle; one slides out, grows and flips to show the winner. */

const COUNT = 21
const CARD_W = 1500
const CARD_H = 560
const SMALL = 0.2
const CENTER_Y = 600

const slotPose = (slot: number) => {
  const a = -60 + slot * (120 / (COUNT - 1))
  const rad = (a * Math.PI) / 180
  return { translateX: Math.sin(rad) * 760, translateY: 700 - Math.cos(rad) * 760 - 120, rotate: a, scale: SMALL, rotateY: 0, opacity: 1 }
}

const deckPose = (i: number) => ({ translateX: 0, translateY: 80 - i * 3, rotate: ((i * 37) % 7) - 3, scale: SMALL, rotateY: 0, opacity: 1 })

export function Kad({ stage }: ConceptProps) {
  const cardRefs = useRef<(HTMLDivElement | null)[]>([])
  const slots = useRef<number[]>(Array.from({ length: COUNT }, (_, i) => i))
  const running = useRef<(JSAnimation | Timeline)[]>([])
  const { phase, winner, skip, reduced, landed } = stage
  const WIN = COUNT - 1 // top card of the deck

  const cards = () => cardRefs.current.filter((c): c is HTMLDivElement => !!c)
  const track = <T extends JSAnimation | Timeline>(a: T) => {
    running.current.push(a)
    return a
  }
  const stopAll = () => {
    running.current.forEach((a) => a.pause())
    running.current = []
  }

  // Initial deck.
  useEffect(() => {
    cards().forEach((c, i) => utils.set(c, deckPose(i)))
    return stopAll
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Spinning: fan out, then keep swapping pairs of cards.
  useEffect(() => {
    if (phase !== 'spinning') return
    const els = cards()
    stopAll()
    if (reduced) return
    track(
      animate(els, {
        translateX: (_?: unknown, i = 0) => slotPose(slots.current[i]).translateX,
        translateY: (_?: unknown, i = 0) => slotPose(slots.current[i]).translateY,
        rotate: (_?: unknown, i = 0) => slotPose(slots.current[i]).rotate,
        delay: stagger(22, { from: 'center' }),
        duration: 650,
        ease: 'out(3)',
      }),
    )
    const t = setInterval(() => {
      const a = secureRandomInt(COUNT)
      let b = secureRandomInt(COUNT)
      if (b === a) b = (a + 1) % COUNT
      ;[slots.current[a], slots.current[b]] = [slots.current[b], slots.current[a]]
      for (const i of [a, b]) {
        const p = slotPose(slots.current[i])
        track(
          animate(els[i], {
            translateX: p.translateX,
            translateY: [{ to: p.translateY - 160, duration: 190, ease: 'out(3)' }, { to: p.translateY, duration: 230, ease: 'inOut(3)' }],
            rotate: { to: p.rotate, duration: 420, ease: 'inOut(3)' },
            scale: [{ to: SMALL * 1.18, duration: 190 }, { to: SMALL, duration: 230 }],
            duration: 420,
            ease: 'inOut(3)',
          }),
        )
      }
    }, 240)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, reduced])

  // Landing: gather into the deck, then the top card comes forward and flips.
  useEffect(() => {
    if (phase !== 'landing' || !winner) return
    const els = cards()
    stopAll()
    const top = els[WIN]
    const others = els.filter((_, i) => i !== WIN)
    if (reduced) {
      others.forEach((c) => utils.set(c, { opacity: 0 }))
      utils.set(top, { translateX: 0, translateY: 0, rotate: 0, scale: 1, rotateY: 180, opacity: 0 })
      track(animate(top, { opacity: 1, duration: 400, ease: 'out(2)', onComplete: landed }))
      return
    }
    const tl = track(createTimeline({ onComplete: landed }))
    tl.add(els, {
      translateX: 0,
      translateY: (_?: unknown, i = 0) => deckPose(i).translateY,
      rotate: (_?: unknown, i = 0) => deckPose(i).rotate,
      scale: SMALL,
      delay: stagger(18, { from: 'last' }),
      duration: 520,
      ease: 'inOut(3)',
    })
      .add(others, { translateY: 760, opacity: 0, delay: stagger(16), duration: 700, ease: 'in(2)' }, '+=250')
      .add(top, { translateY: [{ to: -120, duration: 450, ease: 'out(3)' }, { to: 0, duration: 900, ease: 'out(4)' }], scale: { to: 1, duration: 1350, ease: 'inOut(3)' }, rotate: { to: 0, duration: 600 } }, '<<')
      .add(top, { rotateY: 180, duration: 900, ease: 'out(4)' }, '-=650')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, winner])

  useEffect(() => {
    if (phase === 'landing' && skip) running.current.forEach((a) => a.complete())
  }, [phase, skip])

  // Next prize: the winning card goes back on the deck.
  useEffect(() => {
    if (phase !== 'idle') return
    const els = cards()
    if (!els.length) return
    stopAll()
    slots.current = Array.from({ length: COUNT }, (_, i) => i)
    if (reduced) {
      els.forEach((c, i) => utils.set(c, deckPose(i)))
      return
    }
    track(
      animate(els, {
        translateX: 0,
        translateY: (_?: unknown, i = 0) => deckPose(i).translateY,
        rotate: (_?: unknown, i = 0) => deckPose(i).rotate,
        scale: SMALL,
        rotateY: 0,
        opacity: 1,
        delay: stagger(15),
        duration: 600,
        ease: 'inOut(3)',
      }),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  return (
    <div className="absolute inset-0" style={{ perspective: 2600 }}>
      {Array.from({ length: COUNT }, (_, i) => (
        <div
          key={i}
          ref={(el) => {
            cardRefs.current[i] = el
          }}
          className="absolute"
          style={{ left: 960 - CARD_W / 2, top: CENTER_Y - CARD_H / 2, width: CARD_W, height: CARD_H, transformStyle: 'preserve-3d', zIndex: i }}
        >
          <div className="kad-face kad-back" aria-hidden="true">
            <svg width="240" height="240" viewBox="-120 -120 240 240" className="kad-mark">
              <path d="M -110 -30 L -60 -100 L 60 -100 L 110 -30 L 0 110 Z M -110 -30 L 110 -30 M -60 -100 L -30 -30 L 0 110 L 30 -30 L 60 -100" fill="none" stroke="currentColor" strokeWidth="7" strokeLinejoin="round" />
            </svg>
            <span className="font-display text-[150px] leading-none font-extrabold">60</span>
          </div>
          <div className="kad-face kad-front">
            {i === WIN && winner && (phase === 'landing' || phase === 'revealed') && (
              <>
                <p className="font-stage text-[44px] font-semibold text-zircon">Tahniah</p>
                <FitName
                  text={winner}
                  width={CARD_W - 180}
                  maxSize={150}
                  minSize={70}
                  lineHeight={1.04}
                  className="font-serif font-semibold text-night"
                  style={{ fontVariationSettings: '"opsz" 144' }}
                />
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
