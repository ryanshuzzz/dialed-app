import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
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

describe('App setup', () => {
  it('renders the Garage screen without crashing', () => {
    renderWithProviders(
      <Routes>
        <Route path="/" element={<Garage />} />
      </Routes>,
    );
    expect(screen.getByText('Garage')).toBeInTheDocument();
  });

  it('renders placeholder text on the Garage screen', () => {
    renderWithProviders(
      <Routes>
        <Route path="/" element={<Garage />} />
      </Routes>,
    );
    expect(screen.getByText('Your bikes will appear here.')).toBeInTheDocument();
  });

  it('router mounts with multiple routes', () => {
    renderWithProviders(
      <Routes>
        <Route path="/" element={<Garage />} />
        <Route path="/settings" element={<div>Settings Page</div>} />
      </Routes>,
    );
    expect(screen.getByText('Garage')).toBeInTheDocument();
  });
});
