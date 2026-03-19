import { createBrowserRouter } from 'react-router-dom';
import { AppLayout } from '@/components/common/AppLayout';

// Lazy-loaded screens — each chunk loads only when the route is visited.
import { lazy, Suspense, type ReactNode } from 'react';

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

function Suspended({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-500">Loading...</p>
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      {
        index: true,
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
    ],
  },
]);
