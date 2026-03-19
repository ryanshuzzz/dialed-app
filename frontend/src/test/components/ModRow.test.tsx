import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ModRow } from '@/components/garage/ModRow';
import type { Modification } from '@/api/types';

const installedMod: Modification = {
  id: 'mod-1',
  bike_id: 'bike-1',
  user_id: 'user-1',
  action: 'installed',
  category: 'exhaust',
  part_name: 'Full System Exhaust',
  brand: 'Akrapovic',
  part_number: null,
  cost: 2850.0,
  currency: '$',
  installed_at: '2025-06-15T00:00:00Z',
  removed_at: null,
  mileage_km: 1200,
  notes: 'Titanium full system',
  created_at: '2025-06-15T10:00:00Z',
  updated_at: '2025-06-15T10:00:00Z',
};

const removedMod: Modification = {
  id: 'mod-2',
  bike_id: 'bike-1',
  user_id: 'user-1',
  action: 'removed',
  category: 'bodywork',
  part_name: 'OEM Mirrors',
  brand: 'Ducati',
  part_number: null,
  cost: null,
  currency: null,
  installed_at: '2024-03-15T00:00:00Z',
  removed_at: '2025-05-01T00:00:00Z',
  mileage_km: null,
  notes: 'Removed for track use',
  created_at: '2025-05-01T10:00:00Z',
  updated_at: '2025-05-01T10:00:00Z',
};

describe('ModRow', () => {
  it('renders installed mod with correct details', () => {
    render(<ModRow mod={installedMod} />);
    expect(screen.getByTestId('mod-row')).toBeInTheDocument();
    expect(screen.getByText('Full System Exhaust')).toBeInTheDocument();
    expect(screen.getByText('Akrapovic')).toBeInTheDocument();
    expect(screen.getByTestId('mod-category-badge')).toHaveTextContent('Exhaust');
    expect(screen.getByText('$2850.00')).toBeInTheDocument();
    expect(screen.getByText('Titanium full system')).toBeInTheDocument();
  });

  it('renders removed mod with opacity and removed date', () => {
    render(<ModRow mod={removedMod} />);
    const row = screen.getByTestId('mod-row');
    expect(row).toBeInTheDocument();
    expect(row.className).toContain('opacity-70');
    expect(screen.getByText('OEM Mirrors')).toBeInTheDocument();
    expect(screen.getByTestId('mod-category-badge')).toHaveTextContent('Bodywork');
    expect(screen.getByText('Removed for track use')).toBeInTheDocument();
    // Should show the removed date
    expect(screen.getByText(/Removed:/)).toBeInTheDocument();
  });

  it('does not show removed date for active mods', () => {
    render(<ModRow mod={installedMod} />);
    expect(screen.queryByText(/Removed:/)).not.toBeInTheDocument();
  });

  it('shows installed action label', () => {
    render(<ModRow mod={installedMod} />);
    expect(screen.getByText('Installed')).toBeInTheDocument();
  });

  it('shows removed action label', () => {
    render(<ModRow mod={removedMod} />);
    expect(screen.getByText('Removed')).toBeInTheDocument();
  });
});
