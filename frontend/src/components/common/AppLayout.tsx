import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useUiStore, type NavItem } from '@/stores/uiStore';
import { useAuthStore } from '@/stores/authStore';

interface NavEntry {
  item: NavItem;
  label: string;
  path: string;
}

const NAV_ENTRIES: NavEntry[] = [
  { item: 'garage', label: 'Garage', path: '/' },
  { item: 'tracks', label: 'Tracks', path: '/tracks' },
  { item: 'events', label: 'Events', path: '/events' },
  { item: 'sessions', label: 'Sessions', path: '/sessions/new' },
  { item: 'progress', label: 'Progress', path: '/progress' },
  { item: 'admin', label: 'Admin', path: '/admin' },
  { item: 'settings', label: 'Settings', path: '/settings' },
];

export function AppLayout() {
  const isNavVisible = useUiStore((s) => s.isNavVisible);
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const location = useLocation();
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  const visibleEntries = NAV_ENTRIES.filter((e) => isNavVisible(e.item));

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile header */}
      <header className="md:hidden flex items-center justify-between p-4 bg-white border-b border-gray-200">
        <h1 className="text-xl font-bold text-blue-800">Dialed</h1>
        <button
          onClick={toggleSidebar}
          className="p-2 rounded-lg hover:bg-gray-100"
          aria-label="Toggle menu"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>
      </header>

      <div className="flex">
        {/* Desktop sidebar */}
        <aside
          className={`
            fixed inset-y-0 left-0 z-30 w-56 bg-white border-r border-gray-200
            transform transition-transform duration-200 ease-in-out relative
            md:relative md:translate-x-0
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          `}
        >
          <div className="hidden md:block p-6">
            <h1 className="text-2xl font-bold text-blue-800">Dialed</h1>
          </div>
          <nav className="mt-4 px-3 space-y-1" data-testid="sidebar-nav">
            {visibleEntries.map((entry) => {
              const isActive =
                entry.path === '/'
                  ? location.pathname === '/'
                  : location.pathname.startsWith(entry.path);
              return (
                <Link
                  key={entry.item}
                  to={entry.path}
                  onClick={() => useUiStore.getState().setSidebarOpen(false)}
                  className={`
                    block px-3 py-2 rounded-lg text-sm font-medium
                    ${
                      isActive
                        ? 'bg-blue-50 text-blue-800'
                        : 'text-gray-700 hover:bg-gray-100'
                    }
                  `}
                >
                  {entry.label}
                </Link>
              );
            })}
          </nav>

          {/* Logout — pinned to bottom of sidebar */}
          <div className="absolute bottom-0 left-0 right-0 px-3 py-4 border-t border-gray-200">
            <button
              onClick={handleLogout}
              className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              data-testid="sidebar-logout-btn"
            >
              Sign Out
            </button>
          </div>
        </aside>

        {/* Overlay for mobile sidebar */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-20 bg-black/30 md:hidden"
            onClick={toggleSidebar}
          />
        )}

        {/* Main content — extra bottom padding on mobile for bottom nav */}
        <main className="flex-1 p-4 md:p-6 min-h-screen pb-20 md:pb-6">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 flex justify-around py-2"
        data-testid="bottom-nav"
      >
        {visibleEntries.slice(0, 5).map((entry) => {
          const isActive =
            entry.path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(entry.path);
          return (
            <Link
              key={entry.item}
              to={entry.path}
              className={`
                flex flex-col items-center px-2 py-1 text-xs min-w-[44px] min-h-[44px] justify-center
                ${isActive ? 'text-blue-800' : 'text-gray-500'}
              `}
            >
              {entry.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
