import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import MaintenanceLogScreen from '@/screens/MaintenanceLog';
import type { MaintenanceLog, UpcomingMaintenance } from '@/api/types';

const mockEntries: MaintenanceLog[] = [
  {
    id: 'maint-1',
    bike_id: 'bike-1',
    user_id: 'user-1',
    category: 'oil_change',
    description: 'Full synthetic oil change with Motul 300V',
    mileage_km: 4000,
    engine_hours: 78,
    cost: 85.0,
    currency: '$',
    performed_by: 'Self',
    performed_at: '2025-12-01T10:00:00Z',
    next_due_km: 7000,
    next_due_date: '2026-06-01T00:00:00Z',
    notes: 'Used OEM filter',
    receipt_url: null,
    created_at: '2025-12-01T10:00:00Z',
    updated_at: '2025-12-01T10:00:00Z',
  },
  {
    id: 'maint-2',
    bike_id: 'bike-1',
    user_id: 'user-1',
    category: 'chain',
    description: 'Chain cleaned and lubed',
    mileage_km: 3800,
    engine_hours: null,
    cost: 15.0,
    currency: '$',
    performed_by: 'Self',
    performed_at: '2025-11-15T14:00:00Z',
    next_due_km: 4300,
    next_due_date: null,
    notes: null,
    receipt_url: null,
    created_at: '2025-11-15T14:00:00Z',
    updated_at: '2025-11-15T14:00:00Z',
  },
  {
    id: 'maint-3',
    bike_id: 'bike-1',
    user_id: 'user-1',
    category: 'brakes',
    description: 'Front brake pads replaced',
    mileage_km: 3500,
    engine_hours: null,
    cost: 65.0,
    currency: '$',
    performed_by: 'Track Day Garage',
    performed_at: '2025-10-20T09:00:00Z',
    next_due_km: 8000,
    next_due_date: null,
    notes: null,
    receipt_url: null,
    created_at: '2025-10-20T09:00:00Z',
    updated_at: '2025-10-20T09:00:00Z',
  },
];

const mockUpcoming: UpcomingMaintenance = {
  items: [
    {
      id: 'maint-2',
      bike_id: 'bike-1',
      category: 'chain',
      performed_at: '2025-11-15T14:00:00Z',
      next_due_km: 4300,
      next_due_date: null,
      current_mileage_km: 4200,
    },
    {
      id: 'maint-1',
      bike_id: 'bike-1',
      category: 'oil_change',
      performed_at: '2025-12-01T10:00:00Z',
      next_due_km: 7000,
      next_due_date: '2026-06-01T00:00:00Z',
      current_mileage_km: 4200,
    },
  ],
};

function renderMaintenanceLog() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <MaintenanceLogScreen bikeId="bike-1" />
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

/** Helper: mock both the entries and upcoming fetch calls */
function mockFetchCalls(
  entries: MaintenanceLog[] = mockEntries,
  upcoming: UpcomingMaintenance = mockUpcoming,
) {
  fetchSpy.mockImplementation((input: string | URL | Request) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (url.includes('/maintenance/upcoming')) {
      return Promise.resolve(
        new Response(JSON.stringify(upcoming), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    }
    if (url.includes('/maintenance')) {
      return Promise.resolve(
        new Response(JSON.stringify(entries), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    }
    return Promise.resolve(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  });
}

describe('MaintenanceLog screen', () => {
  it('renders maintenance entries', async () => {
    mockFetchCalls();
    renderMaintenanceLog();

    await waitFor(() => {
      expect(screen.getByTestId('maintenance-list')).toBeInTheDocument();
    });

    const entries = screen.getAllByTestId('maintenance-entry');
    expect(entries.length).toBe(3);

    // Check entries are sorted newest first
    expect(entries[0]).toHaveTextContent('Full synthetic oil change with Motul 300V');
    expect(entries[1]).toHaveTextContent('Chain cleaned and lubed');
    expect(entries[2]).toHaveTextContent('Front brake pads replaced');
  });

  it('shows category badges on entries', async () => {
    mockFetchCalls();
    renderMaintenanceLog();

    await waitFor(() => {
      expect(screen.getByTestId('maintenance-list')).toBeInTheDocument();
    });

    const badges = screen.getAllByTestId('category-badge');
    expect(badges.length).toBe(3);
    expect(badges[0]).toHaveTextContent('Oil Change');
    expect(badges[1]).toHaveTextContent('Chain');
    expect(badges[2]).toHaveTextContent('Brakes');
  });

  it('shows upcoming maintenance section', async () => {
    mockFetchCalls();
    renderMaintenanceLog();

    await waitFor(() => {
      expect(screen.getByTestId('upcoming-maintenance')).toBeInTheDocument();
    });

    const upcomingItems = screen.getAllByTestId('upcoming-item');
    expect(upcomingItems.length).toBe(2);
    expect(upcomingItems[0]).toHaveTextContent('Chain');
    expect(upcomingItems[1]).toHaveTextContent('Oil Change');
  });

  it('does not show upcoming section when no upcoming items', async () => {
    mockFetchCalls(mockEntries, { items: [] });
    renderMaintenanceLog();

    await waitFor(() => {
      expect(screen.getByTestId('maintenance-list')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('upcoming-maintenance')).not.toBeInTheDocument();
  });

  it('opens add form and creates entry', async () => {
    const user = userEvent.setup();
    mockFetchCalls();
    renderMaintenanceLog();

    await waitFor(() => {
      expect(screen.getByTestId('add-maintenance-button')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('add-maintenance-button'));
    expect(screen.getByTestId('maintenance-form')).toBeInTheDocument();

    // Fill description
    const descInput = screen.getByLabelText('Description');
    await user.type(descInput, 'New chain installed');

    // Mock the create response and subsequent refetches
    const newEntry: MaintenanceLog = {
      ...mockEntries[0],
      id: 'maint-new',
      category: 'oil_change',
      description: 'New chain installed',
    };

    // The submit will trigger a POST, then invalidation will re-fetch
    fetchSpy.mockImplementation((input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const method = typeof input === 'object' && 'method' in input ? (input as Request).method : 'GET';
      if (method === 'POST' && url.includes('/maintenance')) {
        return Promise.resolve(
          new Response(JSON.stringify(newEntry), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      }
      if (url.includes('/maintenance/upcoming')) {
        return Promise.resolve(
          new Response(JSON.stringify(mockUpcoming), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      }
      if (url.includes('/maintenance')) {
        return Promise.resolve(
          new Response(JSON.stringify([...mockEntries, newEntry]), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      }
      return Promise.resolve(
        new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });

    await user.click(screen.getByTestId('submit-maintenance'));

    await waitFor(() => {
      expect(screen.queryByTestId('maintenance-form')).not.toBeInTheDocument();
    });
  });

  it('filters entries by category', async () => {
    const user = userEvent.setup();

    // Initially return all entries
    mockFetchCalls();
    renderMaintenanceLog();

    await waitFor(() => {
      expect(screen.getByTestId('maintenance-list')).toBeInTheDocument();
    });

    // Now mock filtered response
    fetchSpy.mockImplementation((input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes('/maintenance/upcoming')) {
        return Promise.resolve(
          new Response(JSON.stringify(mockUpcoming), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      }
      if (url.includes('/maintenance') && url.includes('category=brakes')) {
        return Promise.resolve(
          new Response(JSON.stringify([mockEntries[2]]), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      }
      if (url.includes('/maintenance')) {
        return Promise.resolve(
          new Response(JSON.stringify(mockEntries), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      }
      return Promise.resolve(
        new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });

    // Select brakes filter
    const filterSelect = screen.getByTestId('category-filter');
    await user.selectOptions(filterSelect, 'brakes');

    await waitFor(() => {
      const entries = screen.getAllByTestId('maintenance-entry');
      expect(entries.length).toBe(1);
    });

    expect(screen.getByText('Front brake pads replaced')).toBeInTheDocument();
  });

  it('shows empty state when no entries', async () => {
    mockFetchCalls([], { items: [] });
    renderMaintenanceLog();

    await waitFor(() => {
      expect(screen.getByText('No maintenance entries yet.')).toBeInTheDocument();
    });
  });

  it('shows loading state', () => {
    fetchSpy.mockReturnValue(new Promise(() => {}));
    renderMaintenanceLog();
    expect(screen.getByText('Loading maintenance entries...')).toBeInTheDocument();
  });
});
