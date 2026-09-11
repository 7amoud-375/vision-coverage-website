import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Home from './pages/Home'
import Spinner from './components/ui/Spinner'

// The dashboard is only ever opened by the owner, so it is split out of the
// main bundle - visitors never download it.
const Admin = lazy(() => import('./pages/Admin'))

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />

      {/* Deliberately absent from the public nav - direct URL access only. */}
      <Route
        path="/admin"
        element={
          <Suspense
            fallback={
              <div className="flex min-h-screen items-center justify-center">
                <Spinner label="Loading dashboard" />
              </div>
            }
          >
            <Admin />
          </Suspense>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
