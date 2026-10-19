import { signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { auth } from '@/lib/firebase'

/** Who is performing an action, for audit fields (`by`). */
export function actor(): string {
  const user = auth.currentUser
  return user?.email ?? user?.uid ?? 'unknown'
}

export async function signIn(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(auth, email.trim(), password)
}

export function signOutStaff(): Promise<void> {
  return signOut(auth)
}

/** Friendly message for Firebase Auth error codes. */
export function authErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code ?? ''
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-email':
      return 'Wrong email or password.'
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a minute and try again.'
    case 'auth/network-request-failed':
      return 'No internet connection.'
    default:
      return 'Could not sign in. Please try again.'
  }
}
