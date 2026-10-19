import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth'
import { signOutStaff } from '@/lib/session'

/** Guards staff-only routes: signed out → /login; signed in but not on the staff list → message. */
export function RequireStaff({ children }: { children: ReactNode }) {
  const { loading, user, isStaff } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <main className="grid min-h-svh place-items-center text-muted-foreground" aria-busy="true">
        Loading…
      </main>
    )
  }

  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?next=${next}`} replace />
  }

  if (!isStaff) {
    return (
      <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-4 px-4">
        <h1 className="text-2xl font-semibold tracking-tight">Not a staff account</h1>
        <p className="text-muted-foreground">
          {user.email} is signed in but is not on the staff list. Ask the event admin to add it.
        </p>
        <Button variant="outline" className="self-start" onClick={() => void signOutStaff()}>
          Sign out
        </Button>
      </main>
    )
  }

  return children
}
