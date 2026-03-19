import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Progress from '@/screens/Progress';

function renderProgress() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/progress']}>
        <Routes>
          <Route path="/progress" element={<Progress />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Progress screen', () => {
  it('renders the page heading', async () => {
    renderProgress();
    await waitFor(() => {
      expect(screen.getByText('Progress')).toBeInTheDocument();
    });
  });

  it('renders the lap trend chart section', async () => {
    renderProgress();
    await waitFor(() => {
      expect(screen.getByTestId('lap-trend-chart')).toBeInTheDocument();
    });
  });

  it('renders best lap cards with track names', async () => {
    renderProgress();
    await waitFor(() => {
      const cards = screen.getAllByTestId('best-lap-card');
      expect(cards.length).toBeGreaterThanOrEqual(2);
    });
    expect(screen.getAllByText('Barber Motorsports Park').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Road Atlanta').length).toBeGreaterThanOrEqual(1);
  });

  it('renders total time found', async () => {
    renderProgress();
    await waitFor(() => {
      expect(screen.getByTestId('total-time-found')).toBeInTheDocument();
    });
  });

  it('renders efficacy dashboard with adoption rate', async () => {
    renderProgress();
    await waitFor(() => {
      expect(screen.getByTestId('efficacy-dashboard')).toBeInTheDocument();
    });
    expect(screen.getByTestId('adoption-rate')).toHaveTextContent('72%');
  });

  it('renders efficacy delta stats', async () => {
    renderProgress();
    await waitFor(() => {
      expect(screen.getByTestId('delta-applied')).toBeInTheDocument();
      expect(screen.getByTestId('delta-modified')).toBeInTheDocument();
      expect(screen.getByTestId('delta-skipped')).toBeInTheDocument();
    });
  });

  it('renders the session history table with rows', async () => {
    renderProgress();
    await waitFor(() => {
      expect(screen.getByTestId('session-history-table')).toBeInTheDocument();
    });
    // 8 sessions from mock data
    const rows = screen.getByTestId('session-history-table').querySelectorAll('tbody tr');
    expect(rows.length).toBe(8);
  });

  it('renders track filter dropdown', async () => {
    renderProgress();
    await waitFor(() => {
      expect(screen.getByTestId('track-filter')).toBeInTheDocument();
    });
  });
});
