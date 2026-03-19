import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Admin from '@/screens/Admin';

function renderAdmin() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Admin screen', () => {
  it('renders the alias table with 5 rows', async () => {
    renderAdmin();
    await waitFor(() => {
      expect(screen.getByTestId('alias-table')).toBeInTheDocument();
    });
    const rows = screen.getByTestId('alias-table').querySelectorAll('tbody tr');
    expect(rows.length).toBe(5);
  });

  it('renders alias data in the table', async () => {
    renderAdmin();
    await waitFor(() => {
      expect(screen.getByText('GPS_Speed')).toBeInTheDocument();
    });
    expect(screen.getByText('gps_speed')).toBeInTheDocument();
    expect(screen.getByText('ThrottlePos')).toBeInTheDocument();
    expect(screen.getByText('throttle_pos')).toBeInTheDocument();
  });

  it('renders the add alias form', async () => {
    renderAdmin();
    await waitFor(() => {
      expect(screen.getByTestId('add-alias-form')).toBeInTheDocument();
    });
    expect(screen.getByTestId('new-raw-name')).toBeInTheDocument();
    expect(screen.getByTestId('new-canonical-name')).toBeInTheDocument();
    expect(screen.getByTestId('new-logger-model')).toBeInTheDocument();
  });

  it('clicking edit shows inline edit inputs', async () => {
    const user = userEvent.setup();
    renderAdmin();
    await waitFor(() => {
      expect(screen.getByTestId('edit-alias-1')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('edit-alias-1'));

    await waitFor(() => {
      expect(screen.getByTestId('edit-raw-name')).toBeInTheDocument();
      expect(screen.getByTestId('edit-canonical-name')).toBeInTheDocument();
      expect(screen.getByTestId('save-edit-btn')).toBeInTheDocument();
      expect(screen.getByTestId('cancel-edit-btn')).toBeInTheDocument();
    });
  });

  it('clicking cancel exits inline edit mode', async () => {
    const user = userEvent.setup();
    renderAdmin();
    await waitFor(() => {
      expect(screen.getByTestId('edit-alias-1')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('edit-alias-1'));
    await waitFor(() => {
      expect(screen.getByTestId('cancel-edit-btn')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('cancel-edit-btn'));
    await waitFor(() => {
      expect(screen.queryByTestId('edit-raw-name')).not.toBeInTheDocument();
    });
  });

  it('shows delete confirmation on delete click', async () => {
    const user = userEvent.setup();
    renderAdmin();
    await waitFor(() => {
      expect(screen.getByTestId('delete-alias-1')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('delete-alias-1'));
    await waitFor(() => {
      expect(screen.getByTestId('confirm-delete-alias-1')).toBeInTheDocument();
    });
  });
});
