import { push, serverTimestamp } from 'firebase/database'
import { eventPath, eventRef } from '@/lib/firebase'
import type { LogEntry } from '@/lib/types'

type LogInput = Omit<LogEntry, 'at'>

/** Paths to add a log entry inside a multi-path update. */
export function logPaths(entry: LogInput): Record<string, unknown> {
  const id = push(eventRef('log')).key!
  return { [eventPath(`log/${id}`)]: { ...entry, at: serverTimestamp() } }
}
