import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Settings from '@/screens/Settings';
import { useUiStore } from '@/stores/uiStore';

function renderSettings() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/settings']}>
        <Routes>
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Settings screen', () => {
  it('renders profile section with display name and email', async () => {
    renderSettings();
    await waitFor(() => {
      expect(screen.getByLabelText('Display Name')).toBeInTheDocument();
    });
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    // Email should be read-only
    expect(screen.getByLabelText('Email')).toHaveAttribute('readOnly');
  });

  it('renders rider type dropdown', async () => {
    renderSettings();
    await waitFor(() => {
      expect(screen.getByTestId('rider-type-select')).toBeInTheDocument();
    });
  });

  it('renders skill level and units dropdowns', async () => {
    renderSettings();
    await waitFor(() => {
      expect(screen.getByLabelText('Skill Level')).toBeInTheDocument();
      expect(screen.getByLabelText('Units')).toBeInTheDocument();
    });
  });

  it('renders API keys section', async () => {
    renderSettings();
    await waitFor(() => {
      expect(screen.getByTestId('api-keys-list')).toBeInTheDocument();
    });
    // 2 keys from mock data
    expect(screen.getByText('Data Logger Sync')).toBeInTheDocument();
    expect(screen.getByText('CI Pipeline')).toBeInTheDocument();
  });

  it('renders create key form', async () => {
    renderSettings();
    await waitFor(() => {
      expect(screen.getByTestId('create-key-form')).toBeInTheDocument();
    });
  });

  it('rider_type change updates uiStore', async () => {
    const user = userEvent.setup();
    renderSettings();

    await waitFor(() => {
      expect(screen.getByTestId('rider-type-select')).toBeInTheDocument();
    });

    // Change rider type to street
    await user.selectOptions(screen.getByTestId('rider-type-select'), 'street');

    // Click save
    await user.click(screen.getByTestId('save-profile-btn'));

    // Wait for mutation to complete and uiStore to update
    await waitFor(() => {
      const riderType = useUiStore.getState().riderType;
      expect(riderType).toBe('street');
    });
  });
});
