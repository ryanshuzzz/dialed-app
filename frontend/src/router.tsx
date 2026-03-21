import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '@/components/common/AppLayout';
import { useAuthStore } from '@/stores/authStore';

// Lazy-loaded screens — each chunk loads only when the route is visited.
import { lazy, Suspense, type ReactNode } from 'react';

const Login = lazy(() => import('@/screens/Login'));
const Garage = lazy(() => import('@/screens/Garage'));
const BikeDetail = lazy(() => import('@/screens/BikeDetail'));
const MaintenanceLog = lazy(() => import('@/screens/MaintenanceLog'));
const Tracks = lazy(() => import('@/screens/Tracks'));
const TrackDetail = lazy(() => import('@/screens/TrackDetail'));
const Events = lazy(() => import('@/screens/Events'));
const EventDetail = lazy(() => import('@/screens/EventDetail'));
const SessionLogger = lazy(() => import('@/screens/SessionLogger'));
const SessionDetail = lazy(() => import('@/screens/SessionDetail'));
const Progress = lazy(() => import('@/screens/Progress'));
const Admin = lazy(() => import('@/screens/Admin'));
const Settings = lazy(() => import('@/screens/Settings'));

const NotFound = lazy(() => import('@/screens/NotFound'));

// NEW placeholder screens
const SessionsList = lazy(() => import('@/screens/SessionsList'));
const SessionNewSuspension = lazy(() => import('@/screens/SessionNewSuspension'));
const SessionNewFeedback = lazy(() => import('@/screens/SessionNewFeedback'));
const AiInsights = lazy(() => import('@/screens/AiInsights'));
const EcuSettings = lazy(() => import('@/screens/EcuSettings'));
const SagCalculator = lazy(() => import('@/screens/SagCalculator'));

function Suspended({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <p className="text-foreground-secondary">Loading...</p>
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

/** Redirects to /login when there is no auth token. */
function AuthGuard({ children }: { children: ReactNode }) {
  const token = useAuthStore((s) => s.token);
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

/** Redirects authenticated users away from the login screen. */
function GuestGuard({ children }: { children: ReactNode }) {
  const token = useAuthStore((s) => s.token);
  if (token) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

export const router = createBrowserRouter([
  // Public route — no auth required.
  {
    path: '/login',
    element: (
      <GuestGuard>
        <Suspended>
          <Login />
        </Suspended>
      </GuestGuard>
    ),
  },
  {
    path: '/',
    element: (
      <AuthGuard>
        <AppLayout />
      </AuthGuard>
    ),
    children: [
      {
        index: true,
        element: (
          <Suspended>
            <SessionsList />
          </Suspended>
        ),
      },
      {
        path: 'garage',
        element: (
          <Suspended>
            <Garage />
          </Suspended>
        ),
      },
      {
        path: 'bikes/:id',
        element: (
          <Suspended>
            <BikeDetail />
          </Suspended>
        ),
      },
      {
        path: 'bikes/:id/maintenance',
        element: (
          <Suspended>
            <MaintenanceLog />
          </Suspended>
        ),
      },
      {
        path: 'tracks',
        element: (
          <Suspended>
            <Tracks />
          </Suspended>
        ),
      },
      {
        path: 'tracks/:id',
        element: (
          <Suspended>
            <TrackDetail />
          </Suspended>
        ),
      },
      {
        path: 'events',
        element: (
          <Suspended>
            <Events />
          </Suspended>
        ),
      },
      {
        path: 'events/:id',
        element: (
          <Suspended>
            <EventDetail />
          </Suspended>
        ),
      },
      {
        path: 'sessions/new',
        element: (
          <Suspended>
            <SessionLogger />
          </Suspended>
        ),
      },
      {
        path: 'sessions/new/suspension',
        element: (
          <Suspended>
            <SessionNewSuspension />
          </Suspended>
        ),
      },
      {
        path: 'sessions/new/feedback',
        element: (
          <Suspended>
            <SessionNewFeedback />
          </Suspended>
        ),
      },
      {
        path: 'sessions/:id',
        element: (
          <Suspended>
            <SessionDetail />
          </Suspended>
        ),
      },
      {
        path: 'progress',
        element: (
          <Suspended>
            <Progress />
          </Suspended>
        ),
      },
      {
        path: 'ai',
        element: (
          <Suspended>
            <AiInsights />
          </Suspended>
        ),
      },
      {
        path: 'admin',
        element: (
          <Suspended>
            <Admin />
          </Suspended>
        ),
      },
      {
        path: 'settings',
        element: (
          <Suspended>
            <Settings />
          </Suspended>
        ),
      },
      {
        path: 'settings/ecu',
        element: (
          <Suspended>
            <EcuSettings />
          </Suspended>
        ),
      },
      {
        path: 'settings/sag',
        element: (
          <Suspended>
            <SagCalculator />
          </Suspended>
        ),
      },
      {
        path: '*',
        element: (
          <Suspended>
            <NotFound />
          </Suspended>
        ),
      },
    ],
  },
]);
