import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

/**
 * Wraps protected routes. Redirects to /login when no JWT token is present.
 * The token is persisted to localStorage via the zustand persist middleware,
 * so a page refresh keeps the user authenticated.
 */
export function AuthGuard() {
  const token = useAuthStore((s) => s.token);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
