import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Garage from '@/screens/Garage';
import Tracks from '@/screens/Tracks';
import Admin from '@/screens/Admin';

function renderWithProviders(ui: React.ReactElement, { route = '/' } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path="*" element={ui} />
        </Routes>
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

describe('Loading states', () => {
  it('Garage shows loading skeleton while fetching', async () => {
    // Never resolve so we stay in loading state
    fetchSpy.mockReturnValueOnce(new Promise(() => {}));

    renderWithProviders(<Garage />);

    expect(screen.getByTestId('loading-skeleton')).toBeInTheDocument();
  });

  it('Tracks shows loading skeleton while fetching', async () => {
    fetchSpy.mockReturnValueOnce(new Promise(() => {}));

    renderWithProviders(<Tracks />);

    expect(screen.getByTestId('loading-skeleton')).toBeInTheDocument();
  });

  it('Admin shows loading skeleton while fetching', async () => {
    fetchSpy.mockReturnValueOnce(new Promise(() => {}));

    renderWithProviders(<Admin />);

    expect(screen.getByTestId('loading-skeleton')).toBeInTheDocument();
  });
});

describe('Empty states', () => {
  it('Garage shows empty state with no bikes', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    renderWithProviders(<Garage />);

    await waitFor(() => {
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    });
    expect(screen.getByText('No bikes yet')).toBeInTheDocument();
  });

  it('Tracks shows empty state with no tracks', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    renderWithProviders(<Tracks />);

    await waitFor(() => {
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    });
    expect(screen.getByText('No tracks yet')).toBeInTheDocument();
  });
});

describe('Error states', () => {
  it('Garage shows error state with retry button on fetch failure', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('Network error'));

    renderWithProviders(<Garage />);

    await waitFor(() => {
      expect(screen.getByTestId('error-state')).toBeInTheDocument();
    });
    expect(screen.getByTestId('retry-button')).toBeInTheDocument();
    expect(screen.getByText('Failed to load bikes. Please try again.')).toBeInTheDocument();
  });

  it('Tracks shows error state with retry button on fetch failure', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('Network error'));

    renderWithProviders(<Tracks />);

    await waitFor(() => {
      expect(screen.getByTestId('error-state')).toBeInTheDocument();
    });
    expect(screen.getByTestId('retry-button')).toBeInTheDocument();
  });

  it('Admin shows error state with retry button on fetch failure', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('Network error'));

    renderWithProviders(<Admin />);

    await waitFor(() => {
      expect(screen.getByTestId('error-state')).toBeInTheDocument();
    });
    expect(screen.getByTestId('retry-button')).toBeInTheDocument();
  });

  it('retry button triggers refetch', async () => {
    // First call fails
    fetchSpy.mockRejectedValueOnce(new Error('Network error'));

    renderWithProviders(<Garage />);

    await waitFor(() => {
      expect(screen.getByTestId('retry-button')).toBeInTheDocument();
    });

    // Setup second fetch to succeed
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const { userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    await user.click(screen.getByTestId('retry-button'));

    await waitFor(() => {
      // After retry, should either show empty state or the garage
      expect(screen.getByText('Garage')).toBeInTheDocument();
    });
  });
});
