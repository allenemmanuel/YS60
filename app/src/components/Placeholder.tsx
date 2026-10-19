import { useConnected } from '@/hooks/useConnected'

export function Placeholder({ title, phase }: { title: string; phase?: number }) {
  const connected = useConnected()

  return (
    <main className="mx-auto flex min-h-svh max-w-2xl flex-col justify-center gap-3 px-4">
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      {phase !== undefined && (
        <p className="text-muted-foreground">Coming in Phase {phase}.</p>
      )}
      <p className="text-sm text-muted-foreground">
        Database: {connected ? 'connected' : 'offline'}
      </p>
    </main>
  )
}
