import { animate, createTimeline, stagger, utils, type JSAnimation, type Timeline } from 'animejs'
import { useEffect, useRef } from 'react'
import { secureRandomInt } from '@/lib/random'
import { FitName } from '@/stage/FitName'
import type { ConceptProps } from '@/stage/useFrame'

/** Concept: invitation cards fan out and shuffle; one slides out, grows and flips to show the winner. */

const COUNT = 21
const HERO_W = 1500
const HERO_H = 560
const SMALL = 0.2
// The shuffling cards are genuinely small (cheap to paint); only the hero card is full size.
const CARD_W = HERO_W * SMALL
const CARD_H = HERO_H * SMALL
const CENTER_Y = 600
const TOP = COUNT - 1 // top card of the deck; the hero takes its place when it comes forward

const slotPose = (slot: number) => {
  const a = -60 + slot * (120 / (COUNT - 1))
  const rad = (a * Math.PI) / 180
  return { translateX: Math.sin(rad) * 760, translateY: 700 - Math.cos(rad) * 760 - 120, rotate: a }
}

const deckPose = (i: number) => ({ translateX: 0, translateY: 80 - i * 3, rotate: ((i * 37) % 7) - 3 })

export function Kad({ stage }: ConceptProps) {
  const cardRefs = useRef<(HTMLDivElement | null)[]>([])
  const heroRef = useRef<HTMLDivElement>(null)
  const slots = useRef<number[]>(Array.from({ length: COUNT }, (_, i) => i))
  const running = useRef<(JSAnimation | Timeline)[]>([])
  const { phase, winner, skip, reduced, landed } = stage

  const cards = () => cardRefs.current.filter((c): c is HTMLDivElement => !!c)
  const track = <T extends JSAnimation | Timeline>(a: T) => {
    running.current.push(a)
    return a
  }
  const stopAll = () => {
    running.current.forEach((a) => a.pause())
    running.current = []
  }
  const heroAtDeck = () => ({ ...deckPose(TOP), scale: SMALL, rotateY: 0 })

  // Initial deck.
  useEffect(() => {
    cards().forEach((c, i) => utils.set(c, { ...deckPose(i), scale: 1, opacity: 1 }))
    if (heroRef.current) utils.set(heroRef.current, { ...heroAtDeck(), opacity: 0 })
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
            scale: [{ to: 1.18, duration: 190 }, { to: 1, duration: 230 }],
            duration: 420,
            ease: 'inOut(3)',
          }),
        )
      }
    }, 240)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, reduced])

  // Landing: gather into the deck, then the top card comes forward, grows and flips.
  useEffect(() => {
    if (phase !== 'landing' || !winner) return
    const els = cards()
    const hero = heroRef.current
    if (!hero) return
    stopAll()
    const top = els[TOP]
    const others = els.filter((_, i) => i !== TOP)
    if (reduced) {
      els.forEach((c) => utils.set(c, { opacity: 0 }))
      utils.set(hero, { translateX: 0, translateY: 0, rotate: 0, scale: 1, rotateY: 180, opacity: 0 })
      track(animate(hero, { opacity: 1, duration: 400, ease: 'out(2)', onComplete: landed }))
      return
    }
    const tl = track(createTimeline({ onComplete: landed }))
    tl.add(els, {
      translateX: 0,
      translateY: (_?: unknown, i = 0) => deckPose(i).translateY,
      rotate: (_?: unknown, i = 0) => deckPose(i).rotate,
      scale: 1,
      delay: stagger(18, { from: 'last' }),
      duration: 520,
      ease: 'inOut(3)',
    })
      // Swap the small top card for the full-size hero card at the same spot and size.
      .set(hero, { ...heroAtDeck(), opacity: 1 }, '+=250')
      .set(top, { opacity: 0 }, '<<')
      .add(others, { translateY: 760, opacity: 0, delay: stagger(16), duration: 700, ease: 'in(2)' })
      .add(hero, { translateY: [{ to: -120, duration: 450, ease: 'out(3)' }, { to: 0, duration: 900, ease: 'out(4)' }], scale: { to: 1, duration: 1350, ease: 'inOut(3)' }, rotate: { to: 0, duration: 600 } }, '<<')
      .add(hero, { rotateY: 180, duration: 900, ease: 'out(4)' }, '-=650')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, winner])

  useEffect(() => {
    if (phase === 'landing' && skip) running.current.forEach((a) => a.complete())
  }, [phase, skip])

  // Next prize: the winning card shrinks back onto the deck and the cards return.
  useEffect(() => {
    if (phase !== 'idle') return
    const els = cards()
    const hero = heroRef.current
    if (!els.length || !hero) return
    stopAll()
    slots.current = Array.from({ length: COUNT }, (_, i) => i)
    const restore = () => {
      utils.set(hero, { ...heroAtDeck(), opacity: 0 })
      utils.set(els[TOP], { opacity: 1 })
    }
    if (reduced) {
      els.forEach((c, i) => utils.set(c, { ...deckPose(i), scale: 1, opacity: 1 }))
      restore()
      return
    }
    const others = els.filter((_, i) => i !== TOP)
    track(
      animate(others, {
        translateX: 0,
        translateY: (_?: unknown, i = 0) => deckPose(i).translateY,
        rotate: (_?: unknown, i = 0) => deckPose(i).rotate,
        scale: 1,
        opacity: 1,
        delay: stagger(15),
        duration: 600,
        ease: 'inOut(3)',
      }),
    )
    if (Number(utils.get(hero, 'opacity')) > 0) {
      utils.set(els[TOP], deckPose(TOP))
      track(animate(hero, { ...heroAtDeck(), duration: 600, ease: 'inOut(3)', onComplete: restore }))
    } else restore()
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
          className="kad-card"
          style={{ left: 960 - CARD_W / 2, top: CENTER_Y - CARD_H / 2, width: CARD_W, height: CARD_H, zIndex: i }}
          aria-hidden="true"
        >
          <DiamondMark size={48} stroke={9} />
          <span className="font-display text-[30px] leading-none font-extrabold">60</span>
        </div>
      ))}

      <div
        ref={heroRef}
        className="absolute"
        style={{ left: 960 - HERO_W / 2, top: CENTER_Y - HERO_H / 2, width: HERO_W, height: HERO_H, transformStyle: 'preserve-3d', zIndex: COUNT, opacity: 0 }}
      >
        <div className="kad-face kad-back" aria-hidden="true">
          <DiamondMark size={240} stroke={7} />
          <span className="font-display text-[150px] leading-none font-extrabold">60</span>
        </div>
        <div className="kad-face kad-front">
          {winner && (phase === 'landing' || phase === 'revealed') && (
            <>
              <p className="font-stage text-[44px] font-semibold text-zircon">Tahniah</p>
              <FitName
                text={winner}
                width={HERO_W - 180}
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
    </div>
  )
}

function DiamondMark({ size, stroke }: { size: number; stroke: number }) {
  return (
    <svg width={size} height={size} viewBox="-120 -120 240 240" aria-hidden="true">
      <path
        d="M -110 -30 L -60 -100 L 60 -100 L 110 -30 L 0 110 Z M -110 -30 L 110 -30 M -60 -100 L -30 -30 L 0 110 L 30 -30 L 60 -100"
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinejoin="round"
      />
    </svg>
  )
}
