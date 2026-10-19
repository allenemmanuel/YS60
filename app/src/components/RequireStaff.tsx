import type { ReactNode } from 'react'

/**
 * Guards staff-only routes.
 * TODO(Phase 3): check Firebase Auth and redirect to /login when signed out.
 */
export function RequireStaff({ children }: { children: ReactNode }) {
  return children
}
