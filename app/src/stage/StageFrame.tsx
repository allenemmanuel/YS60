import { Volume2, VolumeX } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { stageSound } from '@/stage/sound'
import type { DrawStage } from '@/stage/useDrawStage'

export const STAGE_W = 1920
export const STAGE_H = 1080

const ADVANCE_KEYS = new Set([' ', 'Enter', 'ArrowRight', 'PageDown', 'ArrowDown'])

interface StageFrameProps {
  stage: DrawStage
  prizeName: string
  prizeCounter: string
  prizeTotal: number
  /** Concept switcher for the preview build (keys 1–5). */
  concept?: { current: number; count: number; go: (n: number) => void }
  background?: ReactNode
  className?: string
  children: ReactNode
}

function useStageScale() {
  const [scale, setScale] = useState(1)
  useEffect(() => {
    const update = () => setScale(Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H))
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])
  return scale
}

export function StageFrame({ stage, prizeName, prizeCounter, prizeTotal, concept, background, className, children }: StageFrameProps) {
  const scale = useStageScale()
  const rootRef = useRef<HTMLDivElement>(null)
  const [muted, setMuted] = useState(stageSound.muted)
  const lastPress = useRef(0)

  // Hide the pointer on the projector after a moment of no movement.
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    let t: ReturnType<typeof setTimeout>
    const wake = () => {
      el.style.cursor = ''
      clearTimeout(t)
      t = setTimeout(() => (el.style.cursor = 'none'), 2000)
    }
    wake()
    el.addEventListener('pointermove', wake)
    return () => {
      clearTimeout(t)
      el.removeEventListener('pointermove', wake)
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (ADVANCE_KEYS.has(e.key)) {
        e.preventDefault()
        // Clickers auto-repeat when held; one press = one step.
        if (e.repeat || performance.now() - lastPress.current < 300) return
        lastPress.current = performance.now()
        stage.advance()
      } else if (e.key === 'm' || e.key === 'M') {
        const next = !stageSound.muted
        stageSound.setMuted(next)
        setMuted(next)
      } else if (e.key === 'f' || e.key === 'F') {
        if (document.fullscreenElement) void document.exitFullscreen()
        else void document.documentElement.requestFullscreen().catch(() => {})
      } else if (concept && /^[1-9]$/.test(e.key) && Number(e.key) <= concept.count) {
        concept.go(Number(e.key))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [stage, concept])

  const hint =
    stage.phase === 'idle'
      ? 'Tekan untuk mencabut'
      : stage.phase === 'revealed'
        ? stage.prizeIndex < prizeTotal - 1
          ? 'Tekan untuk hadiah seterusnya'
          : 'Cabutan terakhir'
        : 'Mencabut…'

  return (
    <div ref={rootRef} className="fixed inset-0 grid place-items-center overflow-hidden bg-night-deep">
      <div
        className={cn('relative shrink-0 overflow-hidden bg-night font-stage text-diamond', className)}
        style={{ width: STAGE_W, height: STAGE_H, transform: `scale(${scale})` }}
      >
        {background}
        {children}

        <header className="absolute inset-x-[72px] top-[48px] flex items-start justify-between text-[22px] leading-snug text-ice/70">
          <p>
            Malam Sambutan Ulang Tahun ke-60
            <br />
            <span className="text-diamond/90">Yayasan Sabah</span>
          </p>
          <p className="tabular-nums">
            Hadiah {stage.prizeIndex + 1} daripada {prizeTotal}
          </p>
        </header>

        <div className="absolute inset-x-[72px] top-[150px] text-center">
          <AnimatePresence mode="wait" initial={false}>
            <motion.h2
              key={prizeName}
              className="font-serif text-[64px] leading-tight font-semibold text-balance text-diamond"
              style={{ fontVariationSettings: '"opsz" 96' }}
              initial={{ opacity: 0, transform: 'translateY(12px)' }}
              animate={{ opacity: 1, transform: 'translateY(0px)' }}
              exit={{ opacity: 0, transform: 'translateY(-8px)' }}
              transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
            >
              {prizeName}
            </motion.h2>
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {stage.phase === 'revealed' && (
            <motion.p
              className="absolute inset-x-0 bottom-[132px] text-center text-[34px] text-ice"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { delay: 0.9, duration: 0.4 } }}
              exit={{ opacity: 0, transition: { duration: 0.15 } }}
            >
              Sila tuntut hadiah di {prizeCounter}
            </motion.p>
          )}
        </AnimatePresence>

        {stage.error && (
          <p role="alert" className="absolute inset-x-[72px] bottom-[120px] rounded-lg bg-sabah-red px-6 py-4 text-center text-[28px] text-white">
            {stage.error}
          </p>
        )}

        <footer className="absolute inset-x-[72px] bottom-[44px] flex items-center justify-between text-[20px] text-ice/45">
          <p aria-live="polite">{hint}</p>
          <div className="flex items-center gap-6">
            {concept && (
              <p className="tabular-nums">
                Konsep {concept.current} / {concept.count}
              </p>
            )}
            {muted ? <VolumeX aria-label="Bunyi dimatikan (M)" className="size-6" /> : <Volume2 aria-label="Bunyi hidup (M)" className="size-6" />}
          </div>
        </footer>
      </div>
    </div>
  )
}
