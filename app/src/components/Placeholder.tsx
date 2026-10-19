import { Button } from '@/components/ui/button'
import { useConnected } from '@/hooks/useConnected'
import { useAuth } from '@/lib/auth'
import { signOutStaff } from '@/lib/session'

export function Placeholder({ title, phase }: { title: string; phase?: number }) {
  const connected = useConnected()
  const { user } = useAuth()

  return (
    <main className="mx-auto flex min-h-svh max-w-2xl flex-col justify-center gap-3 px-4">
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      {phase !== undefined && (
        <p className="text-muted-foreground">Coming in Phase {phase}.</p>
      )}
      <p className="text-sm text-muted-foreground">
        Database: {connected ? 'connected' : 'offline'}
      </p>
      {user && (
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          Signed in as {user.email}
          <Button variant="outline" size="sm" onClick={() => void signOutStaff()}>
            Sign out
          </Button>
        </div>
      )}
    </main>
  )
}
