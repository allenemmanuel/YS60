export type GuestSource = 'list' | 'paste' | 'qr'

export interface Guest {
  name: string
  group?: string
  source: GuestSource
  checkedIn: boolean
  checkedInAt?: number
  createdAt: number
}

export interface Prize {
  order: number
  name: string
  counter?: string
}

export type WinnerStatus = 'active' | 'void'

export interface Winner {
  guestId: string
  name: string
  drawnAt: number
  by: string
  status: WinnerStatus
  voidedAt?: number
  collected?: boolean
}

export interface PublicWinner {
  name: string
  prizeName: string
  counter?: string
  order: number
  drawnAt: number
}

export type EntryMode = 'all' | 'checkedIn'

export interface Settings {
  entryMode?: EntryMode
}

export type LogType = 'draw' | 'void' | 'import' | 'guest-delete' | 'prize-delete' | 'release' | 'reset'

export interface LogEntry {
  type: LogType
  at: number
  by: string
  prizeId?: string
  guestId?: string
  detail?: string
}

export type Keyed<T> = T & { id: string }
