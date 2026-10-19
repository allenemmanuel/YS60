import { createBrowserRouter, Navigate } from 'react-router'
import { Placeholder } from '@/components/Placeholder'
import { RequireStaff } from '@/components/RequireStaff'
import { Login } from '@/routes/Login'
import { ConceptIndex, StageConcept } from '@/stage/ConceptPage'

const staff = (title: string, phase: number) => (
  <RequireStaff>
    <Placeholder title={title} phase={phase} />
  </RequireStaff>
)

export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/admin" replace /> },
  { path: '/login', element: <Login /> },
  { path: '/admin', element: staff('Event control', 5) },
  { path: '/admin/guests', element: staff('Guests', 5) },
  { path: '/admin/prizes', element: staff('Prizes', 5) },
  { path: '/checkin', element: staff('Check-in', 5) },
  { path: '/stage', element: staff('Draw stage', 4) },
  { path: '/winners', element: <Placeholder title="Winners" phase={5} /> },
  { path: '/check', element: <Placeholder title="Did I win?" phase={5} /> },
  // Phase 4 preview: draw-screen concepts on made-up names (no database access).
  { path: '/concepts', element: <ConceptIndex /> },
  { path: '/concepts/:id', element: <StageConcept /> },
  { path: '*', element: <Placeholder title="Page not found" /> },
])
