/**
 * Integration tests against the real database, under events/ys60-test only.
 * Needs app/.env.local with TEST_STAFF_EMAIL / TEST_STAFF_PASSWORD (a staff-listed account),
 * and the rules from database.rules.json deployed.
 */
import { existsSync } from 'node:fs'
import { deleteApp } from 'firebase/app'
import { signOut } from 'firebase/auth'
import { get, goOffline, ref, serverTimestamp, update } from 'firebase/database'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { DrawError, drawPrize, releaseGuest, voidWinner } from '@/lib/draw'
import { app, auth, db, EVENT_ID, eventPath, eventRef } from '@/lib/firebase'
import { addGuests, checkIn } from '@/lib/guests'
import { addPrizes } from '@/lib/prizes'
import { signIn } from '@/lib/session'
import type { Winner } from '@/lib/types'

const ENV_FILE = new URL('../.env.local', import.meta.url)
if (existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE)
const email = process.env.TEST_STAFF_EMAIL
const password = process.env.TEST_STAFF_PASSWORD
const DB_URL = 'https://ys60-d283a-default-rtdb.firebaseio.com'

async function deny(p: Promise<unknown>) {
  await expect(p).rejects.toThrow(/permission.denied/i)
}

/** Remove everything under the test event except the append-only log. */
async function resetTestEvent() {
  const paths: Record<string, unknown> = {}
  for (const node of ['winners', 'winnerByGuest', 'public/winners', 'guests', 'prizes']) {
    const snap = await get(eventRef(node))
    snap.forEach((child) => {
      paths[eventPath(`${node}/${child.key}`)] = null
    })
  }
  paths[eventPath('settings')] = null
  await update(ref(db), paths)
}

async function guestIdsByName(): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  ;(await get(eventRef('guests'))).forEach((c) => {
    out[c.val().name] = c.key!
  })
  return out
}

async function prizeIdsInOrder(): Promise<string[]> {
  const list: [number, string][] = []
  ;(await get(eventRef('prizes'))).forEach((c) => {
    list.push([c.val().order, c.key!])
  })
  return list.sort((a, b) => a[0] - b[0]).map(([, id]) => id)
}

describe('anonymous access (REST, no auth)', () => {
  const url = (p: string) => `${DB_URL}/${p}.json`

  it('can read the public node', async () => {
    expect((await fetch(url(`events/${EVENT_ID}/public`))).status).toBe(200)
  })

  it('cannot read private nodes or the staff list', async () => {
    for (const p of [`events/${EVENT_ID}`, `events/${EVENT_ID}/guests`, `events/${EVENT_ID}/winners`, 'staff', '']) {
      expect((await fetch(url(p))).status, p).toBe(401)
    }
  })

  it('cannot write or delete anything under events/', async () => {
    expect((await fetch(url(`events/${EVENT_ID}`), { method: 'DELETE' })).status).toBe(401)
    expect((await fetch(url(`events/${EVENT_ID}/public/winners/x`), { method: 'PUT', body: '{"name":"hacker"}' })).status).toBe(401)
    expect((await fetch(url(`events/${EVENT_ID}/guests/x`), { method: 'PUT', body: '{"name":"x"}' })).status).toBe(401)
    expect((await fetch(url('staff/attacker'), { method: 'PUT', body: 'true' })).status).toBe(401)
  })
})

describe.skipIf(!email || !password)(`staff flows on events/${EVENT_ID}`, () => {
  let g: Record<string, string>
  let prizes: string[]

  beforeAll(async () => {
    expect(EVENT_ID).toBe('ys60-test')
    await signIn(email!, password!)
    await resetTestEvent()
    const added = await addGuests(
      [
        { name: 'Ahmad bin Ali' },
        { name: 'Siti Aminah binti Haji Abdullah', group: 'ICT' },
        { name: 'Tan Mei Ling' },
        { name: 'Rajesh a/l Kumar' },
        { name: 'Mary Joseph' },
        { name: '' },
        { name: 'x'.repeat(121) },
      ],
      'list',
    )
    expect(added.added).toBe(5)
    expect(added.skipped).toHaveLength(2)
    await addPrizes([{ name: 'TV 55"', counter: 'A' }, { name: 'Basikal', counter: 'B' }, { name: 'Peti Sejuk' }])
    g = await guestIdsByName()
    prizes = await prizeIdsInOrder()
  })

  afterAll(async () => {
    if (auth.currentUser) {
      await resetTestEvent()
      await signOut(auth)
    }
    goOffline(db)
    await deleteApp(app)
  })

  it('rejects invalid records', async () => {
    const id = 'invalidtest'
    await deny(update(ref(db), { [eventPath(`guests/${id}`)]: { name: 'x'.repeat(121), source: 'list', checkedIn: false, createdAt: 1 } }))
    await deny(update(ref(db), { [eventPath(`guests/${id}`)]: { name: 'Ok', source: 'evil', checkedIn: false, createdAt: 1 } }))
    await deny(update(ref(db), { [eventPath(`guests/${id}`)]: { name: 'Ok', source: 'list', checkedIn: false, createdAt: 1, admin: true } }))
    await deny(update(ref(db), { [eventPath(`guests/${id}`)]: { name: 'Ok' } }))
    await deny(update(ref(db), { [eventPath('settings/entryMode')]: 'everyone' }))
  })

  it('check-in is idempotent and rejects unknown/bad IDs', async () => {
    const id = g['Tan Mei Ling']
    const [a, b] = await Promise.all([checkIn(id), checkIn(id)])
    expect([a.status, b.status].every((s) => s === 'ok' || s === 'already')).toBe(true)
    expect((await checkIn(id)).status).toBe('already')
    expect((await checkIn('does-not-exist')).status).toBe('unknown')
    expect((await checkIn('bad/../path')).status).toBe('unknown')
    expect((await get(eventRef(`guests/${id}/checkedIn`))).val()).toBe(true)
  })

  it('entry mode "checkedIn" only draws checked-in guests', async () => {
    await update(eventRef('settings'), { entryMode: 'checkedIn' })
    const r = await drawPrize(prizes[0])
    expect(r.name).toBe('Tan Mei Ling')
    await expect(drawPrize(prizes[1])).rejects.toMatchObject({ code: 'no-eligible' })
    await update(eventRef('settings'), { entryMode: 'all' })
  })

  it('a drawn prize cannot be drawn again', async () => {
    await expect(drawPrize(prizes[0])).rejects.toBeInstanceOf(DrawError)
    await expect(drawPrize(prizes[0])).rejects.toMatchObject({ code: 'already-drawn' })
  })

  it('the rules block a second claim on the same prize', async () => {
    const other = g['Mary Joseph']
    await deny(
      update(ref(db), {
        [eventPath(`winners/${prizes[0]}`)]: { guestId: other, name: 'Mary Joseph', drawnAt: serverTimestamp(), by: 'test', status: 'active' },
        [eventPath(`winnerByGuest/${other}`)]: prizes[0],
      }),
    )
  })

  it('the rules block the same guest winning twice', async () => {
    const winner = g['Tan Mei Ling']
    await deny(
      update(ref(db), {
        [eventPath(`winners/${prizes[1]}`)]: { guestId: winner, name: 'Tan Mei Ling', drawnAt: serverTimestamp(), by: 'test', status: 'active' },
        [eventPath(`winnerByGuest/${winner}`)]: prizes[1],
      }),
    )
  })

  it('the rules block an active winner without the winnerByGuest entry', async () => {
    const guest = g['Mary Joseph']
    await deny(
      update(ref(db), {
        [eventPath(`winners/${prizes[1]}`)]: { guestId: guest, name: 'Mary Joseph', drawnAt: serverTimestamp(), by: 'test', status: 'active' },
      }),
    )
  })

  it('two simultaneous draws of one prize give exactly one winner', async () => {
    const results = await Promise.allSettled([drawPrize(prizes[1]), drawPrize(prizes[1])])
    const ok = results.filter((r) => r.status === 'fulfilled')
    expect(ok).toHaveLength(1)
    const w = (await get(eventRef(`winners/${prizes[1]}`))).val() as Winner
    expect(w.status).toBe('active')
    expect((await get(eventRef(`winnerByGuest/${w.guestId}`))).val()).toBe(prizes[1])
  })

  it('void + redraw replaces only that prize, and the voided guest stays out', async () => {
    await drawPrize(prizes[2])
    const before = (await get(eventRef('winners'))).val() as Record<string, Winner>
    const voided = before[prizes[1]].guestId

    await voidWinner(prizes[1], 'no-show')
    expect((await get(eventRef(`public/winners/${prizes[1]}`))).exists()).toBe(false)

    const redraw = await drawPrize(prizes[1])
    expect(redraw.guestId).not.toBe(voided)

    const after = (await get(eventRef('winners'))).val() as Record<string, Winner>
    expect(after[prizes[0]]).toEqual(before[prizes[0]])
    expect(after[prizes[2]]).toEqual(before[prizes[2]])
    const winners = Object.values(after).map((w) => w.guestId)
    expect(new Set(winners).size).toBe(winners.length)
  })

  it('a voided guest can be released back into the draw', async () => {
    const wbg = ((await get(eventRef('winnerByGuest'))).val() ?? {}) as Record<string, string>
    const winners = ((await get(eventRef('winners'))).val() ?? {}) as Record<string, Winner>
    const activeGuests = new Set(Object.values(winners).filter((w) => w.status === 'active').map((w) => w.guestId))
    const voided = Object.keys(wbg).find((id) => !activeGuests.has(id))!
    await expect(releaseGuest(Object.values(winners)[0].guestId)).rejects.toThrow()
    await releaseGuest(voided)
    expect((await get(eventRef(`winnerByGuest/${voided}`))).exists()).toBe(false)
  })

  it('public winners match the private record and are readable anonymously', async () => {
    const res = await fetch(`${DB_URL}/events/${EVENT_ID}/public/winners.json`)
    const pub = (await res.json()) as Record<string, { name: string; prizeName: string }>
    const winners = (await get(eventRef('winners'))).val() as Record<string, Winner>
    const active = Object.entries(winners).filter(([, w]) => w.status === 'active')
    expect(Object.keys(pub).sort()).toEqual(active.map(([id]) => id).sort())
    for (const [id, w] of active) expect(pub[id].name).toBe(w.name)
  })
})
