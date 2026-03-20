import { Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { BottomNav } from './BottomNav';
import { DesktopSidebar } from './DesktopSidebar';
import { LogOut } from 'lucide-react';

export function AppLayout() {
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  function handleSignOut() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Desktop sidebar — hidden on mobile, visible on lg+ */}
      <DesktopSidebar />

      {/* Mobile header — hidden on desktop */}
      <header className="sticky top-0 z-40 border-b border-border-subtle bg-background-surface safe-area-top lg:hidden">
        <div className="mx-auto flex max-w-[480px] items-center justify-between px-4 py-3">
          <img src="/dialed_logo_v2.svg" alt="Dialed" className="h-7" />
          <button
            onClick={handleSignOut}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-foreground-muted transition-colors hover:bg-background-elevated hover:text-foreground-secondary"
            aria-label="Sign out"
            data-testid="sign-out-btn"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Main content area — add left padding on desktop for sidebar */}
      <main className="mx-auto max-w-[480px] px-4 pb-24 pt-4 lg:ml-[220px] lg:mr-0 lg:max-w-none lg:px-6 lg:pb-6">
        <Outlet />
      </main>

      {/* Bottom navigation — hidden on desktop */}
      <div className="lg:hidden">
        <BottomNav />
      </div>
    </div>
  );
}
