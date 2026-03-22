import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { BottomNav } from './BottomNav';
import { DesktopSidebar } from './DesktopSidebar';
import { LogOut } from 'lucide-react';

export function AppLayout() {
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const location = useLocation();

  // Hide bottom nav on wizard pages — they have their own fixed footer buttons
  const isWizardPage = location.pathname.startsWith('/sessions/new');

  function handleSignOut() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Desktop sidebar — hidden on mobile, visible on lg+ */}
      <DesktopSidebar />

      {/* Mobile header — hidden on desktop and during wizard flow */}
      <header className={`sticky top-0 z-40 border-b border-border-subtle bg-background-surface safe-area-top lg:hidden ${isWizardPage ? 'hidden' : ''}`}>
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
      <main className={`mx-auto max-w-[480px] px-4 lg:max-w-none lg:pl-[calc(220px+1.5rem)] lg:pr-6 lg:pb-6 ${isWizardPage ? 'pt-0 pb-0' : 'pt-4 pb-24'}`}>
        <Outlet />
      </main>

      {/* Bottom navigation — hidden on desktop and during wizard flow */}
      {!isWizardPage && (
        <div className="lg:hidden">
          <BottomNav />
        </div>
      )}
    </div>
  );
}
