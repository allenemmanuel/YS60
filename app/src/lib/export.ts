import { get } from 'firebase/database'
import { EVENT_ID, eventRef } from '@/lib/firebase'
import type { Guest, Prize, Winner } from '@/lib/types'

function csvCell(value: unknown): string {
  const s = value === undefined || value === null ? '' : String(value)
  // Quote everything; also defuse spreadsheet formula injection (=, +, -, @).
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s
  return `"${safe.replace(/"/g, '""')}"`
}

export function toCsv(header: string[], rows: unknown[][]): string {
  return [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n')
}

const iso = (ms?: number) => (ms ? new Date(ms).toISOString() : '')

export function downloadFile(filename: string, content: string, type: string): void {
  // BOM so Excel opens UTF-8 names correctly.
  const blob = new Blob([type.startsWith('text/csv') ? '﻿' + content : content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

const stamp = () => new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')

export async function exportGuestsCsv(): Promise<void> {
  const guests = ((await get(eventRef('guests'))).val() ?? {}) as Record<string, Guest>
  const rows = Object.entries(guests).map(([id, g]) => [id, g.name, g.group, g.source, g.checkedIn ? 'yes' : 'no', iso(g.checkedInAt)])
  downloadFile(`${EVENT_ID}-guests-${stamp()}.csv`, toCsv(['id', 'name', 'group', 'source', 'checkedIn', 'checkedInAt'], rows), 'text/csv;charset=utf-8')
}

export async function exportWinnersCsv(): Promise<void> {
  const [prizesSnap, winnersSnap] = await Promise.all([get(eventRef('prizes')), get(eventRef('winners'))])
  const prizes = (prizesSnap.val() ?? {}) as Record<string, Prize>
  const winners = (winnersSnap.val() ?? {}) as Record<string, Winner>
  const rows = Object.entries(prizes)
    .sort(([, a], [, b]) => a.order - b.order)
    .map(([id, p]) => {
      const w = winners[id]
      return [p.order, p.name, p.counter, w?.name, w?.guestId, w?.status, iso(w?.drawnAt), w?.by]
    })
  downloadFile(
    `${EVENT_ID}-winners-${stamp()}.csv`,
    toCsv(['order', 'prize', 'counter', 'winner', 'guestId', 'status', 'drawnAt', 'drawnBy'], rows),
    'text/csv;charset=utf-8',
  )
}

/** Full backup of the event node. */
export async function exportEventJson(): Promise<void> {
  const data = (await get(eventRef())).val()
  downloadFile(`${EVENT_ID}-backup-${stamp()}.json`, JSON.stringify(data, null, 2), 'application/json')
}
