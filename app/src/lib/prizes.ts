import { get, push, ref, update } from 'firebase/database'
import { db, eventPath, eventRef } from '@/lib/firebase'
import { logPaths } from '@/lib/log'
import { actor } from '@/lib/session'
import { cleanText, parseRows } from '@/lib/text'
import type { Prize } from '@/lib/types'

export const MAX_PRIZE_NAME = 200
export const MAX_COUNTER = 60

type PrizeInput = Omit<Prize, 'order'>

/** Parse pasted rows: column 1 = prize name, column 2 = collection counter (optional). */
export function parsePrizeText(text: string): PrizeInput[] {
  const rows = parseRows(text)
  if (rows.length && /^(hadiah|prize|name|nama)$/i.test(rows[0][0] ?? '')) rows.shift()
  return rows.map(([name = '', counter = '']) => ({ name, counter: counter || undefined }))
}

function validatePrize(p: PrizeInput): PrizeInput {
  const name = cleanText(p.name)
  const counter = p.counter ? cleanText(p.counter) : undefined
  if (!name) throw new Error('Prize name is required.')
  if (name.length > MAX_PRIZE_NAME) throw new Error(`Prize name is longer than ${MAX_PRIZE_NAME} characters.`)
  if (counter && counter.length > MAX_COUNTER) throw new Error(`Counter is longer than ${MAX_COUNTER} characters.`)
  return { name, ...(counter ? { counter } : {}) }
}

/** Append prizes after the current last `order`. */
export async function addPrizes(inputs: PrizeInput[]): Promise<number> {
  const prizes = inputs.map(validatePrize)
  const snap = await get(eventRef('prizes'))
  let order = 0
  snap.forEach((child) => {
    order = Math.max(order, (child.val() as Prize).order)
  })
  const paths: Record<string, unknown> = {}
  for (const prize of prizes) {
    const id = push(eventRef('prizes')).key!
    paths[eventPath(`prizes/${id}`)] = { ...prize, order: ++order }
  }
  await update(ref(db), paths)
  return prizes.length
}

export async function updatePrize(prizeId: string, prize: Prize): Promise<void> {
  const clean = validatePrize(prize)
  await update(ref(db), {
    [eventPath(`prizes/${prizeId}`)]: { ...clean, order: prize.order },
  })
}

/** Delete a prize. Refused if it has a winner record (active or void). */
export async function deletePrize(prizeId: string): Promise<void> {
  const winner = await get(eventRef(`winners/${prizeId}`))
  if (winner.exists()) throw new Error('This prize has been drawn and cannot be deleted.')
  await update(ref(db), {
    [eventPath(`prizes/${prizeId}`)]: null,
    ...logPaths({ type: 'prize-delete', by: actor(), prizeId }),
  })
}
