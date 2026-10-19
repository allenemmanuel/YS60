import { onAuthStateChanged, type User } from 'firebase/auth'
import { onValue, ref } from 'firebase/database'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { auth, db } from '@/lib/firebase'

interface AuthState {
  /** True until we know whether someone is signed in and whether they are staff. */
  loading: boolean
  user: User | null
  /** Signed in AND listed under `staff/{uid}` (set from the Firebase console/CLI only). */
  isStaff: boolean
}

const AuthContext = createContext<AuthState>({ loading: true, user: null, isStaff: false })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ loading: true, user: null, isStaff: false })

  useEffect(() => {
    let stopStaff: (() => void) | undefined
    const stopAuth = onAuthStateChanged(auth, (user) => {
      stopStaff?.()
      stopStaff = undefined
      if (!user) {
        setState({ loading: false, user: null, isStaff: false })
        return
      }
      setState({ loading: true, user, isStaff: false })
      stopStaff = onValue(
        ref(db, `staff/${user.uid}`),
        (snap) => setState({ loading: false, user, isStaff: snap.val() === true }),
        () => setState({ loading: false, user, isStaff: false }),
      )
    })
    return () => {
      stopStaff?.()
      stopAuth()
    }
  }, [])

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  return useContext(AuthContext)
}
