export interface FitOptions {
  maxLines?: number
  maxSize: number
  minSize?: number
  lineHeight?: number
}

/**
 * Largest font size at which `text` fits `width` within `maxLines` balanced lines.
 * Uses layout sizes (offsetHeight/scrollWidth), which ignore the stage's scale transform.
 */
export function fitFontSize(
  el: HTMLElement,
  { maxLines = 2, maxSize, minSize = 48, lineHeight = 1.02 }: FitOptions,
): number {
  let lo = minSize
  let hi = maxSize
  const fits = (size: number) => {
    el.style.fontSize = `${size}px`
    return el.scrollWidth <= el.clientWidth + 1 && el.offsetHeight <= size * lineHeight * maxLines + 2
  }
  if (fits(hi)) return hi
  while (hi - lo > 2) {
    const mid = Math.floor((lo + hi) / 2)
    if (fits(mid)) lo = mid
    else hi = mid
  }
  el.style.fontSize = `${lo}px`
  return lo
}
