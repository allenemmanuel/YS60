import { get, onValue, ref, serverTimestamp, update } from 'firebase/database'
import { db, eventPath, eventRef } from '@/lib/firebase'
import { logPaths } from '@/lib/log'
import { secureRandomInt } from '@/lib/random'
import { actor } from '@/lib/session'
import type { Guest, Prize, Settings, Winner } from '@/lib/types'

export type DrawErrorCode = 'no-prize' | 'already-drawn' | 'no-eligible' | 'conflict' | 'offline' | 'save-timeout'

export class DrawError extends Error {
  readonly code: DrawErrorCode
  constructor(code: DrawErrorCode, message: string) {
    super(message)
    this.name = 'DrawError'
    this.code = code
  }
}

export interface DrawResult {
  prizeId: string
  guestId: string
  name: string
}

const MAX_ATTEMPTS = 5
const SAVE_TIMEOUT_MS = 15_000

function isConnected(): Promise<boolean> {
  return new Promise((resolve) => {
    onValue(ref(db, '.info/connected'), (snap) => resolve(snap.val() === true), { onlyOnce: true })
  })
}

function isPermissionDenied(err: unknown): boolean {
  return err instanceof Error && /permission.denied/i.test(err.message)
}

/**
 * Write with a timeout. RTDB queues writes while offline and never rejects, so a stuck save
 * must surface as an error instead of a winner on screen.
 */
async function saveOrTimeout(paths: Record<string, unknown>): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () =>
        reject(
          new DrawError(
            'save-timeout',
            'The draw could not be confirmed by the server. Do not redraw: check the winners list once the connection is back.',
          ),
        ),
      SAVE_TIMEOUT_MS,
    )
  })
  try {
    await Promise.race([update(ref(db), paths), timeout])
  } finally {
    clearTimeout(timer)
  }
}

/** Guests who may win: not already a winner (active or voided), and checked in if entry mode requires it. */
export function eligibleGuestIds(
  guests: Record<string, Guest>,
  winnerByGuest: Record<string, string>,
  settings: Settings,
): string[] {
  const needCheckIn = settings.entryMode === 'checkedIn'
  return Object.entries(guests)
    .filter(([id, g]) => !winnerByGuest[id] && (!needCheckIn || g.checkedIn))
    .map(([id]) => id)
}

/**
 * Draw one winner for a prize.
 * The claim is a single multi-path update; the database rules reject it if the prize or the guest
 * was taken in the meantime, in which case we re-read and pick again.
 * Resolves only after the server has accepted the claim.
 */
export async function drawPrize(prizeId: string): Promise<DrawResult> {
  if (!(await isConnected())) throw new DrawError('offline', 'No connection to the database. Check the internet and try again.')

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const [prizeSnap, winnerSnap, guestsSnap, wbgSnap, settingsSnap] = await Promise.all([
      get(eventRef(`prizes/${prizeId}`)),
      get(eventRef(`winners/${prizeId}`)),
      get(eventRef('guests')),
      get(eventRef('winnerByGuest')),
      get(eventRef('settings')),
    ])

    if (!prizeSnap.exists()) throw new DrawError('no-prize', 'This prize does not exist.')
    const prize = prizeSnap.val() as Prize
    const current = winnerSnap.val() as Winner | null
    if (current?.status === 'active') throw new DrawError('already-drawn', `"${prize.name}" already has a winner.`)

    const guests = (guestsSnap.val() ?? {}) as Record<string, Guest>
    const eligible = eligibleGuestIds(guests, (wbgSnap.val() ?? {}) as Record<string, string>, (settingsSnap.val() ?? {}) as Settings)
    if (eligible.length === 0) throw new DrawError('no-eligible', 'There are no eligible guests left to draw.')

    const guestId = eligible[secureRandomInt(eligible.length)]
    const name = guests[guestId].name
    const by = actor()

    try {
      await saveOrTimeout({
        [eventPath(`winners/${prizeId}`)]: { guestId, name, drawnAt: serverTimestamp(), by, status: 'active' },
        [eventPath(`winnerByGuest/${guestId}`)]: prizeId,
        [eventPath(`public/winners/${prizeId}`)]: {
          name,
          prizeName: prize.name,
          ...(prize.counter ? { counter: prize.counter } : {}),
          order: prize.order,
          drawnAt: serverTimestamp(),
        },
        ...logPaths({ type: 'draw', by, prizeId, guestId, detail: name }),
      })
      return { prizeId, guestId, name }
    } catch (err) {
      if (!isPermissionDenied(err)) throw err
      // Someone else claimed this prize or guest first: re-read and try again.
    }
  }

  throw new DrawError('conflict', 'The draw kept colliding with another draw. Please try again.')
}

/**
 * Void a winner (no-show). The prize can then be redrawn on its own; nothing else shifts.
 * The voided guest stays ineligible unless released with `releaseGuest`.
 */
export async function voidWinner(prizeId: string, reason?: string): Promise<void> {
  const snap = await get(eventRef(`winners/${prizeId}`))
  const winner = snap.val() as Winner | null
  if (!winner || winner.status !== 'active') throw new Error('This prize has no active winner to void.')
  await update(ref(db), {
    [eventPath(`winners/${prizeId}/status`)]: 'void',
    [eventPath(`winners/${prizeId}/voidedAt`)]: serverTimestamp(),
    [eventPath(`public/winners/${prizeId}`)]: null,
    ...logPaths({ type: 'void', by: actor(), prizeId, guestId: winner.guestId, detail: reason?.slice(0, 1000) }),
  })
}

/** Make a voided winner eligible again (e.g. voided by mistake). */
export async function releaseGuest(guestId: string): Promise<void> {
  const wbg = await get(eventRef(`winnerByGuest/${guestId}`))
  if (!wbg.exists()) return
  const prizeId = wbg.val() as string
  const winner = (await get(eventRef(`winners/${prizeId}`))).val() as Winner | null
  if (winner?.status === 'active' && winner.guestId === guestId) {
    throw new Error('This guest is an active winner. Void the prize first.')
  }
  await update(ref(db), {
    [eventPath(`winnerByGuest/${guestId}`)]: null,
    ...logPaths({ type: 'release', by: actor(), prizeId, guestId }),
  })
}
