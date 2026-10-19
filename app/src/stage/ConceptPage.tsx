import { useCallback, useRef, type ComponentType, type ReactNode } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router'
import { secureRandomInt } from '@/lib/random'
import { Buruj } from '@/stage/concepts/Buruj'
import { Gulungan } from '@/stage/concepts/Gulungan'
import { Intan } from '@/stage/concepts/Intan'
import { PapanKilat } from '@/stage/concepts/PapanKilat'
import { Sorotan } from '@/stage/concepts/Sorotan'
import { DEMO_NAMES, DEMO_PRIZES } from '@/stage/demoData'
import { StageFrame } from '@/stage/StageFrame'
import type { ConceptProps } from '@/stage/useFrame'
import { useDrawStage } from '@/stage/useDrawStage'
import '@/stage/stage.css'

interface Concept {
  name: string
  summary: string
  Component: ComponentType<ConceptProps>
  minSpinMs: number
  background: ReactNode
}

const CONCEPTS: Concept[] = [
  {
    name: 'Gulungan',
    summary: 'A big drum of names spins, slows down and clunks onto the winner between two gold lines.',
    Component: Gulungan,
    minSpinMs: 4500,
    background: <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 1200px 420px at 50% 600px, rgba(29,91,168,0.32), transparent 70%)' }} />,
  },
  {
    name: 'Intan',
    summary: 'Names scramble letter by letter, then the winner settles left to right and a light sweeps across it like a cut diamond.',
    Component: Intan,
    minSpinMs: 4000,
    background: <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at 50% 600px, #0f2a4d, #08162b 55%, #040c19)' }} />,
  },
  {
    name: 'Buruj',
    summary: 'Every guest is a star. The sky swirls, collapses into one point and bursts into the winner’s name.',
    Component: Buruj,
    minSpinMs: 4500,
    background: null,
  },
  {
    name: 'Papan Kilat',
    summary: 'An airport split-flap board clatters through the alphabet and stops letter by letter.',
    Component: PapanKilat,
    minSpinMs: 3500,
    background: <div className="absolute inset-0" style={{ background: 'linear-gradient(#0a1830, #050e1d)' }} />,
  },
  {
    name: 'Sorotan',
    summary: 'A wall of names in the dark. A spotlight roams, settles on the winner, who steps forward as Kinabalu lights up.',
    Component: Sorotan,
    minSpinMs: 4000,
    background: <div className="absolute inset-0 bg-night-deep" />,
  },
]

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

function ConceptStage({ index }: { index: number }) {
  const navigate = useNavigate()
  const concept = CONCEPTS[index]
  const won = useRef(new Set<string>())

  // Demo stand-in for drawPrize(): resolves with a name not drawn before in this session.
  const pick = useCallback(async () => {
    await wait(350)
    // Preview aid: ?w=<index> forces a specific demo name (e.g. the longest one) for the first draw.
    const forced = Number(new URLSearchParams(window.location.search).get('w'))
    if (Number.isInteger(forced) && DEMO_NAMES[forced] && !won.current.has(DEMO_NAMES[forced])) {
      won.current.add(DEMO_NAMES[forced])
      return DEMO_NAMES[forced]
    }
    let pool = DEMO_NAMES.filter((n) => !won.current.has(n))
    if (!pool.length) {
      won.current.clear()
      pool = DEMO_NAMES
    }
    const name = pool[secureRandomInt(pool.length)]
    won.current.add(name)
    return name
  }, [])

  const stage = useDrawStage({ pick, prizeCount: DEMO_PRIZES.length, minSpinMs: concept.minSpinMs })
  const prize = DEMO_PRIZES[stage.prizeIndex]
  const go = useCallback((n: number) => navigate(`/concepts/${n}`), [navigate])
  const conceptNav = { current: index + 1, count: CONCEPTS.length, go }

  return (
    <StageFrame
      stage={stage}
      prizeName={prize.name}
      prizeCounter={prize.counter}
      prizeTotal={DEMO_PRIZES.length}
      concept={conceptNav}
      background={concept.background}
    >
      <concept.Component stage={stage} names={DEMO_NAMES} />
    </StageFrame>
  )
}

export function StageConcept() {
  const { id } = useParams()
  const n = Number(id)
  if (!Number.isInteger(n) || n < 1 || n > CONCEPTS.length) return <Navigate to="/concepts" replace />
  // Remount per concept so each starts fresh.
  return <ConceptStage key={n} index={n - 1} />
}

export function ConceptIndex() {
  return (
    <main className="min-h-svh bg-night px-4 py-16 font-stage text-diamond">
      <div className="mx-auto max-w-3xl">
        <h1 className="font-serif text-5xl font-semibold text-balance">YS60 draw screen: five concepts</h1>
        <p className="mt-4 max-w-prose text-lg text-ice/80">
          Each one runs on made-up names. Open it on the projector or a laptop and use the same keys you would on the night.
        </p>

        <ol className="mt-12 grid gap-4">
          {CONCEPTS.map((c, i) => (
            <li key={c.name}>
              <Link
                to={`/concepts/${i + 1}`}
                className="group grid grid-cols-[3rem_1fr] gap-x-4 rounded-xl border border-ice/15 p-6 transition-colors duration-200 hover:border-gold/60 hover:bg-white/[0.03] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
              >
                <span className="font-display text-4xl font-bold text-gold tabular-nums">{i + 1}</span>
                <span>
                  <span className="block font-display text-3xl font-bold">{c.name}</span>
                  <span className="mt-1 block text-ice/80">{c.summary}</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>

        <h2 className="mt-14 font-serif text-2xl font-semibold">Controls</h2>
        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-ice/85">
          <dt className="font-semibold text-diamond">Space, →, Enter, PageDown</dt>
          <dd>Draw. Press again while it spins to land straight away. After the reveal, it moves to the next prize. A presentation clicker sends these keys.</dd>
          <dt className="font-semibold text-diamond">F</dt>
          <dd>Fullscreen</dd>
          <dt className="font-semibold text-diamond">M</dt>
          <dd>Sound on or off</dd>
          <dt className="font-semibold text-diamond">1 to 5</dt>
          <dd>Switch concept</dd>
        </dl>
      </div>
    </main>
  )
}
