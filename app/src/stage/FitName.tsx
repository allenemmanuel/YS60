import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { cn } from '@/lib/utils'
import { fitFontSize } from '@/stage/fit'

interface FitNameProps {
  text: string
  /** Box width in stage pixels (the stage is a fixed 1920×1080 canvas). */
  width: number
  maxLines?: number
  maxSize: number
  minSize?: number
  lineHeight?: number
  className?: string
  style?: CSSProperties
}

export function FitName({ text, width, maxLines = 2, maxSize, minSize = 48, lineHeight = 1.02, className, style }: FitNameProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const [size, setSize] = useState(maxSize)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const run = () => setSize(fitFontSize(el, { maxLines, maxSize, minSize, lineHeight }))
    run()
    let alive = true
    void document.fonts.ready.then(() => alive && run())
    return () => {
      alive = false
    }
  }, [text, width, maxLines, maxSize, minSize, lineHeight])

  return (
    <span
      ref={ref}
      className={cn('block text-balance', className)}
      style={{ width, fontSize: size, lineHeight, overflowWrap: 'normal', ...style }}
    >
      {text}
    </span>
  )
}
