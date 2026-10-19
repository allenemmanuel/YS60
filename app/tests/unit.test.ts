import { describe, expect, it } from 'vitest'
import { eligibleGuestIds } from '@/lib/draw'
import { toCsv } from '@/lib/export'
import { parseGuestText } from '@/lib/guests'
import { parsePrizeText } from '@/lib/prizes'
import { secureRandomInt, shuffle } from '@/lib/random'
import { cleanText } from '@/lib/text'
import type { Guest } from '@/lib/types'

describe('random', () => {
  it('secureRandomInt stays in range and covers every value', () => {
    const seen = new Set<number>()
    for (let i = 0; i < 2000; i++) {
      const n = secureRandomInt(7)
      expect(n).toBeGreaterThanOrEqual(0)
      expect(n).toBeLessThan(7)
      seen.add(n)
    }
    expect(seen.size).toBe(7)
  })

  it('secureRandomInt rejects bad input', () => {
    expect(() => secureRandomInt(0)).toThrow()
    expect(() => secureRandomInt(-1)).toThrow()
    expect(() => secureRandomInt(1.5)).toThrow()
  })

  it('shuffle is a permutation and does not mutate', () => {
    const input = Array.from({ length: 50 }, (_, i) => i)
    const out = shuffle(input)
    expect(out).toHaveLength(50)
    expect([...out].sort((a, b) => a - b)).toEqual(input)
    expect(input[0]).toBe(0)
  })

  it('shuffle is roughly uniform', () => {
    const counts = [0, 0, 0]
    for (let i = 0; i < 6000; i++) counts[shuffle([0, 1, 2]).indexOf(0)]++
    for (const c of counts) expect(c).toBeGreaterThan(1700)
  })
})

describe('parsing', () => {
  it('cleans whitespace', () => {
    expect(cleanText('  Siti  Nur   Aisyah ')).toBe('Siti Nur Aisyah')
  })

  it('parses Excel paste with header and groups', () => {
    const text = 'Nama\tJabatan\nAhmad bin Ali\tICT\n\nSiti Aminah binti Haji Abdullah\t\n'
    expect(parseGuestText(text)).toEqual([
      { name: 'Ahmad bin Ali', group: 'ICT' },
      { name: 'Siti Aminah binti Haji Abdullah', group: undefined },
    ])
  })

  it('parses CSV with quoted commas', () => {
    expect(parseGuestText('"Tan, Mei Ling",Finance')).toEqual([{ name: 'Tan, Mei Ling', group: 'Finance' }])
  })

  it('parses prizes with counters', () => {
    expect(parsePrizeText('Hadiah\tKaunter\nTV 55"\tA\nBasikal')).toEqual([
      { name: 'TV 55"', counter: 'A' },
      { name: 'Basikal', counter: undefined },
    ])
  })
})

describe('eligibility', () => {
  const g = (checkedIn: boolean): Guest => ({ name: 'x', source: 'list', checkedIn, createdAt: 0 })
  const guests = { a: g(true), b: g(false), c: g(true) }

  it('excludes previous winners', () => {
    expect(eligibleGuestIds(guests, { a: 'p1' }, {}).sort()).toEqual(['b', 'c'])
  })

  it('requires check-in when entry mode says so', () => {
    expect(eligibleGuestIds(guests, {}, { entryMode: 'checkedIn' }).sort()).toEqual(['a', 'c'])
  })
})

describe('csv export', () => {
  it('quotes cells and defuses formulas', () => {
    expect(toCsv(['a', 'b'], [['=HYPERLINK("x")', 'He said "hi"']])).toBe(`"a","b"\r\n"'=HYPERLINK(""x"")","He said ""hi"""`)
  })
})
