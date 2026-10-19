import { get, push, ref, serverTimestamp, update } from 'firebase/database'
import { db, eventPath, eventRef } from '@/lib/firebase'
import { logPaths } from '@/lib/log'
import { actor } from '@/lib/session'
import { cleanText, parseRows } from '@/lib/text'
import type { GuestSource } from '@/lib/types'

export const MAX_NAME = 120
const CHUNK = 400

export interface GuestInput {
  name: string
  group?: string
}

/** Parse pasted rows: column 1 = name, column 2 = group (optional). Skips a "name" header row. */
export function parseGuestText(text: string): GuestInput[] {
  const rows = parseRows(text)
  if (rows.length && /^(nama|name)$/i.test(rows[0][0] ?? '')) rows.shift()
  return rows.map(([name = '', group = '']) => ({ name, group: group || undefined }))
}

export interface AddGuestsResult {
  added: number
  skipped: { name: string; reason: string }[]
}

/** Add guests as individual records (never rewrites the list), in chunks of one multi-path update each. */
export async function addGuests(inputs: GuestInput[], source: GuestSource): Promise<AddGuestsResult> {
  const skipped: AddGuestsResult['skipped'] = []
  const valid: GuestInput[] = []
  for (const input of inputs) {
    const name = cleanText(input.name)
    const group = input.group ? cleanText(input.group) : undefined
    if (!name) skipped.push({ name: input.name, reason: 'empty name' })
    else if (name.length > MAX_NAME) skipped.push({ name, reason: `longer than ${MAX_NAME} characters` })
    else if (group && group.length > MAX_NAME) skipped.push({ name, reason: `group longer than ${MAX_NAME} characters` })
    else valid.push({ name, group })
  }

  for (let i = 0; i < valid.length; i += CHUNK) {
    const chunk = valid.slice(i, i + CHUNK)
    const paths: Record<string, unknown> = {}
    for (const { name, group } of chunk) {
      const id = push(eventRef('guests')).key!
      paths[eventPath(`guests/${id}`)] = {
        name,
        ...(group ? { group } : {}),
        source,
        checkedIn: false,
        createdAt: serverTimestamp(),
      }
    }
    Object.assign(paths, logPaths({ type: 'import', by: actor(), detail: `${chunk.length} guests (${source})` }))
    await update(ref(db), paths)
  }

  return { added: valid.length, skipped }
}

export type CheckInResult =
  | { status: 'ok'; name: string }
  | { status: 'already'; name: string; checkedInAt?: number }
  | { status: 'unknown' }

const INVALID_KEY = /[.#$[\]/]/

/** Mark a guest as present. Safe to repeat and safe across several scanners. */
export async function checkIn(guestId: string): Promise<CheckInResult> {
  const id = cleanText(guestId)
  if (!id || INVALID_KEY.test(id)) return { status: 'unknown' }
  const snap = await get(eventRef(`guests/${id}`))
  if (!snap.exists()) return { status: 'unknown' }
  const guest = snap.val() as { name: string; checkedIn: boolean; checkedInAt?: number }
  if (guest.checkedIn) return { status: 'already', name: guest.name, checkedInAt: guest.checkedInAt }
  await update(eventRef(`guests/${id}`), { checkedIn: true, checkedInAt: serverTimestamp() })
  return { status: 'ok', name: guest.name }
}

/** Delete a guest. Refused if they have won (void the prize first, then release them). */
export async function deleteGuest(guestId: string): Promise<void> {
  const won = await get(eventRef(`winnerByGuest/${guestId}`))
  if (won.exists()) throw new Error('This guest has won a prize and cannot be deleted.')
  await update(ref(db), {
    [eventPath(`guests/${guestId}`)]: null,
    ...logPaths({ type: 'guest-delete', by: actor(), guestId }),
  })
}
