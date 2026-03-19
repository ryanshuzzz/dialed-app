import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TirePressureChart } from '@/components/garage/TirePressureChart';
import type { TirePressureLog } from '@/api/types';

// Recharts uses ResizeObserver which is not available in jsdom
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;

const mockReadings: TirePressureLog[] = [
  {
    id: 'tp-1',
    bike_id: 'bike-1',
    user_id: 'user-1',
    front_psi: 32.5,
    rear_psi: 30.0,
    front_temp_c: 25,
    rear_temp_c: 25,
    context: 'cold',
    session_id: null,
    notes: null,
    recorded_at: '2026-01-15T08:00:00Z',
    created_at: '2026-01-15T08:00:00Z',
  },
  {
    id: 'tp-2',
    bike_id: 'bike-1',
    user_id: 'user-1',
    front_psi: 34.0,
    rear_psi: 31.5,
    front_temp_c: 45,
    rear_temp_c: 50,
    context: 'pre_session',
    session_id: 'session-1',
    notes: null,
    recorded_at: '2026-01-20T10:00:00Z',
    created_at: '2026-01-20T10:00:00Z',
  },
  {
    id: 'tp-3',
    bike_id: 'bike-1',
    user_id: 'user-1',
    front_psi: 36.0,
    rear_psi: 33.5,
    front_temp_c: 65,
    rear_temp_c: 70,
    context: 'post_session',
    session_id: null,
    notes: null,
    recorded_at: '2026-01-20T11:30:00Z',
    created_at: '2026-01-20T11:30:00Z',
  },
];

describe('TirePressureChart', () => {
  it('renders chart container with data', () => {
    render(<TirePressureChart readings={mockReadings} />);
    expect(screen.getByTestId('tire-pressure-chart')).toBeInTheDocument();
    expect(screen.getByText('Pressure History')).toBeInTheDocument();
  });

  it('shows empty message when no data', () => {
    render(<TirePressureChart readings={[]} />);
    expect(screen.getByTestId('tire-pressure-chart')).toBeInTheDocument();
    expect(screen.getByText('No tire pressure data to display.')).toBeInTheDocument();
  });

  it('renders chart with correct structure', () => {
    const { container } = render(<TirePressureChart readings={mockReadings} />);
    // ResponsiveContainer renders the chart - check that the recharts container exists
    const chartContainer = container.querySelector('.recharts-responsive-container');
    expect(chartContainer).toBeInTheDocument();
  });
});
