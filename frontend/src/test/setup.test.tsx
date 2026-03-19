import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Garage from '@/screens/Garage';

function renderWithProviders(ui: React.ReactElement, { route = '/' } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        {ui}
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

let fetchSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  fetchSpy = vi.spyOn(globalThis, 'fetch');
});

afterEach(() => {
  fetchSpy.mockRestore();
});

describe('App setup', () => {
  it('renders the Garage screen without crashing', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    renderWithProviders(
      <Routes>
        <Route path="/" element={<Garage />} />
      </Routes>,
    );

    await waitFor(() => {
      expect(screen.getByText('Garage')).toBeInTheDocument();
    });
  });

  it('shows empty state when there are no bikes', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    renderWithProviders(
      <Routes>
        <Route path="/" element={<Garage />} />
      </Routes>,
    );

    await waitFor(() => {
      expect(screen.getByText('No bikes yet')).toBeInTheDocument();
    });
  });

  it('router mounts with multiple routes', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    renderWithProviders(
      <Routes>
        <Route path="/" element={<Garage />} />
        <Route path="/settings" element={<div>Settings Page</div>} />
      </Routes>,
    );

    await waitFor(() => {
      expect(screen.getByText('Garage')).toBeInTheDocument();
    });
  });
});
