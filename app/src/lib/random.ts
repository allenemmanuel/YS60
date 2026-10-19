/** Uniform random integer in [0, max) from the browser's CSPRNG, without modulo bias. */
export function secureRandomInt(max: number): number {
  if (!Number.isInteger(max) || max <= 0) throw new RangeError(`max must be a positive integer, got ${max}`)
  const limit = Math.floor(0x1_0000_0000 / max) * max
  const buf = new Uint32Array(1)
  do {
    crypto.getRandomValues(buf)
  } while (buf[0] >= limit)
  return buf[0] % max
}

/** Fisher–Yates shuffle (returns a new array). */
export function shuffle<T>(items: readonly T[]): T[] {
  const out = items.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1)
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}
