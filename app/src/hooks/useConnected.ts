import { onValue, ref } from 'firebase/database'
import { useEffect, useState } from 'react'
import { db } from '@/lib/firebase'

/** Live connection state to the Realtime Database (`.info/connected`). */
export function useConnected(): boolean {
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    return onValue(ref(db, '.info/connected'), (snap) => {
      setConnected(snap.val() === true)
    })
  }, [])

  return connected
}
